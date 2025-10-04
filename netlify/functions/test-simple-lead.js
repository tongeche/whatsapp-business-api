const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Generate a UUID for the lead
    function generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    
    // Simple lead creation test
    const testLead = {
      id: generateUUID(),
      phone: '+351931608896',
      source: 'whatsapp',
      status: 'new',
      intent: 'test_simple',
      tenant_id: process.env.DEFAULT_TENANT_ID,
      automation_status_reason: 'simple_test',
      automation_status_at: new Date().toISOString(),
      meta: JSON.stringify({
        test: true,
        message: 'Simple test lead creation'
      })
    };

    console.log('Attempting to create lead:', testLead);

    const { data, error } = await supabase
      .from('leads')
      .insert(testLead)
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          testData: testLead
        })
      };
    }

    console.log('Lead created successfully:', data);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Lead created successfully',
        leadId: data.id,
        data: data
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    };
  }
};