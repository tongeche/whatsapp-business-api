const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Automated Price & Availability Alerts
async function setupPriceAlerts(leadId, preferences) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Create price alert record
  const alertData = {
    id: generateUUID(),
    lead_id: leadId,
    make: preferences.make,
    max_budget: preferences.maxBudget,
    fuel_type: preferences.fuel,
    transmission: preferences.transmission,
    alert_type: 'price_drop',
    is_active: true,
    created_at: new Date().toISOString()
  };

  // Store in alerts table (you'd need to create this)
  // For now, store in lead meta
  const { data: lead } = await supabase
    .from('leads')
    .select('meta')
    .eq('id', leadId)
    .single();

  const currentMeta = JSON.parse(lead.meta || '{}');
  currentMeta.price_alerts = currentMeta.price_alerts || [];
  currentMeta.price_alerts.push(alertData);

  await supabase
    .from('leads')
    .update({
      meta: JSON.stringify(currentMeta),
      automation_status_reason: 'price_alerts_configured'
    })
    .eq('id', leadId);
}

// Monitor car prices and send alerts
async function checkPriceAlerts() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get leads with active price alerts
  const { data: leads } = await supabase
    .from('leads')
    .select('id, phone, meta')
    .like('meta', '%price_alerts%');

  for (const lead of leads) {
    const meta = JSON.parse(lead.meta || '{}');
    const alerts = meta.price_alerts || [];

    for (const alert of alerts.filter(a => a.is_active)) {
      // Find matching cars with price changes
      const matchingCars = await findMatchingCars(alert);
      
      for (const car of matchingCars) {
        if (car.price <= alert.max_budget) {
          await sendPriceAlert(lead.phone, car, alert);
          
          // Mark alert as triggered
          alert.last_triggered = new Date().toISOString();
          await updateLeadMeta(lead.id, meta);
        }
      }
    }
  }
}

// New car arrival notifications
async function notifyNewArrivals() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get cars added in last 24 hours
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const { data: newCars } = await supabase
    .from('cars')
    .select('*')
    .gte('created_at', yesterday.toISOString())
    .eq('is_active', true)
    .eq('status', 'Exposição');

  // Get interested leads
  const { data: interestedLeads } = await supabase
    .from('leads')
    .select('id, phone, meta')
    .in('intent', ['purchase_intent', 'car_shopping']);

  for (const car of newCars) {
    for (const lead of interestedLeads) {
      const meta = JSON.parse(lead.meta || '{}');
      const preferences = meta.car_preferences || {};
      
      // Check if car matches lead preferences
      if (carMatchesPreferences(car, preferences)) {
        await sendNewArrivalAlert(lead.phone, car);
        
        // Update lead interaction
        await updateLeadInteraction(lead.id, 'new_arrival_alert', car);
      }
    }
  }
}

// Helper functions
function carMatchesPreferences(car, preferences) {
  if (preferences.make && !car.make.toLowerCase().includes(preferences.make.toLowerCase())) {
    return false;
  }
  if (preferences.maxBudget && car.price > preferences.maxBudget) {
    return false;
  }
  if (preferences.fuel && car.fuel !== preferences.fuel) {
    return false;
  }
  return true;
}

async function sendPriceAlert(phone, car, alert) {
  const message = `🚨 Price Alert! 
${car.make} ${car.model} is now €${car.price}
Previously €${alert.previous_price || 'Higher'}
📍 Plate: ${car.plate}
⛽ ${car.fuel} | 🏃 ${car.KM} km
View details: https://cute-tiramisu-05adc3.netlify.app/car/${car.id}`;

  await sendWhatsAppMessage(phone, message);
}

async function sendNewArrivalAlert(phone, car) {
  const message = `🆕 New Arrival! 
${car.make} ${car.model} ${car.version}
💰 €${car.price}
📍 ${car.plate}
⛽ ${car.fuel} | 🏃 ${car.KM} km
🎯 Just added to our showroom!
Interested? Reply to book a viewing!`;

  await sendWhatsAppMessage(phone, message);
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

module.exports = {
  setupPriceAlerts,
  checkPriceAlerts,
  notifyNewArrivals,
  carMatchesPreferences
};