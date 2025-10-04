const { supabase } = require('../../lib/supabase');

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'mywhatsappverify123';

exports.handler = async (event, context) => {
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
        
        // Try to save to database (we'll create a messages table)
        try {
          await supabase.from('whatsapp_messages').insert({
            message_id: m.id,
            from_phone: m.from,
            to_phone: PHONE_NUMBER_ID,
            message_type: m.type,
            message_body: m.text?.body || '',
            timestamp: m.timestamp,
            raw_data: JSON.stringify(m),
            direction: 'inbound'
          });
        } catch (dbError) {
          console.log('Could not save message to DB:', dbError.message);
        }
      }

      if (statuses?.length) {
        const s = statuses[0];
        console.log('[STATUS]', { id: s.id, status: s.status, timestamp: s.timestamp });
        
        // Try to save status update to database
        try {
          await supabase.from('whatsapp_messages').update({
            status: s.status,
            status_timestamp: s.timestamp
          }).eq('message_id', s.id);
        } catch (dbError) {
          console.log('Could not update message status in DB:', dbError.message);
        }
      }

      return { statusCode: 200, headers };
    } catch (e) {
      console.error('Webhook error:', e);
      return { statusCode: 200, headers };
    }
  }

  return { statusCode: 405, headers };
};