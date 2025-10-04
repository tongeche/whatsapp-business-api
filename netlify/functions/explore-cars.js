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
    
    // First, check if cars table exists and get its structure
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'cars' })
      .single();

    let carsData = null;
    let carsError = null;

    // Try to get cars data
    try {
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .limit(10);
      
      carsData = data;
      carsError = error;
    } catch (e) {
      carsError = e;
    }

    // If cars table doesn't exist, check for other automotive-related tables
    const possibleTables = ['vehicles', 'inventory', 'stock', 'automobiles', 'auto_inventory'];
    let alternativeData = {};

    for (const tableName of possibleTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(3);
        
        if (!error && data) {
          alternativeData[tableName] = {
            exists: true,
            sampleData: data,
            count: data.length
          };
        }
      } catch (e) {
        alternativeData[tableName] = {
          exists: false,
          error: e.message
        };
      }
    }

    // Get all available tables
    let allTables = [];
    try {
      const { data: tables } = await supabase
        .rpc('get_all_tables');
      allTables = tables || [];
    } catch (e) {
      // Fallback method to list tables
      console.log('Could not get tables list:', e.message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        cars_table: {
          exists: !carsError,
          data: carsData,
          error: carsError?.message,
          count: carsData?.length || 0
        },
        alternative_tables: alternativeData,
        all_tables: allTables,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
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