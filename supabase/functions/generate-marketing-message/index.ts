import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, currentMessage, productName, rating, orders } = await req.json();
    
    console.log('Generate marketing message request:', { type, productName, rating, orders });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the user prompt based on type
    let userPrompt = '';
    
    if (type === 'improve') {
      // Extract URLs from the message to explicitly preserve them
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = currentMessage?.match(urlRegex);
      
      userPrompt = `שפר את ההודעה השיווקית הבאה לפי העקרונות. אם יש קישורים - שמור אותם בדיוק:\n\n"${currentMessage}"`;
      
      if (urls && urls.length > 0) {
        userPrompt += `\n\nחשוב: שמור את הקישורים הבאים בדיוק כמו שהם:\n${urls.join('\n')}`;
      }
      
      if (productName) userPrompt += `\n\nשם המוצר: ${productName}`;
      if (rating) userPrompt += `\nדירוג: ${rating}`;
      if (orders) userPrompt += `\nכמות הזמנות: ${orders}`;
    } else {
      // generate
      if (!productName && !currentMessage) {
        userPrompt = 'צור הודעה שיווקית כללית למוצר מעולה שכדאי לקנות. השתמש בדוגמה גנרית אבל מושכת.';
      } else {
        userPrompt = 'צור הודעה שיווקית מנצחת למוצר זה:';
        if (productName) userPrompt += `\n\nשם המוצר: ${productName}`;
        if (rating) userPrompt += `\nדירוג: ${rating}`;
        if (orders) userPrompt += `\nכמות הזמנות: ${orders}`;
        
        // If there's a current message with URLs, preserve them
        if (currentMessage) {
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const urls = currentMessage.match(urlRegex);
          if (urls && urls.length > 0) {
            userPrompt += `\n\nשלב את הקישורים הבאים בהודעה:\n${urls.join('\n')}`;
          }
        }
      }
    }

    const systemPrompt = `אתה כותב תיאורים שיווקיים מקצועי למוצרים, מתמחה בכתיבה לשיווק שותפים בעברית.

עקרונות כתיבה חובה:
1. התמקד בערך המרכזי: איכות, מחיר, ייחודיות, פתרון בעיה, נוחות שימוש
2. כתיבה עניינית, בגובה העיניים, ברורה - ללא סיסמאות או מניירות מוגזמות
3. הדגש תועלות מוחשיות: חיסכון בזמן, שיפור ביצועים, נוחות בשימוש
4. השתמש בהנעה לפעולה רכה (Nudge) - דוגמה: "יותר מ-10,000 כבר עברו לחיים נוחים יותר עם..." במקום "אל תפספסו!"
5. שימוש במיקרו-קופי ממוקד - כל מילה חשובה
6. הדגש בידול ברור של המוצר - מה עושה אותו שונה?
7. אם יש נתונים (הנחות, דירוגים, כמות יחידות) - שלב אותם באופן טבעי
8. סיים עם קריאה ברורה אך רכה לפעולה

השראה מעקרונות: "$100M Offers" (אלכס הורמוזי), "The Psychology of Selling" (בריאן טרייסי), "Microcopy"

חשוב:
- כתוב בעברית זורמת וטבעית
- אל תשתמש במרכאות מיותרות
- התיאור צריך להיות בין 2-4 משפטים (לא יותר)
- התמקד בערך למשתמש, לא בתכונות טכניות
- אל תשתמש באמוג'י אלא אם זה ממש מתאים
- הקפד על איזון בין משיכה רגשית לאמינות

קריטי - פורמט התשובה:
- החזר רק את הטקסט השיווקי הסופי בלבד
- אין להוסיף הסברים, אפשרויות מרובות, או הערות
- אין להוסיף "אפשרות 1", "דוגמה", "הנה הטקסט" וכדומה
- רק את ההודעה השיווקית עצמה - לא פחות, לא יותר
- אם יש קישור (URL) בהודעה המקורית - שמור אותו בדיוק כמו שהוא`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "הגעת למגבלת השימוש ב-AI. נסה שוב בעוד מספר דקות." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "נגמרו הקרדיטים עבור AI. יש להוסיף קרדיטים בהגדרות." 
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    let generatedMessage = data.choices?.[0]?.message?.content || "";
    
    // Remove common explanation patterns (safety net)
    generatedMessage = generatedMessage
      .replace(/^הנה ההודעה המשופרת:?\s*/i, '')
      .replace(/^הודעה משופרת:?\s*/i, '')
      .replace(/^אפשרות \d+:?\s*/gm, '')
      .replace(/^\*\*אפשרות \d+:.*?\*\*\s*/gm, '')
      .replace(/^דוגמת איכות.*$/gm, '')
      .replace(/^\*{1,2}.*?למה התאים.*?\*{1,2}$/gm, '')
      .trim();

    // If multiple paragraphs, take only the first substantive one (the actual message)
    const paragraphs = generatedMessage.split('\n\n').filter(p => p.trim().length > 0);
    if (paragraphs.length > 1) {
      // Find the first paragraph that doesn't look like a meta-explanation
      const actualMessage = paragraphs.find(p => 
        !p.includes('למה') && 
        !p.includes('הסבר') && 
        !p.includes('עקרונות') &&
        !p.startsWith('*') &&
        p.length > 50 // Actual marketing message should be substantial
      );
      generatedMessage = actualMessage || paragraphs[0];
    }
    
    console.log('Generated message successfully');

    return new Response(JSON.stringify({ generatedMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-marketing-message function:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
