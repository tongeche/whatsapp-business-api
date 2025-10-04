const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers };
  }

  try {
    const { to, body: messageBody } = JSON.parse(event.body || '{}');
    
    if (!to || !messageBody) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'to and body required' }),
      };
    }

    const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: messageBody }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('WA send failed:', data);
      
      // Enhanced error response with troubleshooting info
      const errorResponse = {
        ...data,
        troubleshooting: {
          status: response.status,
          commonSolutions: {
            code10: "Permission error - Check if your phone number is added to test recipients in Meta Developer Console",
            code100: "Invalid parameter - Check phone number format (must include country code)",
            code131: "User limit reached - Verify your app's messaging limit",
            tokenExpired: "Token may be expired - Generate a new access token"
          },
          nextSteps: [
            "1. Add recipient phone number to test list in Meta Developer Console",
            "2. Verify phone number format includes country code (e.g., +254712345678)",
            "3. Check if WhatsApp Business Account is verified",
            "4. Ensure app has whatsapp_business_messaging permissions"
          ]
        }
      };
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify(errorResponse, null, 2),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'send failed' }),
    };
  }
};