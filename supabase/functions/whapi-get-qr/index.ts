
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

async function attemptQrRetrieval(whapiClient: WhapiClient, qrProcessor: QrProcessor, instanceId: string, channelToken: string, retryCount = 0): Promise<any> {
  const maxRetries = 3
  const baseDelay = 2000 // 2 seconds between retries
  
  try {
    console.log(`🔄 QR retrieval attempt ${retryCount + 1}/${maxRetries + 1}`)
    
    if (!channelToken) {
      throw new Error('Channel token is required for QR generation')
    }

    // Use correct WHAPI QR endpoint
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
      
      // If it's retryable and we haven't exhausted retries
      if (errorResult.retryable && retryCount < maxRetries) {
        const delayMs = baseDelay * Math.pow(2, retryCount) // Exponential backoff
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

    // ENHANCED: Check if instance is in the correct state for QR generation
    if (profile.instance_status !== 'unauthorized') {
      console.log('⚠️ Instance not ready for QR generation:', {
        currentStatus: profile.instance_status,
        requiredStatus: 'unauthorized',
        instanceId: profile.instance_id
      })
      
      if (profile.instance_status === 'initializing') {
        // Try to check WHAPI status directly first
        console.log('🔍 Checking WHAPI status for initializing instance...')
        try {
          const statusResponse = await fetch(`https://gate.whapi.cloud/status`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${profile.whapi_token}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (statusResponse.ok) {
            const whapiStatus = await statusResponse.json()
            console.log('📊 Direct WHAPI status check:', whapiStatus)
            
            if (whapiStatus.status === 'qr' || whapiStatus.status === 'unauthorized') {
              console.log('✅ WHAPI shows QR ready, updating database status...')
              await dbService.updateChannelStatus(userId, 'unauthorized')
              // Continue with QR generation
            } else {
              return new Response(
                JSON.stringify({
                  success: false,
                  error: 'Instance still initializing',
                  message: `WHAPI status: ${whapiStatus.status}. Please wait for webhook to confirm unauthorized status`,
                  requiresNewInstance: false,
                  retryable: true
                }),
                { status: 400, headers: corsHeaders }
              )
            }
          } else {
            console.log('⚠️ Could not check WHAPI status directly')
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Instance still initializing',
                message: 'Please wait for webhook to confirm unauthorized status',
                requiresNewInstance: false,
                retryable: true
              }),
              { status: 400, headers: corsHeaders }
            )
          }
        } catch (statusError) {
          console.error('❌ Error checking WHAPI status:', statusError)
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Instance still initializing',
              message: 'Cannot verify WHAPI status. Please wait for webhook',
              requiresNewInstance: false,
              retryable: true
            }),
            { status: 400, headers: corsHeaders }
          )
        }
      } else if (profile.instance_status === 'connected') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Instance already connected',
            message: 'QR code not needed - instance is already authenticated',
            requiresNewInstance: false,
            retryable: false
          }),
          { status: 400, headers: corsHeaders }
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

    // Attempt QR retrieval using correct WHAPI endpoint
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
