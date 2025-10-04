import fetch from 'node-fetch';

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'mywhatsappverify123';

export const handler = async (event, context) => {
  const { httpMethod, queryStringParameters, body } = event;

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (httpMethod === 'GET') {
    // Webhook verification
    const mode = queryStringParameters?.['hub.mode'];
    const token = queryStringParameters?.['hub.verify_token'];
    const challenge = queryStringParameters?.['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return {
        statusCode: 200,
        headers,
        body: challenge,
      };
    }
    return { statusCode: 403, headers };
  }

  if (httpMethod === 'POST') {
    try {
      const data = JSON.parse(body || '{}');
      
      const entry = data?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      const msgs = value?.messages;
      const statuses = value?.statuses;

      if (msgs?.length) {
        const m = msgs[0];
        console.log('[INBOUND]', { from: m.from, type: m.type, text: m.text?.body });
      }

      if (statuses?.length) {
        const s = statuses[0];
        console.log('[STATUS]', { id: s.id, status: s.status, timestamp: s.timestamp });
      }

      return { statusCode: 200, headers };
    } catch (e) {
      console.error('Webhook error:', e);
      return { statusCode: 200, headers };
    }
  }

  return { statusCode: 405, headers };
};