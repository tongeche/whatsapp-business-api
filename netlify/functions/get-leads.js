const { supabase } = require('../../lib/supabase');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers };
  }

  try {
    // Get recent WhatsApp leads
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('source', 'whatsapp')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        leads: leads || [],
        count: leads?.length || 0
      }),
    };
  } catch (error) {
    console.error('Get leads error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message
      }),
    };
  }
};