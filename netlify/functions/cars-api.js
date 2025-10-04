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
    const queryParams = event.queryStringParameters || {};
    
    // Query type: inventory, search, analytics, recommendations
    const queryType = queryParams.type || 'inventory';
    const make = queryParams.make;
    const maxPrice = queryParams.maxPrice;
    const fuel = queryParams.fuel;
    const status = queryParams.status;
    const minYear = queryParams.minYear;
    
    switch (queryType) {
      case 'inventory':
        // Get available cars for sale
        const { data: inventory, error: invError } = await supabase
          .from('cars')
          .select(`
            id, plate, make, model, version, price, 
            fuel, transmission, color, KM, 
            status, days_in_stock, demand_count,
            images, created_at
          `)
          .eq('is_active', true)
          .in('status', ['Exposição', 'Preparação'])
          .order('created_at', { ascending: false })
          .limit(20);

        if (invError) throw invError;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            type: 'inventory',
            cars: inventory,
            count: inventory.length
          })
        };

      case 'search':
        // Advanced search with filters
        let query = supabase
          .from('cars')
          .select(`
            id, plate, make, model, version, price,
            fuel, transmission, color, KM,
            status, days_in_stock, images,
            registration_date, power, engine_size
          `)
          .eq('is_active', true);

        if (make) query = query.ilike('make', `%${make}%`);
        if (maxPrice) query = query.lte('price', parseFloat(maxPrice));
        if (fuel) query = query.eq('fuel', fuel);
        if (status) query = query.eq('status', status);
        
        const { data: searchResults, error: searchError } = await query
          .order('price', { ascending: true })
          .limit(50);

        if (searchError) throw searchError;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            type: 'search',
            filters: { make, maxPrice, fuel, status },
            cars: searchResults,
            count: searchResults.length
          })
        };

      case 'analytics':
        // Business analytics
        const { data: analytics, error: analyticsError } = await supabase.rpc('get_inventory_analytics');
        
        // Fallback to manual analytics if function doesn't exist
        const { data: allCars, error: carsError } = await supabase
          .from('cars')
          .select(`
            make, price, status, fuel, days_in_stock, demand_count
          `)
          .eq('is_active', true);

        if (carsError) throw carsError;

        // Calculate analytics
        const totalInventory = allCars.length;
        const avgPrice = allCars.reduce((sum, car) => sum + (car.price || 0), 0) / totalInventory;
        const totalValue = allCars.reduce((sum, car) => sum + (car.price || 0), 0);
        
        const makeStats = allCars.reduce((acc, car) => {
          acc[car.make] = (acc[car.make] || 0) + 1;
          return acc;
        }, {});

        const statusStats = allCars.reduce((acc, car) => {
          acc[car.status] = (acc[car.status] || 0) + 1;
          return acc;
        }, {});

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            type: 'analytics',
            summary: {
              total_inventory: totalInventory,
              total_value: totalValue,
              average_price: Math.round(avgPrice),
              top_makes: Object.entries(makeStats).sort(([,a], [,b]) => b - a).slice(0, 5),
              status_breakdown: statusStats
            },
            detailed_data: allCars.slice(0, 10) // Sample for detailed analysis
          })
        };

      case 'recommendations':
        // Car recommendations based on lead intent
        const intent = queryParams.intent || 'purchase_intent';
        const budget = queryParams.budget || 15000;

        let recQuery = supabase
          .from('cars')
          .select(`
            id, plate, make, model, version, price,
            fuel, KM, status, images, demand_count,
            registration_date
          `)
          .eq('is_active', true)
          .eq('status', 'Exposição')
          .lte('price', budget)
          .order('demand_count', { ascending: false })
          .limit(10);

        const { data: recommendations, error: recError } = await recQuery;
        if (recError) throw recError;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            type: 'recommendations',
            intent,
            budget,
            cars: recommendations,
            count: recommendations.length
          })
        };

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid query type. Use: inventory, search, analytics, recommendations'
          })
        };
    }

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