const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'failed';
    
    console.log('🔄 Payment return page loaded with status:', status);

    const isSuccess = status === 'success';
    const messageType = isSuccess ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED';
    const bgColor = isSuccess ? '#dcfce7' : '#fee2e2';
    const iconColor = isSuccess ? '#16a34a' : '#dc2626';
    const title = isSuccess ? 'התשלום בוצע בהצלחה! 🎉' : 'התשלום נכשל';
    const message = isSuccess ? 'החשבון שלך שודרג למנוי פרימיום' : 'אנא נסה שוב או פנה לתמיכה';

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-color: ${bgColor};
          }
          .container {
            text-align: center;
            padding: 2rem;
          }
          .icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 1rem;
            color: ${iconColor};
          }
          h1 {
            font-size: 1.5rem;
            font-weight: bold;
            color: #111827;
            margin-bottom: 0.5rem;
          }
          p {
            color: #6b7280;
            margin-bottom: 1rem;
          }
          .status {
            font-size: 0.875rem;
            color: #9ca3af;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            ${isSuccess 
              ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
              : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
            }
          </svg>
          <h1>${title}</h1>
          <p>${message}</p>
          <p class="status">מעבד...</p>
        </div>
        
        <script>
          console.log('Payment return page: Sending ${messageType} to parent');
          
          // Send message to parent window
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: '${messageType}' }, '*');
            console.log('Message sent to parent window');
          } else {
            console.log('Not in iframe, no parent to message');
          }
        </script>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('❌ Error in payment-return:', error);
    
    return new Response(
      `<!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head><meta charset="UTF-8"><title>שגיאה</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 2rem;">
        <h1>אירעה שגיאה</h1>
        <p>אנא סגור חלון זה ונסה שוב</p>
      </body>
      </html>`,
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
        },
        status: 500,
      }
    );
  }
});
