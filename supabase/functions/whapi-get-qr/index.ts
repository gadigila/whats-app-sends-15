
import type { GetQrRequest } from './types.ts'
import { DatabaseService } from './database.ts'
import { WhapiClient } from './whapi-client.ts'
import { QrProcessor } from './qr-processor.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to wait/delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Helper function to check actual WHAPI status
async function checkActualWhapiStatus(channelToken: string): Promise<{ status: string; ready: boolean }> {
  try {
    console.log('🔍 Checking actual WHAPI status...')
    
    const statusResponse = await fetch(`https://gate.whapi.cloud/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${channelToken}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (statusResponse.ok) {
      const whapiStatus = await statusResponse.json()
      console.log('📊 Actual WHAPI status:', whapiStatus)
      
      const readyStatuses = ['qr', 'unauthorized', 'active', 'ready', 'launched']
      const isReady = readyStatuses.includes(whapiStatus.status)
      
      return { status: whapiStatus.status, ready: isReady }
    } else {
      console.error('❌ Failed to check WHAPI status:', statusResponse.status)
      return { status: 'unknown', ready: false }
    }
  } catch (error) {
    console.error('❌ Error checking WHAPI status:', error)
    return { status: 'error', ready: false }
  }
}

async function attemptQrRetrieval(whapiClient: WhapiClient, qrProcessor: QrProcessor, instanceId: string, channelToken: string, retryCount = 0): Promise<any> {
  const maxRetries = 3
  const baseDelay = 2000
  
  try {
    console.log(`🔄 QR retrieval attempt ${retryCount + 1}/${maxRetries + 1}`)
    
    if (!channelToken) {
      throw new Error('Channel token is required for QR generation')
    }

    const qrResponse = await whapiClient.getQrCode(instanceId, channelToken)
    console.log('📥 WHAPI QR response status:', qrResponse.status)

    if (qrResponse.ok) {
      const qrData = await qrResponse.json()
      console.log('✅ QR data received:', Object.keys(qrData))
      console.log('🔍 Raw QR response for debugging:', JSON.stringify(qrData, null, 2))
      return qrProcessor.processQrResponse(qrData)
    } else {
      const errorText = await qrResponse.text()
      console.error(`❌ QR request failed (attempt ${retryCount + 1}):`, {
        status: qrResponse.status,
        error: errorText,
        instanceId
      })
      
      const errorResult = qrProcessor.createErrorResponse(qrResponse.status, errorText, instanceId)
      
      if (errorResult.retryable && retryCount < maxRetries) {
        const delayMs = baseDelay * Math.pow(2, retryCount)
        console.log(`⏳ Retrying in ${delayMs}ms...`)
        await delay(delayMs)
        return attemptQrRetrieval(whapiClient, qrProcessor, instanceId, channelToken, retryCount + 1)
      }
      
      return errorResult
    }
  } catch (networkError) {
    console.error(`❌ Network error on attempt ${retryCount + 1}:`, networkError)
    
    if (retryCount < maxRetries) {
      const delayMs = baseDelay * Math.pow(2, retryCount)
      console.log(`⏳ Retrying after network error in ${delayMs}ms...`)
      await delay(delayMs)
      return attemptQrRetrieval(whapiClient, qrProcessor, instanceId, channelToken, retryCount + 1)
    }
    
    return qrProcessor.createNetworkErrorResponse(networkError)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const requestBody = await req.text()
    console.log('📱 Request body received:', requestBody)
    
    const { userId }: GetQrRequest = JSON.parse(requestBody)
    console.log('📱 Getting QR for user:', userId)

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const dbService = new DatabaseService()
    const whapiClient = new WhapiClient()
    const qrProcessor = new QrProcessor()

    // Get user's channel info
    const { profile, error: profileError } = await dbService.getUserProfile(userId)

    if (profileError || !profile) {
      console.error('❌ Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    console.log('🔍 Current user profile status:', {
      hasInstanceId: !!profile.instance_id,
      hasToken: !!profile.whapi_token,
      instanceStatus: profile.instance_status,
      lastUpdated: profile.updated_at
    })

    if (!profile.instance_id || !profile.whapi_token) {
      console.log('🚨 No instance or token found, requires new instance')
      return new Response(
        JSON.stringify(qrProcessor.createMissingInstanceResponse()),
        { status: 400, headers: corsHeaders }
      )
    }

    // IMPROVED: Smart status checking for 'initializing' and other states
    if (profile.instance_status !== 'unauthorized') {
      console.log('⚠️ Instance not ready for QR generation:', {
        currentStatus: profile.instance_status,
        requiredStatus: 'unauthorized',
        instanceId: profile.instance_id
      })
      
      // For initializing or other non-ready states, check actual WHAPI status
      if (profile.instance_status === 'initializing' || profile.instance_status === 'disconnected') {
        console.log('🔍 Checking actual WHAPI status for non-ready instance...')
        
        const actualStatus = await checkActualWhapiStatus(profile.whapi_token)
        
        if (actualStatus.ready) {
          console.log('✅ WHAPI shows channel is ready! Updating database status...')
          await dbService.updateChannelStatus(userId, 'unauthorized')
          // Continue with QR generation
        } else {
          const statusMessage = profile.instance_status === 'initializing' 
            ? 'Instance still initializing. Please wait for setup to complete.'
            : `Instance status: ${profile.instance_status}. WHAPI status: ${actualStatus.status}`;
            
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Instance not ready for QR generation',
              message: statusMessage,
              requiresNewInstance: profile.instance_status === 'disconnected',
              retryable: profile.instance_status === 'initializing',
              actualWhapiStatus: actualStatus.status
            }),
            { status: 400, headers: corsHeaders }
          )
        }
      } else if (profile.instance_status === 'connected') {
        return new Response(
          JSON.stringify({
            success: true,
            already_connected: true,
            message: 'WhatsApp is already connected',
            qr_code: null
          }),
          { status: 200, headers: corsHeaders }
        )
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Instance not in QR-ready state: ${profile.instance_status}`,
            message: 'Please check instance status or create a new instance',
            requiresNewInstance: true,
            retryable: false
          }),
          { status: 400, headers: corsHeaders }
        )
      }
    }

    console.log('✅ Instance ready for QR generation:', {
      instanceId: profile.instance_id,
      status: profile.instance_status
    })

    // Attempt QR retrieval
    const result = await attemptQrRetrieval(whapiClient, qrProcessor, profile.instance_id, profile.whapi_token)
    
    // Handle 404 errors (channel not found) by cleaning up database
    if (!result.success && (result.details?.status === 404 || result.requiresNewInstance)) {
      console.log('🗑️ Channel not found or invalid, cleaning up database...')
      await dbService.clearInvalidInstance(userId)
      
      return new Response(
        JSON.stringify(qrProcessor.createMissingInstanceResponse()),
        { status: 404, headers: corsHeaders }
      )
    }
    
    return new Response(
      JSON.stringify(result),
      { status: result.success ? 200 : 400, headers: corsHeaders }
    )

  } catch (error) {
    console.error('💥 QR Code Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
