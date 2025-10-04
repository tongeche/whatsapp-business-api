const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Smart Inventory Management & Lead Matching
async function inventoryDemandAnalysis() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Analyze lead demand patterns
  const { data: leads } = await supabase
    .from('leads')
    .select('meta, intent, created_at')
    .eq('source', 'whatsapp')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

  const demandData = {};
  
  for (const lead of leads) {
    const meta = JSON.parse(lead.meta || '{}');
    const preferences = meta.car_preferences || {};
    
    if (preferences.make) {
      demandData[preferences.make] = (demandData[preferences.make] || 0) + 1;
    }
  }

  // Update car demand counts
  const { data: cars } = await supabase
    .from('cars')
    .select('id, make, demand_count')
    .eq('is_active', true);

  for (const car of cars) {
    const leadDemand = demandData[car.make] || 0;
    
    if (leadDemand !== car.demand_count) {
      await supabase
        .from('cars')
        .update({ demand_count: leadDemand })
        .eq('id', car.id);
    }
  }

  return demandData;
}

// Slow-moving inventory alerts
async function detectSlowMovingInventory() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Cars in stock > 90 days with low demand
  const { data: slowMoving } = await supabase
    .from('cars')
    .select('*')
    .eq('is_active', true)
    .gte('days_in_stock', 90)
    .lte('demand_count', 1);

  for (const car of slowMoving) {
    await suggestPriceReduction(car);
    await findPotentialBuyers(car);
  }

  return slowMoving;
}

// Price reduction suggestions
async function suggestPriceReduction(car) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Calculate suggested price reduction
  const daysInStock = parseInt(car.days_in_stock);
  let discountPercentage = 0;
  
  if (daysInStock > 180) discountPercentage = 15;
  else if (daysInStock > 120) discountPercentage = 10;
  else if (daysInStock > 90) discountPercentage = 5;
  
  const suggestedPrice = Math.round(car.price * (1 - discountPercentage / 100));
  
  // Store suggestion in automation_meta
  const currentMeta = JSON.parse(car.automation_meta || '{}');
  currentMeta.pricing_suggestion = {
    original_price: car.price,
    suggested_price: suggestedPrice,
    discount_percentage: discountPercentage,
    reason: 'slow_moving_inventory',
    suggested_at: new Date().toISOString()
  };

  await supabase
    .from('cars')
    .update({
      automation_meta: JSON.stringify(currentMeta),
      pricing_signal: 'discount'
    })
    .eq('id', car.id);

  // Notify interested leads about price drop
  await notifyInterestedLeads(car, suggestedPrice);
}

// Find potential buyers for specific cars
async function findPotentialBuyers(car) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Find leads with matching preferences
  const { data: potentialBuyers } = await supabase
    .from('leads')
    .select('id, phone, meta')
    .eq('source', 'whatsapp')
    .in('intent', ['purchase_intent', 'car_shopping', 'pricing_inquiry']);

  const matchingLeads = [];
  
  for (const lead of potentialBuyers) {
    const meta = JSON.parse(lead.meta || '{}');
    const preferences = meta.car_preferences || {};
    
    // Check if car matches lead preferences
    let matches = true;
    
    if (preferences.make && !car.make.toLowerCase().includes(preferences.make.toLowerCase())) {
      matches = false;
    }
    
    if (preferences.maxBudget && car.price > preferences.maxBudget * 1.1) { // Allow 10% over budget
      matches = false;
    }
    
    if (preferences.fuel && car.fuel !== preferences.fuel) {
      matches = false;
    }
    
    if (matches) {
      matchingLeads.push(lead);
    }
  }

  // Send targeted offers to matching leads
  for (const lead of matchingLeads) {
    await sendTargetedOffer(lead.phone, car);
    
    // Update lead interaction history
    const meta = JSON.parse(lead.meta || '{}');
    meta.targeted_offers = meta.targeted_offers || [];
    meta.targeted_offers.push({
      car_id: car.id,
      car_details: `${car.make} ${car.model}`,
      price: car.price,
      sent_at: new Date().toISOString()
    });
    
    await supabase
      .from('leads')
      .update({ meta: JSON.stringify(meta) })
      .eq('id', lead.id);
  }

  return matchingLeads;
}

// Automated car reservations
async function handleCarReservation(leadId, carId, reservationHours = 24) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const reservationData = {
    lead_id: leadId,
    car_id: carId,
    reserved_until: new Date(Date.now() + reservationHours * 60 * 60 * 1000).toISOString(),
    status: 'active',
    created_at: new Date().toISOString()
  };

  // Update car availability
  await supabase
    .from('cars')
    .update({
      available_to: leadId,
      automation_meta: JSON.stringify({
        ...JSON.parse(car.automation_meta || '{}'),
        reservation: reservationData
      })
    })
    .eq('id', carId);

  // Update lead with reservation
  const { data: lead } = await supabase
    .from('leads')
    .select('meta')
    .eq('id', leadId)
    .single();

  const meta = JSON.parse(lead.meta || '{}');
  meta.car_reservations = meta.car_reservations || [];
  meta.car_reservations.push(reservationData);

  await supabase
    .from('leads')
    .update({
      meta: JSON.stringify(meta),
      automation_status_reason: 'car_reserved'
    })
    .eq('id', leadId);

  // Send confirmation message
  const { data: car } = await supabase
    .from('cars')
    .select('*')
    .eq('id', carId)
    .single();

  const { data: leadData } = await supabase
    .from('leads')
    .select('phone')
    .eq('id', leadId)
    .single();

  await sendReservationConfirmation(leadData.phone, car, reservationHours);
}

// Helper functions for messaging
async function sendTargetedOffer(phone, car) {
  const message = `🎯 Perfect Match for You!
${car.make} ${car.model} ${car.version || ''}
💰 €${car.price} (Special offer available!)
📍 ${car.plate}
⛽ ${car.fuel} | 🏃 ${car.KM} km | 🎨 ${car.color}
📅 ${car.days_in_stock} days in stock

This matches your preferences perfectly!
Reply "INTERESTED" to reserve for 24h
Or "DETAILS" for more information.`;

  await sendWhatsAppMessage(phone, message);
}

async function sendReservationConfirmation(phone, car, hours) {
  const message = `✅ Car Reserved Successfully!
${car.make} ${car.model}
💰 €${car.price}
📍 ${car.plate}

🔒 Reserved for ${hours} hours
⏰ Until: ${new Date(Date.now() + hours * 60 * 60 * 1000).toLocaleString()}

Next steps:
📞 Call us to schedule viewing
💳 Arrange financing (if needed)
📝 Prepare documentation

Reply "EXTEND" to extend reservation
Reply "CANCEL" to cancel reservation`;

  await sendWhatsAppMessage(phone, message);
}

async function notifyInterestedLeads(car, newPrice) {
  // Implementation for price drop notifications
  const message = `💥 Price Drop Alert!
${car.make} ${car.model}
🔻 Now €${newPrice} (was €${car.price})
💾 Save €${car.price - newPrice}!

Limited time offer. Reply "BOOK" to reserve!`;

  // Would send to all interested leads
}

module.exports = {
  inventoryDemandAnalysis,
  detectSlowMovingInventory,
  suggestPriceReduction,
  findPotentialBuyers,
  handleCarReservation
};