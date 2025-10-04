const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Multi-stage customer journey automation
class CustomerJourneyAutomation {
  
  // Journey stage definitions
  static STAGES = {
    INITIAL_INTEREST: 'initial_interest',
    PREFERENCES_GATHERED: 'preferences_gathered', 
    RECOMMENDATIONS_SENT: 'recommendations_sent',
    FOLLOW_UP_ENGAGED: 'follow_up_engaged',
    HOT_LEAD: 'hot_lead',
    PURCHASE_INTENT: 'purchase_intent',
    CONVERTED: 'converted',
    DORMANT: 'dormant'
  };

  // Automated stage progression
  static async progressLeadJourney(leadId, interaction) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (!lead) return;

    const meta = JSON.parse(lead.meta || '{}');
    const currentStage = meta.journey_stage || this.STAGES.INITIAL_INTEREST;
    const interactions = meta.interactions || [];
    
    // Add new interaction
    interactions.push({
      type: interaction.type,
      content: interaction.content,
      timestamp: new Date().toISOString(),
      stage: currentStage
    });

    // Determine next stage based on interaction patterns
    const nextStage = await this.calculateNextStage(lead, interactions, interaction);
    
    // Update lead with new stage and interaction
    await supabase
      .from('leads')
      .update({
        meta: JSON.stringify({
          ...meta,
          journey_stage: nextStage,
          interactions: interactions,
          last_interaction: new Date().toISOString()
        })
      })
      .eq('id', leadId);

    // Trigger stage-specific automation
    await this.triggerStageAutomation(leadId, nextStage, lead.phone);
    
    return nextStage;
  }

  static async calculateNextStage(lead, interactions, latestInteraction) {
    const meta = JSON.parse(lead.meta || '{}');
    const currentStage = meta.journey_stage || this.STAGES.INITIAL_INTEREST;
    
    // Interaction analysis
    const recentInteractions = interactions.slice(-5); // Last 5 interactions
    const hasCarPreferences = meta.car_preferences && Object.keys(meta.car_preferences).length > 2;
    const hasMultipleMessages = interactions.length >= 3;
    const hasPriceInquiry = interactions.some(i => 
      i.content && i.content.toLowerCase().includes('price') || 
      i.content.toLowerCase().includes('quanto') || 
      i.content.toLowerCase().includes('€')
    );
    
    // Stage progression logic
    switch (currentStage) {
      case this.STAGES.INITIAL_INTEREST:
        if (hasCarPreferences) return this.STAGES.PREFERENCES_GATHERED;
        if (hasMultipleMessages) return this.STAGES.FOLLOW_UP_ENGAGED;
        break;
        
      case this.STAGES.PREFERENCES_GATHERED:
        return this.STAGES.RECOMMENDATIONS_SENT;
        
      case this.STAGES.RECOMMENDATIONS_SENT:
        if (hasPriceInquiry) return this.STAGES.HOT_LEAD;
        if (hasMultipleMessages) return this.STAGES.FOLLOW_UP_ENGAGED;
        break;
        
      case this.STAGES.FOLLOW_UP_ENGAGED:
        if (hasPriceInquiry) return this.STAGES.HOT_LEAD;
        if (interactions.length >= 8) return this.STAGES.PURCHASE_INTENT;
        break;
        
      case this.STAGES.HOT_LEAD:
        if (latestInteraction.content && (
          latestInteraction.content.toLowerCase().includes('visit') ||
          latestInteraction.content.toLowerCase().includes('see') ||
          latestInteraction.content.toLowerCase().includes('book')
        )) {
          return this.STAGES.PURCHASE_INTENT;
        }
        break;
    }
    
    return currentStage;
  }

  static async triggerStageAutomation(leadId, stage, phone) {
    switch (stage) {
      case this.STAGES.PREFERENCES_GATHERED:
        await this.sendPersonalizedRecommendations(leadId, phone);
        break;
        
      case this.STAGES.HOT_LEAD:
        await this.notifySalesTeam(leadId, phone);
        await this.sendUrgencyMessage(phone);
        break;
        
      case this.STAGES.PURCHASE_INTENT:
        await this.scheduleImmediateFollowUp(leadId, phone);
        break;
        
      case this.STAGES.DORMANT:
        await this.triggerReEngagementCampaign(leadId, phone);
        break;
    }
  }

  static async sendPersonalizedRecommendations(leadId, phone) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: lead } = await supabase
      .from('leads')
      .select('meta')
      .eq('id', leadId)
      .single();

    const meta = JSON.parse(lead.meta || '{}');
    const preferences = meta.car_preferences || {};
    
    // Get matching cars
    let query = supabase
      .from('cars')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(3);

    if (preferences.make) {
      query = query.ilike('make', `%${preferences.make}%`);
    }
    
    if (preferences.maxBudget) {
      query = query.lte('price', preferences.maxBudget);
    }

    const { data: recommendedCars } = await query;

    if (recommendedCars && recommendedCars.length > 0) {
      let message = `🎯 Perfect matches for you:\n\n`;
      
      recommendedCars.forEach((car, index) => {
        message += `${index + 1}. ${car.make} ${car.model}
💰 €${car.price}
⛽ ${car.fuel} | 🏃 ${car.KM} km
📍 ${car.plate}

`;
      });
      
      message += `Which one interests you most?
Reply with the number (1, 2, or 3)
Or say "MORE INFO" for detailed specs`;

      await sendWhatsAppMessage(phone, message);
    }
  }

  static async notifySalesTeam(leadId, phone) {
    // Notify sales team about hot lead
    const salesTeamNumbers = ['+351931608896']; // Add your sales team numbers
    
    for (const salesPhone of salesTeamNumbers) {
      const message = `🔥 HOT LEAD ALERT!
Lead ID: ${leadId}
Phone: ${phone}
Stage: Hot Lead (Price Inquiry)

Immediate action required!
Call within 15 minutes for best conversion.`;

      await sendWhatsAppMessage(salesPhone, message);
    }
  }

  static async sendUrgencyMessage(phone) {
    const message = `🔥 Limited Time Opportunity!
Our best cars go fast - this one might not last long.

💡 Pro tip: Schedule a visit today
📞 Call us now: +351 XXX XXX XXX
📍 Or visit our showroom

Ready to move forward? 
Reply "VISIT" to schedule immediately!`;

    await sendWhatsAppMessage(phone, message);
  }

  // Follow-up automation based on time delays
  static async scheduleFollowUps() {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Find leads needing follow-up
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('source', 'whatsapp')
      .not('automation_status', 'eq', 'converted');

    for (const lead of leads) {
      const meta = JSON.parse(lead.meta || '{}');
      const lastInteraction = new Date(meta.last_interaction || lead.created_at);
      const hoursAgo = (Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60);
      
      await this.checkFollowUpNeeded(lead, hoursAgo);
    }
  }

  static async checkFollowUpNeeded(lead, hoursAgo) {
    const meta = JSON.parse(lead.meta || '{}');
    const stage = meta.journey_stage || this.STAGES.INITIAL_INTEREST;
    const followUps = meta.automated_follow_ups || [];
    
    let shouldFollowUp = false;
    let followUpType = '';
    
    // Follow-up timing rules
    if (stage === this.STAGES.RECOMMENDATIONS_SENT && hoursAgo >= 4 && !followUps.includes('4h_recommendation')) {
      shouldFollowUp = true;
      followUpType = '4h_recommendation';
    } else if (stage === this.STAGES.HOT_LEAD && hoursAgo >= 1 && !followUps.includes('1h_hot_lead')) {
      shouldFollowUp = true;
      followUpType = '1h_hot_lead';
    } else if (hoursAgo >= 48 && !followUps.includes('48h_general')) {
      shouldFollowUp = true;
      followUpType = '48h_general';
    } else if (hoursAgo >= 168 && !followUps.includes('weekly')) { // 1 week
      shouldFollowUp = true;
      followUpType = 'weekly';
    }

    if (shouldFollowUp) {
      await this.sendAutomatedFollowUp(lead, followUpType);
      
      // Record follow-up sent
      followUps.push(followUpType);
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase
        .from('leads')
        .update({
          meta: JSON.stringify({
            ...meta,
            automated_follow_ups: followUps
          })
        })
        .eq('id', lead.id);
    }
  }

  static async sendAutomatedFollowUp(lead, type) {
    const messages = {
      '4h_recommendation': `Hi! Did you get a chance to check out those car recommendations? 
Any questions about specs, financing, or scheduling a visit?`,
      
      '1h_hot_lead': `Still interested in that car? 
I can hold it for you with just a small deposit.
Ready to move forward?`,
      
      '48h_general': `Hi! Just following up on your car search.
Any new requirements or questions I can help with?`,
      
      'weekly': `Hope your car search is going well! 
We have some exciting new arrivals this week.
Would you like to see what's new?`
    };

    const message = messages[type];
    if (message) {
      await sendWhatsAppMessage(lead.phone, message);
    }
  }
}

// Helper function (would be imported from webhook utils)
async function sendWhatsAppMessage(phone, message) {
  // Implementation would call the actual WhatsApp API
  console.log(`Would send to ${phone}: ${message}`);
}

module.exports = { CustomerJourneyAutomation };