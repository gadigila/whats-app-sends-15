import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse Tranzila webhook data
    const formData = await req.formData();
    const response = formData.get('Response')?.toString();
    const userId = formData.get('user_id')?.toString();
    const transactionId = formData.get('remarks')?.toString();
    const company = formData.get('company')?.toString(); // 'yearly_plan' or 'monthly_plan'
    const cardToken = formData.get('TranzilaTK')?.toString(); // For recurring payments
    const stoId = formData.get('sto_id')?.toString(); // Standing Order ID from Tranzila

    console.log('📥 Tranzila webhook received:', {
      response,
      userId,
      transactionId,
      company,
      hasToken: !!cardToken,
      stoId,
    });

    // Verify successful payment (Response = "000")
    if (response !== '000') {
      console.error('❌ Payment failed with response:', response);
      return new Response('Payment failed', { status: 400 });
    }

    if (!userId) {
      console.error('❌ Missing user_id in webhook');
      return new Response('Missing user_id', { status: 400 });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('❌ Profile not found for user:', userId);
      return new Response('Profile not found', { status: 404 });
    }

    const planType = company === 'yearly_plan' ? 'yearly' : 'monthly';
    const daysToAdd = planType === 'yearly' ? 365 : 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysToAdd);

    // If webhook doesn't have sto_id, fetch it from Tranzila STO Get API
    let actualStoId = stoId ? parseInt(stoId) : null;
    
    if (!actualStoId && cardToken) {
      console.log('🔍 STO ID not in webhook, fetching from Tranzila API...');
      try {
        const terminalName = Deno.env.get('TRANZILA_TERMINAL_NAME')!;
        const appKey = Deno.env.get('TRANZILA_API_APP_KEY')!;
        const secret = Deno.env.get('TRANZILA_API_SECRET')!;
        
        // Generate HMAC authentication
        const nonce = crypto.randomUUID().replace(/-/g, '').substring(0, 40);
        const timestamp = Date.now().toString();
        
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const messageData = encoder.encode(appKey + timestamp + nonce);
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyData,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
        const accessToken = Array.from(new Uint8Array(signature))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        // Call Tranzila STO Get API
        const stoGetResponse = await fetch('https://api.tranzila.com/v1/sto/get', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-tranzila-api-access-token': accessToken,
            'X-tranzila-api-app-key': appKey,
            'X-tranzila-api-nonce': nonce,
            'X-tranzila-api-request-time': timestamp,
          },
          body: JSON.stringify({
            terminal_name: terminalName,
            card_token: cardToken,
            response_language: 'english',
          }),
        });

        const stoData = await stoGetResponse.json();
        console.log('📡 Tranzila STO Get API response:', stoData);
        
        if (stoData.error_code === 0 && stoData.sto_id) {
          actualStoId = parseInt(stoData.sto_id);
          console.log('✅ Retrieved STO ID from Tranzila API:', actualStoId);
        } else {
          console.warn('⚠️ Could not retrieve STO ID from API:', stoData.message);
        }
      } catch (error) {
        console.error('⚠️ Error fetching STO ID from Tranzila:', error);
        // Continue without sto_id - payment was successful
      }
    }

    console.log('💾 Storing subscription with STO ID:', actualStoId);

    // Update user profile with subscription
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        payment_plan: planType,
        subscription_status: 'active',
        auto_renew: true,
        subscription_expires_at: expiresAt.toISOString(),
        subscription_created_at: new Date().toISOString(),
        last_payment_date: new Date().toISOString(),
        tranzila_sto_id: actualStoId, // Store STO ID for future cancellations
        failed_payment_attempts: 0,
        trial_expires_at: null, // Clear trial
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Error updating profile:', updateError);
      throw updateError;
    }

    // Create invoice via Tranzila API
    try {
      // Get user's email for invoice
      const { data: { user: authUser }, error: userError } = await supabase.auth.admin.getUserById(userId);
      
      if (!userError && authUser?.email) {
        const terminalName = Deno.env.get('TRANZILA_TERMINAL_NAME')!;
        const terminalPassword = Deno.env.get('TRANZILA_TERMINAL_PASSWORD')!;
        
        const amount = planType === 'yearly' ? 990 : 99;
        const itemDescription = planType === 'yearly' 
          ? 'מנוי שנתי Reecher Premium' 
          : 'מנוי חודשי Reecher Premium';
        
        const invoiceParams = new URLSearchParams({
          supplier: terminalName,
          TranzilaPW: terminalPassword,
          transaction_id: transactionId || `${userId}_${Date.now()}`,
          
          // Customer details
          customer_name: profile.name || authUser.email.split('@')[0],
          customer_email: authUser.email,
          customer_phone: profile.phone_number || '',
          
          // Invoice items
          item_description: itemDescription,
          item_quantity: '1',
          item_unit_price: amount.toString(),
          item_total: amount.toString(),
          
          // Invoice settings
          currency: 'ILS',
          send_email: 'true',
          language: 'he',
        });

        const invoiceResponse = await fetch(
          'https://secure5.tranzila.com/cgi-bin/invoice.cgi',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: invoiceParams.toString(),
          }
        );

        const invoiceResult = await invoiceResponse.text();
        console.log('📧 Tranzila invoice response:', invoiceResult);

        // Parse response (key=value format)
        const invoiceData: Record<string, string> = {};
        invoiceResult.split('&').forEach(pair => {
          const [key, value] = pair.split('=');
          if (key && value) {
            invoiceData[key] = decodeURIComponent(value);
          }
        });

        if (invoiceData.Response === '000' || invoiceData.invoice_id) {
          // Store invoice in database
          await supabase.from('profiles').update({
            last_invoice_id: invoiceData.invoice_id,
            last_invoice_number: invoiceData.invoice_number,
            last_invoice_url: invoiceData.invoice_url || invoiceData.pdf_url,
            last_invoice_date: new Date().toISOString(),
          }).eq('id', userId);

          // Store full invoice record
          if (invoiceData.invoice_id) {
            await supabase.from('invoices').insert({
              user_id: userId,
              tranzila_invoice_id: invoiceData.invoice_id,
              invoice_number: invoiceData.invoice_number || invoiceData.invoice_id,
              invoice_url: invoiceData.invoice_url,
              pdf_url: invoiceData.pdf_url,
              amount,
              currency: 'ILS',
              plan_type: planType,
              transaction_id: transactionId || `${userId}_${Date.now()}`,
              status: 'sent',
              sent_at: new Date().toISOString(),
            });
          }

          console.log('✅ Invoice created and sent:', invoiceData.invoice_number);
        } else {
          console.error('⚠️ Invoice creation failed:', invoiceData);
        }
      } else {
        console.error('⚠️ Could not get user email for invoice:', userError);
      }
    } catch (invoiceError) {
      console.error('⚠️ Error creating invoice:', invoiceError);
      // Continue despite invoice error - payment was successful
    }

    // Activate WHAPI channel to live mode
    if (profile.whapi_channel_id) {
      const whapiToken = Deno.env.get('WHAPI_PARTNER_TOKEN')!;
      
      try {
        const whapiResponse = await fetch(
          `https://manager.whapi.cloud/channels/${profile.whapi_channel_id}/mode`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${whapiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ mode: 'live' }),
          }
        );

        if (!whapiResponse.ok) {
          console.error('⚠️ WHAPI activation failed:', await whapiResponse.text());
        } else {
          console.log('✅ WHAPI channel activated to live mode');
        }
      } catch (whapiError) {
        console.error('⚠️ WHAPI activation error:', whapiError);
        // Continue despite WHAPI error - payment was successful
      }
    }

    console.log('✅ Payment verified and subscription activated for user:', userId);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error verifying Tranzila payment:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
