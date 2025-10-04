const { createClient } = require('@supabase/supabase-js');
const { AutomationMaster } = require('../../lib/automation-master');

// Initialize Supabase client directly in the function
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
        
        try {
          // LEAD CAPTURE SYSTEM
          const contactProfile = value?.contacts?.[0]?.profile || {};
          await processIncomingMessage(m, contactProfile);
          console.log('[SUCCESS] Lead processing completed');
        } catch (leadError) {
          console.error('[ERROR] Lead processing failed:', leadError);
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

// LEAD CAPTURE SYSTEM
async function processIncomingMessage(message, contactProfile = {}) {
  try {
    console.log('[PROCESS] Starting lead processing for message:', message);
    
    const phoneNumber = message.from;
    const messageBody = message.text?.body || '';
    const messageType = message.type;
    
    console.log('[PROCESS] Extracted data:', { phoneNumber, messageBody, messageType });
    
    // Normalize phone number (remove + and country code variations)
    const normalizedPhone = phoneNumber.replace(/^\+/, '');
    
    // Extract intent from message using keywords
    const intent = extractIntent(messageBody);
    
    console.log('[PROCESS] Intent extracted:', intent);
    
    // Check if lead already exists by phone number
    console.log('[PROCESS] Checking for existing lead with phone:', phoneNumber);
    const { data: existingLead, error: findError } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', phoneNumber)
      .single();
    
    if (findError && findError.code !== 'PGRST116') {
      console.error('[ERROR] Database query error:', findError);
      throw findError;
    }
    
    console.log('[PROCESS] Existing lead check result:', { existingLead: !!existingLead, findError: findError?.code });
    
    let leadId;
    
    if (existingLead) {
      console.log('[PROCESS] Updating existing lead:', existingLead.id);
      await updateExistingLead(existingLead, messageBody, intent);
      leadId = existingLead.id;
    } else {
      console.log('[PROCESS] Creating new lead');
      leadId = await createNewLead(phoneNumber, normalizedPhone, messageBody, intent, contactProfile);
    }

    // 🤖 RUN INTELLIGENT AUTOMATION SYSTEM
    if (leadId) {
      console.log('[AUTOMATION] Running intelligent automation for lead:', leadId);
      try {
        const automationResult = await AutomationMaster.processIncomingMessage(
          phoneNumber, 
          messageBody, 
          leadId
        );
        console.log('[AUTOMATION] Automation completed:', automationResult);
      } catch (automationError) {
        console.error('[AUTOMATION ERROR]', automationError);
        // Don't fail the webhook if automation fails
      }
    }

    // Log the message for tracking
    console.log('[PROCESS] Logging WhatsApp message');
    await logWhatsAppMessage(message);
    
    console.log('[PROCESS] Lead processing completed successfully');
    
  } catch (error) {
    console.error('[ERROR] Lead processing error:', error);
    throw error;
  }
}

// Generate a UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function createNewLead(phoneNumber, normalizedPhone, messageBody, intent, contactProfile = {}) {
  try {
    // Extract email if provided in contact name or profile
    const contactName = contactProfile.name || '';
    const emailMatch = contactName.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const extractedEmail = emailMatch ? emailMatch[1] : null;
    
    const leadData = {
      id: generateUUID(),
      phone: phoneNumber,
      email: extractedEmail,
      name: extractedEmail ? null : contactName, // Use name if no email found
      source: 'whatsapp',
      status: 'new',
      intent: intent,
      tenant_id: process.env.DEFAULT_TENANT_ID || null,
      automation_status_reason: 'whatsapp_inbound_message',
      automation_status_at: new Date().toISOString(),
      meta: JSON.stringify({
        first_message: messageBody,
        whatsapp_contact: true,
        initial_contact_date: new Date().toISOString(),
        normalized_phone: normalizedPhone,
        contact_profile: contactProfile
      })
    };
    
    console.log('[CREATE] Attempting to insert lead data:', leadData);
    
    const { data, error } = await supabase
      .from('leads')
      .insert(leadData)
      .select()
      .single();
    
    if (error) {
      console.error('[ERROR] Error creating lead:', error);
      throw error;
    } else {
      console.log('[SUCCESS] ✅ New lead created:', data.id);
      
      // Send welcome message
      console.log('[CREATE] Sending welcome message');
      await sendWelcomeMessage(phoneNumber, intent);
      
      // Return the lead ID for automation
      return data.id;
    }
  } catch (error) {
    console.error('Create lead error:', error);
    throw error;
  }
}

async function updateExistingLead(existingLead, messageBody, intent) {
  try {
    // Update the lead with new interaction
    const updatedMeta = {
      ...JSON.parse(existingLead.meta || '{}'),
      last_whatsapp_message: messageBody,
      last_contact_date: new Date().toISOString(),
      message_count: (JSON.parse(existingLead.meta || '{}').message_count || 0) + 1
    };
    
    const { error } = await supabase
      .from('leads')
      .update({
        intent: intent || existingLead.intent,
        automation_status_reason: 'whatsapp_follow_up',
        automation_status_at: new Date().toISOString(),
        meta: JSON.stringify(updatedMeta)
      })
      .eq('id', existingLead.id);
    
    if (error) {
      console.error('Error updating lead:', error);
    } else {
      console.log('✅ Lead updated:', existingLead.id);
      
      // Send contextual response based on lead status
      await sendContextualResponse(existingLead.phone, existingLead, messageBody);
    }
  } catch (error) {
    console.error('Update lead error:', error);
  }
}

function extractIntent(messageBody) {
  const message = messageBody.toLowerCase();
  
  // Automotive business intents
  if (message.includes('buy') || message.includes('purchase') || message.includes('interested')) {
    return 'purchase_intent';
  }
  if (message.includes('sell') || message.includes('trade')) {
    return 'sell_intent';
  }
  if (message.includes('service') || message.includes('maintenance') || message.includes('repair')) {
    return 'service_intent';
  }
  if (message.includes('price') || message.includes('cost') || message.includes('quote')) {
    return 'pricing_inquiry';
  }
  if (message.includes('financing') || message.includes('loan') || message.includes('credit')) {
    return 'financing_inquiry';
  }
  if (message.includes('test drive') || message.includes('viewing') || message.includes('see')) {
    return 'viewing_request';
  }
  
  return 'general_inquiry';
}

async function sendWelcomeMessage(phoneNumber, intent) {
  try {
    let welcomeMessage = `👋 Hello! Thanks for reaching out to AutoTrust. `;
    
    switch (intent) {
      case 'purchase_intent':
        welcomeMessage += `I see you're interested in purchasing a vehicle. I'd be happy to help you find the perfect car! What type of vehicle are you looking for?`;
        break;
      case 'sell_intent':
        welcomeMessage += `Looking to sell or trade your vehicle? Great! We offer competitive prices. What's your car's make, model, and year?`;
        break;
      case 'service_intent':
        welcomeMessage += `Need service or maintenance? Our expert team is here to help. What service do you need?`;
        break;
      case 'pricing_inquiry':
        welcomeMessage += `Looking for pricing information? I can help you with that. Which vehicle or service are you interested in?`;
        break;
      default:
        welcomeMessage += `How can we help you today? Whether you're buying, selling, or need service, we're here to assist! 🚗`;
    }
    
    // Send via your existing WhatsApp API
    await sendWhatsAppMessage(phoneNumber, welcomeMessage);
    
  } catch (error) {
    console.error('Welcome message error:', error);
  }
}

async function sendContextualResponse(phoneNumber, lead, messageBody) {
  try {
    let response = '';
    
    // Smart responses based on lead status and message content
    if (lead.status === 'qualified' || lead.status === 'hot') {
      response = `Thanks for your message! Your dedicated representative will get back to you shortly. Is this regarding your ${lead.intent}?`;
    } else if (messageBody.toLowerCase().includes('urgent')) {
      response = `I understand this is urgent. Let me connect you with our priority team right away. 🚨`;
    } else {
      response = `Thanks for your follow-up message! We'll review this and get back to you soon. 👍`;
    }
    
    await sendWhatsAppMessage(phoneNumber, response);
    
  } catch (error) {
    console.error('Contextual response error:', error);
  }
}

async function sendWhatsAppMessage(phoneNumber, message) {
  try {
    const response = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: { body: message }
      })
    });
    
    if (response.ok) {
      console.log('✅ WhatsApp message sent successfully');
    } else {
      console.error('❌ Failed to send WhatsApp message:', await response.text());
    }
  } catch (error) {
    console.error('Send message error:', error);
  }
}

async function logWhatsAppMessage(message) {
  try {
    await supabase.from('whatsapp_messages').insert({
      message_id: message.id,
      from_phone: message.from,
      to_phone: PHONE_NUMBER_ID,
      message_type: message.type,
      message_body: message.text?.body || '',
      timestamp: message.timestamp,
      raw_data: JSON.stringify(message),
      direction: 'inbound',
      processed_at: new Date().toISOString()
    });
  } catch (error) {
    console.log('Message logging error (non-critical):', error.message);
  }
}