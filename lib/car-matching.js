const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Smart Car Recommendation Engine
async function intelligentCarMatching(leadMessage, leadData) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Extract car preferences from message
  const preferences = extractCarPreferences(leadMessage);
  
  // Build dynamic search query
  let query = supabase
    .from('cars')
    .select(`
      id, plate, make, model, version, price,
      fuel, transmission, color, KM, status,
      images, days_in_stock, demand_count
    `)
    .eq('is_active', true)
    .eq('status', 'Exposição');

  // Apply filters based on detected preferences
  if (preferences.make) {
    query = query.ilike('make', `%${preferences.make}%`);
  }
  
  if (preferences.maxBudget) {
    query = query.lte('price', preferences.maxBudget);
  }
  
  if (preferences.fuel) {
    query = query.eq('fuel', preferences.fuel);
  }
  
  if (preferences.transmission) {
    query = query.eq('transmission', preferences.transmission);
  }

  // Sort by relevance: low mileage, recent stock, customer demand
  query = query
    .order('demand_count', { ascending: false })
    .order('days_in_stock', { ascending: true })
    .limit(5);

  const { data: recommendations, error } = await query;
  
  if (error) throw error;

  // Update lead with car preferences
  await updateLeadPreferences(leadData.id, preferences, recommendations);
  
  return recommendations;
}

// Extract car preferences from WhatsApp message
function extractCarPreferences(message) {
  const msg = message.toLowerCase();
  const preferences = {};

  // Extract make/brand
  const brands = ['bmw', 'mercedes', 'volkswagen', 'audi', 'toyota', 'ford', 'renault', 'peugeot', 'seat', 'skoda'];
  for (const brand of brands) {
    if (msg.includes(brand)) {
      preferences.make = brand.charAt(0).toUpperCase() + brand.slice(1);
      break;
    }
  }

  // Extract budget
  const budgetMatch = msg.match(/(?:até|under|below|maximum|max)?\s*(?:€|euros?)?\s*(\d{1,2}[.,]?\d{0,3})/i);
  if (budgetMatch) {
    preferences.maxBudget = parseInt(budgetMatch[1].replace(/[.,]/g, '')) * 1000;
  }

  // Extract fuel preference
  if (msg.includes('diesel')) preferences.fuel = 'Diesel';
  if (msg.includes('gasolina') || msg.includes('petrol')) preferences.fuel = 'Gasolina';
  if (msg.includes('elétrico') || msg.includes('electric')) preferences.fuel = 'Elétrico';
  if (msg.includes('híbrido') || msg.includes('hybrid')) preferences.fuel = 'Hibrido (Gasolina)';

  // Extract transmission
  if (msg.includes('automática') || msg.includes('automatic')) preferences.transmission = 'Automática';
  if (msg.includes('manual')) preferences.transmission = 'Manual';

  // Extract car type preferences
  if (msg.includes('suv')) preferences.type = 'SUV';
  if (msg.includes('sedan')) preferences.type = 'Sedan';
  if (msg.includes('carrinha') || msg.includes('wagon')) preferences.type = 'Carrinha';

  return preferences;
}

// Update lead with extracted preferences
async function updateLeadPreferences(leadId, preferences, recommendations) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const leadMeta = {
    car_preferences: preferences,
    recommended_cars: recommendations.map(car => ({
      id: car.id,
      make: car.make,
      model: car.model,
      price: car.price,
      recommended_at: new Date().toISOString()
    })),
    last_recommendation_date: new Date().toISOString()
  };

  await supabase
    .from('leads')
    .update({
      intent: 'car_shopping',
      automation_status_reason: 'car_recommendations_sent',
      automation_status_at: new Date().toISOString(),
      meta: JSON.stringify(leadMeta)
    })
    .eq('id', leadId);
}

module.exports = {
  intelligentCarMatching,
  extractCarPreferences,
  updateLeadPreferences
};