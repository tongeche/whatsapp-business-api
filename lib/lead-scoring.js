const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Advanced Lead Scoring System
function calculateLeadScore(lead, interactions, carViews) {
  let score = 0;
  const meta = JSON.parse(lead.meta || '{}');

  // Intent-based scoring
  const intentScores = {
    'purchase_intent': 40,
    'financing_inquiry': 35,
    'viewing_request': 30,
    'pricing_inquiry': 25,
    'car_shopping': 20,
    'general_inquiry': 10
  };
  score += intentScores[lead.intent] || 0;

  // Message frequency scoring
  const messageCount = meta.message_count || 1;
  if (messageCount >= 5) score += 20;
  else if (messageCount >= 3) score += 15;
  else if (messageCount >= 2) score += 10;

  // Urgency keywords scoring
  const urgentKeywords = ['urgent', 'today', 'now', 'immediately', 'asap'];
  const lastMessage = meta.last_whatsapp_message || meta.first_message || '';
  if (urgentKeywords.some(keyword => lastMessage.toLowerCase().includes(keyword))) {
    score += 25;
  }

  // Budget indication scoring
  if (meta.car_preferences?.maxBudget) {
    if (meta.car_preferences.maxBudget >= 20000) score += 20;
    else if (meta.car_preferences.maxBudget >= 10000) score += 15;
    else if (meta.car_preferences.maxBudget >= 5000) score += 10;
  }

  // Specific car inquiry scoring
  if (meta.car_preferences?.make) score += 15;
  if (meta.specific_car_interest) score += 20;

  // Contact information completeness
  if (lead.email) score += 10;
  if (lead.name) score += 5;

  // Recent activity scoring
  const lastContact = new Date(meta.last_contact_date || lead.created_at);
  const hoursSinceContact = (new Date() - lastContact) / (1000 * 60 * 60);
  if (hoursSinceContact <= 2) score += 15;
  else if (hoursSinceContact <= 24) score += 10;
  else if (hoursSinceContact <= 72) score += 5;

  return Math.min(score, 100); // Cap at 100
}

// Hot lead detection and alerts
async function detectHotLeads() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get recent leads for scoring
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('source', 'whatsapp')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
    .order('updated_at', { ascending: false });

  const hotLeads = [];
  
  for (const lead of leads) {
    const score = calculateLeadScore(lead);
    
    // Update lead score in database
    const meta = JSON.parse(lead.meta || '{}');
    meta.lead_score = score;
    meta.score_calculated_at = new Date().toISOString();
    
    let newStatus = lead.status;
    let statusReason = lead.automation_status_reason;

    // Classify lead based on score
    if (score >= 80) {
      newStatus = 'hot';
      statusReason = 'high_purchase_intent_detected';
      hotLeads.push({ ...lead, score });
    } else if (score >= 60) {
      newStatus = 'warm';
      statusReason = 'moderate_interest_detected';
    } else if (score >= 40) {
      newStatus = 'qualified';
      statusReason = 'basic_interest_confirmed';
    }

    // Update lead in database
    await supabase
      .from('leads')
      .update({
        status: newStatus,
        automation_status_reason: statusReason,
        automation_status_at: new Date().toISOString(),
        meta: JSON.stringify(meta)
      })
      .eq('id', lead.id);
  }

  // Send alerts for hot leads
  await alertSalesTeam(hotLeads);
  
  return hotLeads;
}

// Sales team alerts
async function alertSalesTeam(hotLeads) {
  for (const lead of hotLeads) {
    const meta = JSON.parse(lead.meta || '{}');
    
    // Send immediate WhatsApp alert to sales manager
    const alertMessage = `🔥 HOT LEAD ALERT!
📞 ${lead.phone}
📧 ${lead.email || 'No email'}
🎯 Score: ${meta.lead_score}/100
💬 "${meta.last_whatsapp_message || meta.first_message}"
🚗 Interested in: ${meta.car_preferences?.make || 'Various cars'}
💰 Budget: €${meta.car_preferences?.maxBudget || 'Not specified'}
⏰ Last contact: ${formatTimeAgo(meta.last_contact_date)}

Action needed: Call within 1 hour!`;

    // Send to sales team phone number
    const salesTeamPhone = process.env.SALES_TEAM_PHONE || '+351931608896';
    await sendWhatsAppMessage(salesTeamPhone, alertMessage);
  }
}

// Automated follow-up sequences
async function setupFollowUpSequence(leadId, sequenceType = 'purchase_intent') {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const sequences = {
    'purchase_intent': [
      { delay: 60, message: "Thank you for your interest! Would you like to schedule a viewing of the cars we discussed?" },
      { delay: 1440, message: "Hi! Just checking if you had any questions about the vehicles I recommended yesterday?" },
      { delay: 4320, message: "Special offer: We're offering 10% discount on selected vehicles this week. Interested?" }
    ],
    'price_inquiry': [
      { delay: 30, message: "I can provide detailed pricing and financing options. What's your preferred budget range?" },
      { delay: 720, message: "We have flexible payment options available. Would you like to discuss financing?" }
    ],
    'viewing_request': [
      { delay: 15, message: "Perfect! Our showroom is open Mon-Sat 9AM-6PM. What time works best for you?" },
      { delay: 60, message: "I've reserved the car for your viewing. Please confirm your preferred time slot." }
    ]
  };

  const sequence = sequences[sequenceType] || sequences['purchase_intent'];
  
  // Store follow-up sequence in lead meta
  const { data: lead } = await supabase
    .from('leads')
    .select('meta')
    .eq('id', leadId)
    .single();

  const meta = JSON.parse(lead.meta || '{}');
  meta.follow_up_sequence = {
    type: sequenceType,
    steps: sequence.map((step, index) => ({
      ...step,
      step_number: index + 1,
      scheduled_for: new Date(Date.now() + step.delay * 60 * 1000).toISOString(),
      sent: false
    })),
    created_at: new Date().toISOString()
  };

  await supabase
    .from('leads')
    .update({
      meta: JSON.stringify(meta),
      automation_status_reason: 'follow_up_sequence_scheduled'
    })
    .eq('id', leadId);
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  return `${Math.floor(diffHours / 24)} days ago`;
}

module.exports = {
  calculateLeadScore,
  detectHotLeads,
  alertSalesTeam,
  setupFollowUpSequence
};