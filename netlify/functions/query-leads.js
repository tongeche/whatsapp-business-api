const { createClient } = require('@supabase/supabase-js');

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
    
    // Custom SQL query to get detailed WhatsApp lead data
    const { data, error } = await supabase.rpc('get_whatsapp_leads_detailed');
    
    if (error) {
      // Fallback to regular query if custom function doesn't exist
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('leads')
        .select(`
          id,
          phone,
          email,
          name,
          source,
          status,
          intent,
          meta,
          created_at,
          updated_at,
          automation_status_reason,
          tenant_id
        `)
        .eq('source', 'whatsapp')
        .order('created_at', { ascending: false });

      if (fallbackError) {
        throw fallbackError;
      }

      // Parse and format the data
      const formattedData = fallbackData.map(lead => {
        let parsedMeta = {};
        try {
          parsedMeta = JSON.parse(lead.meta || '{}');
        } catch (e) {
          parsedMeta = {};
        }

        return {
          ...lead,
          first_message: parsedMeta.first_message || null,
          normalized_phone: parsedMeta.normalized_phone || null,
          initial_contact_date: parsedMeta.initial_contact_date || null,
          original_contact_name: parsedMeta.contact_profile?.name || null,
          whatsapp_contact: parsedMeta.whatsapp_contact || false
        };
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          leads: formattedData,
          count: formattedData.length,
          query_type: 'formatted_whatsapp_leads'
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: data,
        count: data?.length || 0,
        query_type: 'custom_function'
      })
    };

  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};