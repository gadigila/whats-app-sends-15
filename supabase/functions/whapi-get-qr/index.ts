
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
    console.log('📱 Getting QR for user:', (await req.json()).userId)
    
    const { userId }: GetQrRequest = await req.json()

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

    console.log('🔍 Found channel ID:', profile.instance_id)

    try {
      const qrResponse = await whapiClient.getQrCode(profile.instance_id, profile.whapi_token)
      console.log('📥 QR response status:', qrResponse.status)

      if (qrResponse.ok) {
        const qrData = await qrResponse.json()
        const result = qrProcessor.processQrResponse(qrData)
        
        return new Response(
          JSON.stringify(result),
          { status: result.success ? 200 : 400, headers: corsHeaders }
        )
      } else {
        const errorText = await qrResponse.text()
        console.error('❌ Partner API QR request failed:', {
          status: qrResponse.status,
          error: errorText,
          endpoint: `https://partner-api.whapi.cloud/api/v1/channels/${profile.instance_id}/qr`
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
          `https://partner-api.whapi.cloud/api/v1/channels/${profile.instance_id}/qr`
        )
        
        return new Response(
          JSON.stringify(errorResult),
          { status: qrResponse.status, headers: corsHeaders }
        )
      }
    } catch (networkError) {
      console.error('❌ Network error calling Partner API:', networkError)
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
