// Automation System Dashboard & Analytics
// netlify/functions/automation-dashboard.js

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
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get automation system overview
    const dashboard = await generateAutomationDashboard(supabase);
    
    // Return HTML dashboard
    const html = generateDashboardHTML(dashboard);
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'text/html',
      },
      body: html
    };

  } catch (error) {
    console.error('Dashboard error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Dashboard generation failed',
        message: error.message
      })
    };
  }
};

async function generateAutomationDashboard(supabase) {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Lead statistics
  const { data: totalLeads } = await supabase
    .from('leads')
    .select('id, created_at, source, intent, automation_status_reason, meta')
    .eq('source', 'whatsapp');

  const { data: todaysLeads } = await supabase
    .from('leads')
    .select('id')
    .eq('source', 'whatsapp')
    .gte('created_at', today.toISOString().split('T')[0]);

  const { data: hotLeads } = await supabase
    .from('leads')
    .select('id, phone, meta')
    .eq('source', 'whatsapp')
    .in('automation_status_reason', ['hot_lead', 'purchase_intent']);

  // Car inventory stats
  const { data: totalCars } = await supabase
    .from('cars')
    .select('id, price, created_at, demand_count')
    .eq('is_active', true);

  const { data: newArrivals } = await supabase
    .from('cars')
    .select('id, make, model, price')
    .eq('is_active', true)
    .gte('created_at', weekAgo.toISOString());

  // Calculate metrics
  const metrics = {
    leads: {
      total: totalLeads?.length || 0,
      today: todaysLeads?.length || 0,
      hot: hotLeads?.length || 0,
      conversion_rate: calculateConversionRate(totalLeads)
    },
    inventory: {
      total: totalCars?.length || 0,
      value: totalCars?.reduce((sum, car) => sum + (car.price || 0), 0) || 0,
      new_arrivals: newArrivals?.length || 0,
      avg_demand: totalCars?.reduce((sum, car) => sum + (car.demand_count || 0), 0) / (totalCars?.length || 1)
    },
    automation: {
      active_campaigns: calculateActiveCampaigns(totalLeads),
      messages_today: calculateMessagesToday(totalLeads),
      recommendation_matches: calculateRecommendationMatches(totalLeads)
    }
  };

  return { metrics, hotLeads, newArrivals, totalLeads: totalLeads?.slice(0, 10) };
}

function calculateConversionRate(leads) {
  if (!leads || leads.length === 0) return 0;
  const converted = leads.filter(lead => 
    lead.automation_status_reason === 'converted' || 
    lead.intent === 'purchase_intent'
  ).length;
  return ((converted / leads.length) * 100).toFixed(1);
}

function calculateActiveCampaigns(leads) {
  if (!leads) return 0;
  return leads.filter(lead => {
    const meta = JSON.parse(lead.meta || '{}');
    return meta.automated_follow_ups && meta.automated_follow_ups.length > 0;
  }).length;
}

function calculateMessagesToday(leads) {
  const today = new Date().toISOString().split('T')[0];
  if (!leads) return 0;
  return leads.filter(lead => 
    lead.created_at && lead.created_at.startsWith(today)
  ).length;
}

function calculateRecommendationMatches(leads) {
  if (!leads) return 0;
  return leads.filter(lead => {
    const meta = JSON.parse(lead.meta || '{}');
    return meta.car_preferences && Object.keys(meta.car_preferences).length > 0;
  }).length;
}

function generateDashboardHTML(dashboard) {
  const { metrics, hotLeads, newArrivals } = dashboard;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🤖 AutoTrust - Automation Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #2c3e50, #34495e);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .header p { opacity: 0.9; font-size: 1.1rem; }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            padding: 30px;
        }
        .metric-card {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            border-left: 4px solid #007bff;
        }
        .metric-card h3 { color: #495057; margin-bottom: 15px; }
        .metric-value { font-size: 2rem; font-weight: bold; color: #007bff; }
        .metric-label { color: #6c757d; margin-top: 5px; }
        .hot-leads, .new-arrivals {
            padding: 30px;
            border-top: 1px solid #dee2e6;
        }
        .section-title { 
            font-size: 1.5rem; 
            margin-bottom: 20px; 
            color: #495057;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .lead-item, .car-item {
            background: #f8f9fa;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            border-left: 4px solid #28a745;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: bold;
            margin-left: 10px;
        }
        .hot { background: #dc3545; color: white; }
        .new { background: #007bff; color: white; }
        .footer {
            background: #343a40;
            color: white;
            padding: 20px;
            text-align: center;
        }
        .refresh-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            margin-top: 10px;
        }
        .refresh-btn:hover { background: #0056b3; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 AutoTrust Automation Dashboard</h1>
            <p>Real-time automotive business intelligence & automation monitoring</p>
            <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Data</button>
        </div>

        <div class="metrics">
            <div class="metric-card">
                <h3>📱 WhatsApp Leads</h3>
                <div class="metric-value">${metrics.leads.total}</div>
                <div class="metric-label">Total Leads</div>
                <div class="metric-label">Today: ${metrics.leads.today} | Hot: ${metrics.leads.hot}</div>
            </div>
            
            <div class="metric-card">
                <h3>🚗 Car Inventory</h3>
                <div class="metric-value">${metrics.inventory.total}</div>
                <div class="metric-label">Active Cars</div>
                <div class="metric-label">€${metrics.inventory.value.toLocaleString()} Total Value</div>
            </div>
            
            <div class="metric-card">
                <h3>📊 Conversion Rate</h3>
                <div class="metric-value">${metrics.leads.conversion_rate}%</div>
                <div class="metric-label">Lead to Purchase</div>
                <div class="metric-label">Active Campaigns: ${metrics.automation.active_campaigns}</div>
            </div>
            
            <div class="metric-card">
                <h3>🤖 Automation Activity</h3>
                <div class="metric-value">${metrics.automation.messages_today}</div>
                <div class="metric-label">Messages Today</div>
                <div class="metric-label">Matches: ${metrics.automation.recommendation_matches}</div>
            </div>
        </div>

        <div class="hot-leads">
            <h2 class="section-title">🔥 Hot Leads</h2>
            ${hotLeads && hotLeads.length > 0 ? 
                hotLeads.map(lead => `
                    <div class="lead-item">
                        📞 ${lead.phone}
                        <span class="status-badge hot">HOT</span>
                        <div style="margin-top: 5px; font-size: 0.9rem; color: #666;">
                            ${JSON.parse(lead.meta || '{}').last_whatsapp_message || 'No message'} 
                        </div>
                    </div>
                `).join('') : 
                '<p style="color: #666; font-style: italic;">No hot leads at the moment</p>'
            }
        </div>

        <div class="new-arrivals">
            <h2 class="section-title">🆕 New Arrivals This Week</h2>
            ${newArrivals && newArrivals.length > 0 ?
                newArrivals.map(car => `
                    <div class="car-item">
                        🚗 ${car.make} ${car.model}
                        <span class="status-badge new">NEW</span>
                        <div style="margin-top: 5px; font-size: 0.9rem; color: #666;">
                            €${car.price?.toLocaleString() || 'N/A'}
                        </div>
                    </div>
                `).join('') :
                '<p style="color: #666; font-style: italic;">No new arrivals this week</p>'
            }
        </div>

        <div class="footer">
            <p>🚀 Automotive Business Automation System - Live & Active</p>
            <p>Last updated: ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`;
}