
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
  const baseDelay = 3000 // 3 seconds between retries
  
  try {
    console.log(`🔄 QR retrieval attempt ${retryCount + 1}/${maxRetries + 1}`)
    
    if (!channelToken) {
      throw new Error('Channel token is required for QR generation')
    }

    // Try loginuser endpoint first (primary)
    let qrResponse = await whapiClient.getQrCode(instanceId, channelToken)
    console.log('📥 WHAPI loginuser response status:', qrResponse.status)

    // If primary fails, try loginuserimage endpoint
    if (!qrResponse.ok) {
      console.log('⚠️ Primary loginuser endpoint failed, trying loginuserimage...')
      qrResponse = await whapiClient.getQrCodeImage(instanceId, channelToken)
      console.log('📥 WHAPI loginuserimage response status:', qrResponse.status)
    }

    // If image endpoint also fails, try loginuserrowdata endpoint
    if (!qrResponse.ok) {
      console.log('⚠️ Image endpoint failed, trying loginuserrowdata...')
      qrResponse = await whapiClient.getQrCodeRowData(instanceId, channelToken)
      console.log('📥 WHAPI loginuserrowdata response status:', qrResponse.status)
    }

    if (qrResponse.ok) {
      const qrData = await qrResponse.json()
      console.log('✅ QR data keys received:', Object.keys(qrData))
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

    if (!profile.instance_id || !profile.whapi_token) {
      console.log('🚨 No instance or token found, requires new instance')
      return new Response(
        JSON.stringify(qrProcessor.createMissingInstanceResponse()),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🔍 Found instance ID:', profile.instance_id)
    console.log('🔑 Using channel token for QR generation')

    // Check if channel was recently created (within last 2 minutes)
    // and add appropriate delay if needed
    const channelAge = await dbService.getChannelAge(userId)
    if (channelAge !== null && channelAge < 120000) { // 2 minutes in milliseconds
      const remainingWait = Math.max(0, 120000 - channelAge)
      if (remainingWait > 0) {
        console.log(`⏳ Channel is ${channelAge}ms old, waiting additional ${remainingWait}ms for channel to be ready...`)
        await delay(remainingWait)
      }
    }

    // Attempt QR retrieval with retry logic using correct WHAPI endpoints
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
