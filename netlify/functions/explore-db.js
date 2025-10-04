const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client directly in the function
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    // Get a sample of data from a few tables to understand the structure
    const results = {};

    // Try to get table information from information_schema
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(10);

    if (tablesError) {
      console.log('Could not get tables:', tablesError);
      // Fallback: try some common table names
      const commonTables = ['users', 'customers', 'orders', 'messages', 'contacts', 'leads'];
      
      for (const tableName of commonTables) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          
          if (!error && data) {
            results[tableName] = {
              exists: true,
              sampleCount: data.length,
              columns: data.length > 0 ? Object.keys(data[0]) : []
            };
          }
        } catch (e) {
          // Table doesn't exist, skip
        }
      }
    } else {
      // Got tables from information_schema
      results.availableTables = tables.map(t => t.table_name);
      
      // Get sample data from first few tables
      for (const table of tables.slice(0, 5)) {
        try {
          const { data, error } = await supabase
            .from(table.table_name)
            .select('*')
            .limit(2);
          
          if (!error) {
            results[table.table_name] = {
              sampleCount: data?.length || 0,
              columns: data && data.length > 0 ? Object.keys(data[0]) : [],
              sampleData: data
            };
          }
        } catch (e) {
          results[table.table_name] = { error: e.message };
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        database: results,
        timestamp: new Date().toISOString()
      }, null, 2),
    };
  } catch (error) {
    console.error('Database exploration error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        details: 'Could not explore database structure'
      }),
    };
  }
};