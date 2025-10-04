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
    
    // Test Supabase connection
    const { data: testData, error: testError } = await supabase
      .from('leads')
      .select('count')
      .limit(1);
    
    if (testError) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'error',
          message: 'Supabase connection failed',
          error: testError.message,
          supabaseUrl,
          hasServiceKey: !!supabaseServiceKey
        })
      };
    }

    // Test duplicate phone number insertion
    if (event.httpMethod === 'POST') {
      function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }
      
      const testLead = {
        id: generateUUID(),
        phone: '123456789012', // Same phone as existing lead
        source: 'whatsapp',
        status: 'new',
        intent: 'duplicate_test',
        tenant_id: process.env.DEFAULT_TENANT_ID,
        automation_status_reason: 'duplicate_test',
        automation_status_at: new Date().toISOString(),
        meta: JSON.stringify({
          duplicate_test: true,
          timestamp: new Date().toISOString()
        })
      };

      const { data: insertData, error: insertError } = await supabase
        .from('leads')
        .insert(testLead)
        .select()
        .single();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'success',
          message: 'Debug test completed',
          supabaseConnection: 'OK',
          testInsert: insertError ? 'FAILED' : 'SUCCESS',
          insertError: insertError?.message,
          insertedData: insertData,
          environment: {
            supabaseUrl,
            hasServiceKey: !!supabaseServiceKey,
            defaultTenantId: process.env.DEFAULT_TENANT_ID
          }
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'success',
        message: 'Debug endpoint working',
        supabaseConnection: 'OK',
        environment: {
          supabaseUrl,
          hasServiceKey: !!supabaseServiceKey,
          defaultTenantId: process.env.DEFAULT_TENANT_ID
        }
      })
    };

  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'error',
        message: 'Debug test failed',
        error: error.message,
        stack: error.stack
      })
    };
  }
};