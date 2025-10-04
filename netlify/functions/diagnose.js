const { supabase } = require('../../lib/supabase');

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const diagnostics = {};

    // 1. Test phone number info
    try {
      const phoneResponse = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}?fields=verified_name,display_phone_number,name_status,quality_rating`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      const phoneData = await phoneResponse.json();
      
      diagnostics.phoneNumber = {
        success: phoneResponse.ok,
        data: phoneData,
        status: phoneResponse.status
      };
    } catch (e) {
      diagnostics.phoneNumber = { error: e.message };
    }

    // 2. Test business account permissions
    try {
      const businessResponse = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/whatsapp_business_profile`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      const businessData = await businessResponse.json();
      
      diagnostics.businessProfile = {
        success: businessResponse.ok,
        data: businessData,
        status: businessResponse.status
      };
    } catch (e) {
      diagnostics.businessProfile = { error: e.message };
    }

    // 3. Check if we can access message templates
    try {
      const templatesResponse = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/message_templates?limit=1`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      const templatesData = await templatesResponse.json();
      
      diagnostics.messageTemplates = {
        success: templatesResponse.ok,
        data: templatesData,
        status: templatesResponse.status
      };
    } catch (e) {
      diagnostics.messageTemplates = { error: e.message };
    }

    // 4. Environment check
    diagnostics.environment = {
      hasToken: !!TOKEN,
      hasPhoneId: !!PHONE_NUMBER_ID,
      tokenLength: TOKEN ? TOKEN.length : 0,
      phoneId: PHONE_NUMBER_ID
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        diagnostics
      }, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};