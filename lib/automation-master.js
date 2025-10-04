// Master Automation Controller
// Orchestrates all automotive business automation systems

const { calculateLeadScore, detectHotLeads, sendHotLeadAlert } = require('./lead-scoring');
const { intelligentCarMatching, extractCarPreferences, updateLeadPreferences } = require('./car-matching');
const { checkPriceDrops, sendPriceAlert, processNewArrivals, sendNewArrivalNotification } = require('./price-alerts');
const { inventoryDemandAnalysis, detectSlowMovingInventory, handleCarReservation } = require('./inventory-automation');
const { CustomerJourneyAutomation } = require('./customer-journey');

class AutomationMaster {
  
  // Main entry point for WhatsApp message automation
  static async processIncomingMessage(phone, message, leadId) {
    console.log(`🤖 Processing automation for lead ${leadId}: ${message.substring(0, 50)}...`);
    
    try {
      // 1. Extract car preferences from message
      const preferences = await extractCarPreferences(message);
      if (Object.keys(preferences).length > 0) {
        await updateLeadPreferences(leadId, preferences);
        console.log(`✅ Updated preferences for lead ${leadId}:`, preferences);
      }

      // 2. Progress customer journey
      const interaction = {
        type: 'whatsapp_message',
        content: message
      };
      const newStage = await CustomerJourneyAutomation.progressLeadJourney(leadId, interaction);
      console.log(`📈 Lead ${leadId} progressed to stage: ${newStage}`);

      // 3. Calculate updated lead score
      const leadScore = await calculateLeadScore(leadId);
      console.log(`📊 Lead score calculated: ${leadScore.score} (${leadScore.category})`);

      // 4. Check for hot lead and alert sales team
      if (leadScore.category === 'hot') {
        await sendHotLeadAlert(leadId, phone, leadScore);
        console.log(`🔥 Hot lead alert sent for ${phone}`);
      }

      // 5. Provide intelligent car recommendations
      const recommendations = await intelligentCarMatching(leadId, message);
      if (recommendations.matches.length > 0) {
        await this.sendCarRecommendations(phone, recommendations.matches);
        console.log(`🚗 Sent ${recommendations.matches.length} car recommendations`);
      }

      // 6. Handle specific intents
      await this.handleSpecialIntents(phone, message, leadId);

      return {
        success: true,
        stage: newStage,
        score: leadScore,
        recommendations: recommendations.matches.length
      };

    } catch (error) {
      console.error('❌ Automation processing error:', error);
      return { success: false, error: error.message };
    }
  }

  // Handle special message intents
  static async handleSpecialIntents(phone, message, leadId) {
    const msg = message.toLowerCase();
    
    // Car reservation request
    if (msg.includes('reserve') || msg.includes('book') || msg.includes('hold')) {
      const carMatches = await this.extractCarIdFromMessage(message, leadId);
      if (carMatches.length > 0) {
        await handleCarReservation(leadId, carMatches[0], 24); // 24-hour reservation
        console.log(`🔒 Car reserved for lead ${leadId}`);
      }
    }
    
    // Price inquiry
    if (msg.includes('price') || msg.includes('cost') || msg.includes('€') || msg.includes('quanto')) {
      await this.handlePriceInquiry(phone, leadId);
    }
    
    // Visit/test drive request
    if (msg.includes('visit') || msg.includes('see') || msg.includes('test') || msg.includes('drive')) {
      await this.handleVisitRequest(phone, leadId);
    }
  }

  // Daily automation tasks (run via cron job)
  static async runDailyAutomations() {
    console.log('🕒 Running daily automations...');
    
    try {
      // 1. Check for price drops and notify interested leads
      const priceDrops = await checkPriceDrops();
      console.log(`💸 Processed ${priceDrops.length} price drops`);

      // 2. Process new car arrivals
      const newArrivals = await processNewArrivals();
      console.log(`🆕 Processed ${newArrivals.length} new arrivals`);

      // 3. Analyze inventory demand patterns
      const demandData = await inventoryDemandAnalysis();
      console.log(`📊 Analyzed demand for ${Object.keys(demandData).length} car makes`);

      // 4. Detect slow-moving inventory
      const slowMoving = await detectSlowMovingInventory();
      console.log(`🐌 Found ${slowMoving.length} slow-moving cars`);

      // 5. Schedule follow-ups
      await CustomerJourneyAutomation.scheduleFollowUps();
      console.log(`📞 Processed follow-up scheduling`);

      // 6. Hot leads detection and alerts
      const hotLeads = await detectHotLeads();
      console.log(`🔥 Detected ${hotLeads.length} hot leads`);

      return {
        success: true,
        processed: {
          priceDrops: priceDrops.length,
          newArrivals: newArrivals.length,
          demandAnalysis: Object.keys(demandData).length,
          slowMoving: slowMoving.length,
          hotLeads: hotLeads.length
        }
      };

    } catch (error) {
      console.error('❌ Daily automation error:', error);
      return { success: false, error: error.message };
    }
  }

  // Hourly automation tasks (run more frequently)
  static async runHourlyAutomations() {
    console.log('⏰ Running hourly automations...');
    
    try {
      // Check for immediate hot leads
      const hotLeads = await detectHotLeads();
      
      // Process any urgent follow-ups (< 2 hours)
      await CustomerJourneyAutomation.scheduleFollowUps();
      
      return {
        success: true,
        hotLeadsDetected: hotLeads.length
      };

    } catch (error) {
      console.error('❌ Hourly automation error:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper methods
  static async sendCarRecommendations(phone, cars) {
    if (cars.length === 0) return;
    
    let message = `🎯 Perfect matches for you:\n\n`;
    
    cars.slice(0, 3).forEach((car, index) => {
      message += `${index + 1}. ${car.make} ${car.model}
💰 €${car.price}
⛽ ${car.fuel} | 🏃 ${car.KM} km | 🎨 ${car.color}
📍 ${car.plate}
⭐ Match Score: ${Math.round(car.matchScore)}%

`;
    });
    
    message += `Interested in any? Reply with:
• Number (1, 2, 3) for details
• "RESERVE" to hold one
• "VISIT" to schedule viewing`;

    await this.sendWhatsAppMessage(phone, message);
  }

  static async handlePriceInquiry(phone, leadId) {
    const message = `💰 Great question about pricing!

Our cars are competitively priced with:
✅ Transparent pricing (no hidden fees)
✅ Financing options available
✅ Trade-in evaluations
✅ Extended warranties

Want a personalized quote?
Tell me your budget range and I'll find perfect matches!

Or call directly: +351 XXX XXX XXX`;

    await this.sendWhatsAppMessage(phone, message);
  }

  static async handleVisitRequest(phone, leadId) {
    const message = `🏢 Perfect! We'd love to show you our cars.

📍 Showroom Address:
[Your showroom address here]

🕒 Opening Hours:
Mon-Fri: 9:00-19:00
Saturday: 9:00-17:00
Sunday: 10:00-16:00

📞 To schedule immediately:
Call: +351 XXX XXX XXX

Or reply "SCHEDULE" and I'll have someone call you within the hour!`;

    await this.sendWhatsAppMessage(phone, message);
  }

  static async extractCarIdFromMessage(message, leadId) {
    // Logic to extract car references from messages
    // Could match plate numbers, "car 1", "first one", etc.
    return []; // Placeholder
  }

  static async sendWhatsAppMessage(phone, message) {
    // This would call your actual WhatsApp API
    console.log(`📱 Sending to ${phone}: ${message.substring(0, 50)}...`);
  }
}

module.exports = { AutomationMaster };