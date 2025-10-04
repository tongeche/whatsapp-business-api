// Netlify Function: Automated Cron Jobs for Business Automation
// Deploy this as netlify/functions/automation-cron.js

const { AutomationMaster } = require('../lib/automation-master');

exports.handler = async (event, context) => {
  console.log('🤖 Automation cron job triggered');
  
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { interval = 'hourly' } = event.queryStringParameters || {};
    
    let result;
    
    if (interval === 'daily') {
      // Run comprehensive daily automations
      result = await AutomationMaster.runDailyAutomations();
      
    } else if (interval === 'hourly') {
      // Run frequent check automations
      result = await AutomationMaster.runHourlyAutomations();
      
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid interval. Use "hourly" or "daily"'
        })
      };
    }

    // Log successful automation run
    console.log(`✅ ${interval} automation completed:`, result);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        interval,
        timestamp: new Date().toISOString(),
        result
      })
    };

  } catch (error) {
    console.error('❌ Automation cron error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Automation failed',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};