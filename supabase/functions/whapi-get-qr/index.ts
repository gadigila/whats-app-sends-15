
import type { GetQrRequest } from './types.ts'
import { DatabaseService } from './database.ts'
import { WhapiClient } from './whapi-client.ts'
import { QrProcessor } from './qr-processor.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Read and parse request body once
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

    if (!profile.instance_id) {
      console.log('🚨 No instance found, requires new instance')
      return new Response(
        JSON.stringify(qrProcessor.createMissingInstanceResponse()),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('🔍 Found instance ID:', profile.instance_id)

    try {
      // Try Manager API first (recommended approach)
      let qrResponse = await whapiClient.getQrCode(profile.instance_id)
      console.log('📥 Manager API QR response status:', qrResponse.status)

      // If Manager API fails and we have channel token, try Gate API as fallback
      if (!qrResponse.ok && profile.whapi_token) {
        console.log('⚠️ Manager API failed, trying Gate API fallback...')
        qrResponse = await whapiClient.getQrCodeFallback(profile.instance_id, profile.whapi_token)
        console.log('📥 Gate API QR response status:', qrResponse.status)
      }

      if (qrResponse.ok) {
        const qrData = await qrResponse.json()
        console.log('✅ QR data keys received:', Object.keys(qrData))
        const result = qrProcessor.processQrResponse(qrData)
        
        return new Response(
          JSON.stringify(result),
          { status: result.success ? 200 : 400, headers: corsHeaders }
        )
      } else {
        const errorText = await qrResponse.text()
        console.error('❌ QR request failed:', {
          status: qrResponse.status,
          error: errorText,
          instanceId: profile.instance_id
        })
        
        // If it's a 404, the channel probably doesn't exist
        if (qrResponse.status === 404) {
          console.log('🗑️ Channel not found (404), cleaning up database...')
          await dbService.clearInvalidInstance(userId)
          
          return new Response(
            JSON.stringify(qrProcessor.createMissingInstanceResponse()),
            { status: 404, headers: corsHeaders }
          )
        }
        
        const errorResult = qrProcessor.createErrorResponse(
          qrResponse.status, 
          errorText, 
          profile.instance_id
        )
        
        return new Response(
          JSON.stringify(errorResult),
          { status: qrResponse.status, headers: corsHeaders }
        )
      }
    } catch (networkError) {
      console.error('❌ Network error calling QR API:', networkError)
      const errorResult = qrProcessor.createNetworkErrorResponse(networkError)
      
      return new Response(
        JSON.stringify(errorResult),
        { status: 500, headers: corsHeaders }
      )
    }

  } catch (error) {
    console.error('💥 QR Code Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
