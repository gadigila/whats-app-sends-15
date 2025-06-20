
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { DatabaseService } from './database.ts'
import { WhapiClient } from './whapi-client.ts'
import { EnhancedQRProcessor } from './enhanced-qr-processor.ts'
import type { GetQRRequest, GetQRResponse } from './types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🚀 Enhanced WHAPI Get QR Function Started')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const dbService = new DatabaseService()

    const { userId }: GetQRRequest = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('👤 Processing QR request for user:', userId)

    // Get user profile
    const { profile, error: profileError } = await dbService.getUserProfile(userId)

    if (profileError || !profile) {
      console.error('❌ Profile error:', profileError)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('👤 User profile:', {
      hasInstanceId: !!profile.instance_id,
      hasToken: !!profile.whapi_token,
      status: profile.instance_status
    })

    if (!profile.instance_id || !profile.whapi_token) {
      console.error('❌ No WhatsApp instance found for user')
      return new Response(
        JSON.stringify({ 
          error: 'No WhatsApp instance found',
          message: 'Please create a WhatsApp connection first'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Use enhanced QR processor with token validation
    console.log('🔄 Using enhanced QR processor with validation...')
    const qrProcessor = new EnhancedQRProcessor(profile.whapi_token)
    const qrResult = await qrProcessor.getQRWithRetry()
    
    console.log('📱 QR processor result:', {
      success: qrResult.success,
      hasQR: !!qrResult.qr_code,
      alreadyConnected: qrResult.already_connected,
      status: qrResult.status,
      tokenInvalid: qrResult.token_invalid
    })

    // Handle token invalidation - auto-cleanup
    if (qrResult.token_invalid) {
      console.log('🧹 Token is invalid, cleaning up user profile...')
      
      try {
        await supabase
          .from('profiles')
          .update({
            instance_id: null,
            whapi_token: null,
            instance_status: 'disconnected',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
        
        console.log('✅ Successfully cleaned up invalid token')
        
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Token invalid - cleaned up',
            message: 'הטוקן לא תקין, נוקה מהמערכת. צור ערוץ חדש',
            token_cleaned: true,
            requires_new_channel: true
          }),
          { status: 400, headers: corsHeaders }
        )
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup invalid token:', cleanupError)
      }
    }

    // Update database status based on result
    if (qrResult.already_connected) {
      await dbService.updateChannelStatus(userId, 'connected')
    } else if (qrResult.status && qrResult.status !== profile.instance_status) {
      // Only update if we have a meaningful status
      if (!['error', 'timeout', 'unknown'].includes(qrResult.status)) {
        await dbService.updateChannelStatus(userId, qrResult.status)
      }
    }

    const response: GetQRResponse = {
      success: qrResult.success,
      qr_code: qrResult.qr_code,
      already_connected: qrResult.already_connected,
      message: qrResult.message,
      status: qrResult.status,
      retry_after: qrResult.retry_after
    }

    return new Response(
      JSON.stringify(response),
      { 
        status: qrResult.success ? 200 : 400, 
        headers: corsHeaders 
      }
    )

  } catch (error) {
    console.error('💥 Enhanced QR Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
