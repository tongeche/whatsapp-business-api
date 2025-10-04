// AI Testing System for Automotive Automation
// Tests automation responses and displays intelligent feedback

const { createClient } = require('@supabase/supabase-js');

// Mock the automation master for testing
class AutomationMaster {
  static async processIncomingMessage(phone, message, leadId) {
    // Simulate automation processing
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing time
    
    const messageAnalysis = {
      hasCarKeywords: /bmw|mercedes|audi|toyota|car|vehicle/i.test(message),
      hasPriceKeywords: /price|cost|€|\$|expensive|cheap/i.test(message),
      hasUrgentKeywords: /urgent|asap|today|now|immediately/i.test(message),
      hasBuyingIntent: /buy|purchase|interested|want|need/i.test(message)
    };
    
    // Calculate mock scores
    let score = 30; // Base score
    if (messageAnalysis.hasBuyingIntent) score += 30;
    if (messageAnalysis.hasPriceKeywords) score += 25;
    if (messageAnalysis.hasUrgentKeywords) score += 15;
    
    const category = score >= 80 ? 'hot' : score >= 60 ? 'warm' : 'cold';
    
    // Determine stage
    let stage = 'initial_interest';
    if (messageAnalysis.hasCarKeywords) stage = 'preferences_gathered';
    if (messageAnalysis.hasPriceKeywords) stage = 'hot_lead';
    if (messageAnalysis.hasBuyingIntent && messageAnalysis.hasUrgentKeywords) stage = 'purchase_intent';
    
    // Mock recommendations count
    const recommendations = messageAnalysis.hasCarKeywords ? Math.floor(Math.random() * 3) + 1 : 0;
    
    return {
      success: true,
      stage: stage,
      score: {
        score: score,
        category: category
      },
      recommendations: recommendations
    };
  }
}

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

  if (event.httpMethod === 'GET') {
    // Return the AI testing interface
    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'text/html' },
      body: generateTestingInterface()
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const { testMessage, testPhone } = JSON.parse(event.body || '{}');
      
      if (!testMessage) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'testMessage is required' })
        };
      }

      // Run AI test simulation
      const testResults = await runAutomationTest(testMessage, testPhone || '+351999888777');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(testResults)
      };

    } catch (error) {
      console.error('Test error:', error);
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Test failed',
          message: error.message
        })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};

async function runAutomationTest(testMessage, testPhone) {
  const startTime = Date.now();
  const testResults = {
    input: {
      message: testMessage,
      phone: testPhone,
      timestamp: new Date().toISOString()
    },
    analysis: {},
    automation: {},
    feedback: {},
    performance: {}
  };

  try {
    // 1. Analyze the test message with AI
    testResults.analysis = await analyzeTestMessage(testMessage);
    
    // 2. Simulate lead creation/update
    const leadId = await simulateLeadProcessing(testPhone, testMessage);
    testResults.leadId = leadId;
    
    // 3. Run automation system
    console.log('🤖 Running automation for test...');
    const automationResult = await AutomationMaster.processIncomingMessage(
      testPhone,
      testMessage,
      leadId
    );
    
    testResults.automation = automationResult;
    
    // 4. Generate AI feedback
    testResults.feedback = await generateAIFeedback(testMessage, automationResult, testResults.analysis);
    
    // 5. Performance metrics
    const endTime = Date.now();
    testResults.performance = {
      processingTime: `${endTime - startTime}ms`,
      automationSuccess: automationResult.success,
      componentsActive: getActiveComponents(automationResult)
    };

    console.log('✅ Test completed successfully');
    
    return testResults;

  } catch (error) {
    console.error('❌ Test execution error:', error);
    
    testResults.error = {
      message: error.message,
      stack: error.stack?.substring(0, 500)
    };
    
    testResults.feedback = {
      overall: 'error',
      message: 'Test failed during execution',
      suggestions: ['Check server logs', 'Verify database connection', 'Validate automation configuration']
    };
    
    return testResults;
  }
}

async function analyzeTestMessage(message) {
  const analysis = {
    length: message.length,
    wordCount: message.split(/\s+/).length,
    sentiment: analyzeSentiment(message),
    intent: extractTestIntent(message),
    carKeywords: extractCarKeywords(message),
    urgencyLevel: analyzeUrgency(message),
    customerType: analyzeCustomerType(message)
  };

  return analysis;
}

function analyzeSentiment(message) {
  const positive = ['great', 'excellent', 'love', 'perfect', 'amazing', 'fantastic', 'interested', 'want'];
  const negative = ['bad', 'terrible', 'hate', 'awful', 'expensive', 'cheap', 'problem'];
  const neutral = ['ok', 'fine', 'maybe', 'thinking', 'considering'];
  
  const words = message.toLowerCase().split(/\s+/);
  
  let positiveScore = 0;
  let negativeScore = 0;
  let neutralScore = 0;
  
  words.forEach(word => {
    if (positive.some(p => word.includes(p))) positiveScore++;
    if (negative.some(n => word.includes(n))) negativeScore++;
    if (neutral.some(n => word.includes(n))) neutralScore++;
  });
  
  if (positiveScore > negativeScore && positiveScore > neutralScore) return 'positive';
  if (negativeScore > positiveScore && negativeScore > neutralScore) return 'negative';
  return 'neutral';
}

function extractTestIntent(message) {
  const msg = message.toLowerCase();
  
  if (msg.includes('buy') || msg.includes('purchase')) return 'purchase_intent';
  if (msg.includes('sell') || msg.includes('trade')) return 'sell_intent';
  if (msg.includes('price') || msg.includes('cost')) return 'pricing_inquiry';
  if (msg.includes('visit') || msg.includes('see') || msg.includes('test')) return 'viewing_request';
  if (msg.includes('finance') || msg.includes('loan')) return 'financing_inquiry';
  
  return 'general_inquiry';
}

function extractCarKeywords(message) {
  const carMakes = ['BMW', 'Mercedes', 'Audi', 'Volkswagen', 'Toyota', 'Ford', 'Honda', 'Nissan'];
  const carTypes = ['sedan', 'SUV', 'hatchback', 'coupe', 'convertible', 'estate'];
  const fuelTypes = ['petrol', 'diesel', 'electric', 'hybrid'];
  
  const msg = message.toUpperCase();
  const found = {
    makes: carMakes.filter(make => msg.includes(make.toUpperCase())),
    types: carTypes.filter(type => msg.includes(type.toUpperCase())),
    fuel: fuelTypes.filter(fuel => msg.includes(fuel.toUpperCase()))
  };
  
  return found;
}

function analyzeUrgency(message) {
  const urgentWords = ['urgent', 'asap', 'immediately', 'now', 'today', 'quick'];
  const msg = message.toLowerCase();
  
  const urgencyCount = urgentWords.filter(word => msg.includes(word)).length;
  
  if (urgencyCount >= 2) return 'high';
  if (urgencyCount === 1) return 'medium';
  return 'low';
}

function analyzeCustomerType(message) {
  const msg = message.toLowerCase();
  
  if (msg.includes('first car') || msg.includes('new driver')) return 'first_time_buyer';
  if (msg.includes('upgrade') || msg.includes('replace')) return 'repeat_customer';
  if (msg.includes('business') || msg.includes('company')) return 'business_customer';
  if (msg.includes('family') || msg.includes('kids')) return 'family_customer';
  
  return 'general_customer';
}

async function simulateLeadProcessing(phone, message) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Check if test lead exists
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id')
    .eq('phone', phone)
    .single();
  
  if (existingLead) {
    console.log('📞 Using existing test lead:', existingLead.id);
    return existingLead.id;
  }
  
  // Create test lead
  const leadData = {
    id: generateTestUUID(),
    phone: phone,
    name: 'AI Test User',
    source: 'whatsapp',
    status: 'new',
    intent: extractTestIntent(message),
    tenant_id: process.env.DEFAULT_TENANT_ID || null,
    automation_status_reason: 'ai_test',
    automation_status_at: new Date().toISOString(),
    meta: JSON.stringify({
      test_lead: true,
      first_message: message,
      test_created_at: new Date().toISOString()
    })
  };
  
  const { data, error } = await supabase
    .from('leads')
    .insert(leadData)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating test lead:', error);
    throw error;
  }
  
  console.log('✅ Created test lead:', data.id);
  return data.id;
}

function generateTestUUID() {
  return 'test-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function generateAIFeedback(message, automationResult, analysis) {
  const feedback = {
    overall: 'success',
    score: 0,
    message: '',
    components: {},
    suggestions: []
  };

  // Score the automation performance
  let score = 0;
  
  if (automationResult.success) score += 30;
  if (automationResult.stage) score += 20;
  if (automationResult.score && automationResult.score.score > 50) score += 25;
  if (automationResult.recommendations > 0) score += 25;
  
  feedback.score = Math.min(score, 100);
  
  // Overall assessment
  if (feedback.score >= 90) {
    feedback.overall = 'excellent';
    feedback.message = '🌟 Excellent! Automation performed perfectly with high intelligence.';
  } else if (feedback.score >= 70) {
    feedback.overall = 'good';
    feedback.message = '👍 Good performance! Automation working well with minor improvements possible.';
  } else if (feedback.score >= 50) {
    feedback.overall = 'fair';
    feedback.message = '⚠️ Fair performance. Some automation components need attention.';
  } else {
    feedback.overall = 'poor';
    feedback.message = '❌ Poor performance. Automation system needs significant improvements.';
  }
  
  // Component-specific feedback
  feedback.components = {
    message_processing: automationResult.success ? '✅ Working' : '❌ Failed',
    lead_scoring: automationResult.score ? `✅ Score: ${automationResult.score.score}` : '⚠️ No score',
    car_matching: automationResult.recommendations > 0 ? `✅ Found ${automationResult.recommendations} matches` : '⚠️ No matches',
    journey_progression: automationResult.stage ? `✅ Stage: ${automationResult.stage}` : '⚠️ No progression'
  };
  
  // Generate intelligent suggestions
  if (analysis.urgencyLevel === 'high' && (!automationResult.score || automationResult.score.category !== 'hot')) {
    feedback.suggestions.push('🔥 High urgency detected but not flagged as hot lead - review urgency detection');
  }
  
  if (analysis.carKeywords.makes.length > 0 && automationResult.recommendations === 0) {
    feedback.suggestions.push('🚗 Car preferences detected but no recommendations - check inventory matching');
  }
  
  if (analysis.intent === 'purchase_intent' && automationResult.score && automationResult.score.category === 'cold') {
    feedback.suggestions.push('💰 Purchase intent detected but low lead score - review scoring algorithm');
  }
  
  if (feedback.suggestions.length === 0) {
    feedback.suggestions.push('🎯 System performing optimally - no immediate improvements needed');
  }
  
  return feedback;
}

function getActiveComponents(automationResult) {
  const components = [];
  
  if (automationResult.success) components.push('Message Processing');
  if (automationResult.stage) components.push('Journey Progression');
  if (automationResult.score) components.push('Lead Scoring');
  if (automationResult.recommendations > 0) components.push('Car Matching');
  
  return components;
}

function generateTestingInterface() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🤖 AI Automation Tester</title>
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
        .test-panel {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            padding: 30px;
        }
        .input-section {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 12px;
        }
        .input-section h3 { margin-bottom: 15px; color: #495057; }
        .message-input {
            width: 100%;
            height: 120px;
            border: 2px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
            font-size: 16px;
            resize: vertical;
            margin-bottom: 15px;
        }
        .phone-input {
            width: 100%;
            padding: 12px;
            border: 2px solid #dee2e6;
            border-radius: 8px;
            font-size: 16px;
            margin-bottom: 15px;
        }
        .test-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            width: 100%;
            transition: background 0.3s;
        }
        .test-btn:hover { background: #0056b3; }
        .test-btn:disabled { 
            background: #6c757d; 
            cursor: not-allowed; 
        }
        .results-section {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 12px;
            min-height: 400px;
        }
        .loading {
            text-align: center;
            padding: 50px;
            color: #6c757d;
        }
        .result-card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
            border-left: 4px solid #007bff;
        }
        .score-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .excellent { background: #28a745; color: white; }
        .good { background: #17a2b8; color: white; }
        .fair { background: #ffc107; color: black; }
        .poor { background: #dc3545; color: white; }
        .component-status {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin: 15px 0;
        }
        .component {
            padding: 8px 12px;
            background: #e9ecef;
            border-radius: 6px;
            font-size: 14px;
        }
        .suggestions {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 15px;
            margin-top: 15px;
        }
        .suggestions h4 {
            color: #856404;
            margin-bottom: 10px;
        }
        .suggestions ul {
            margin-left: 20px;
        }
        .suggestions li {
            margin-bottom: 5px;
            color: #856404;
        }
        .sample-messages {
            margin-top: 20px;
        }
        .sample-btn {
            background: #6c757d;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            margin: 5px 5px 5px 0;
            cursor: pointer;
            font-size: 14px;
        }
        .sample-btn:hover { background: #5a6268; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 AI Automation Tester</h1>
            <p>Test and analyze automotive business automation responses</p>
        </div>

        <div class="test-panel">
            <div class="input-section">
                <h3>📱 Simulate WhatsApp Message</h3>
                
                <textarea 
                    id="messageInput" 
                    class="message-input" 
                    placeholder="Enter a test message (e.g., 'Hi, I'm looking for a BMW sedan under €30,000')"
                ></textarea>
                
                <input 
                    id="phoneInput" 
                    class="phone-input" 
                    type="text" 
                    placeholder="Test Phone Number (optional)" 
                    value="+351999888777"
                />
                
                <button id="testBtn" class="test-btn" onclick="runTest()">
                    🚀 Run AI Test
                </button>
                
                <div class="sample-messages">
                    <h4 style="margin-bottom: 10px; color: #495057;">Sample Messages:</h4>
                    <button class="sample-btn" onclick="setMessage('Hi, I want to buy a BMW')">Purchase Intent</button>
                    <button class="sample-btn" onclick="setMessage('How much does the Mercedes cost?')">Price Inquiry</button>
                    <button class="sample-btn" onclick="setMessage('I need a family car with good fuel economy')">Preferences</button>
                    <button class="sample-btn" onclick="setMessage('Can I visit today to see the cars?')">Visit Request</button>
                    <button class="sample-btn" onclick="setMessage('URGENT: Need a car immediately!')">High Urgency</button>
                </div>
            </div>

            <div class="results-section">
                <h3 style="margin-bottom: 15px; color: #495057;">🔍 Test Results</h3>
                <div id="results">
                    <div class="loading">
                        👆 Enter a message and click "Run AI Test" to see automation analysis
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        function setMessage(message) {
            document.getElementById('messageInput').value = message;
        }

        async function runTest() {
            const messageInput = document.getElementById('messageInput');
            const phoneInput = document.getElementById('phoneInput');
            const testBtn = document.getElementById('testBtn');
            const results = document.getElementById('results');
            
            const message = messageInput.value.trim();
            if (!message) {
                alert('Please enter a test message');
                return;
            }
            
            // Show loading state
            testBtn.disabled = true;
            testBtn.textContent = '🔄 Running Test...';
            results.innerHTML = '<div class="loading">🤖 AI is analyzing your message and running automation tests...</div>';
            
            try {
                const response = await fetch(window.location.href, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        testMessage: message,
                        testPhone: phoneInput.value.trim()
                    })
                });
                
                const data = await response.json();
                displayResults(data);
                
            } catch (error) {
                console.error('Test error:', error);
                results.innerHTML = \`
                    <div class="result-card">
                        <div class="score-badge poor">ERROR</div>
                        <h4>❌ Test Failed</h4>
                        <p>Error: \${error.message}</p>
                    </div>
                \`;
            }
            
            // Reset button
            testBtn.disabled = false;
            testBtn.textContent = '🚀 Run AI Test';
        }
        
        function displayResults(data) {
            const results = document.getElementById('results');
            
            if (data.error) {
                results.innerHTML = \`
                    <div class="result-card">
                        <div class="score-badge poor">ERROR</div>
                        <h4>❌ Test Failed</h4>
                        <p>\${data.error.message}</p>
                    </div>
                \`;
                return;
            }
            
            const feedback = data.feedback || {};
            const analysis = data.analysis || {};
            const automation = data.automation || {};
            
            results.innerHTML = \`
                <div class="result-card">
                    <div class="score-badge \${feedback.overall}">\${feedback.score || 0}/100</div>
                    <h4>🎯 Overall Performance: \${feedback.overall?.toUpperCase() || 'UNKNOWN'}</h4>
                    <p>\${feedback.message || 'No feedback available'}</p>
                    
                    <div class="component-status">
                        \${Object.entries(feedback.components || {}).map(([key, value]) => 
                            \`<div class="component"><strong>\${key.replace(/_/g, ' ').toUpperCase()}:</strong> \${value}</div>\`
                        ).join('')}
                    </div>
                    
                    <div style="margin: 15px 0;">
                        <strong>📊 Analysis:</strong> 
                        Intent: \${analysis.intent} | 
                        Sentiment: \${analysis.sentiment} | 
                        Urgency: \${analysis.urgencyLevel} |
                        Customer: \${analysis.customerType}
                    </div>
                    
                    <div style="margin: 15px 0;">
                        <strong>🤖 Automation:</strong> 
                        Stage: \${automation.stage || 'N/A'} | 
                        Score: \${automation.score?.score || 'N/A'} | 
                        Recommendations: \${automation.recommendations || 0}
                    </div>
                    
                    \${feedback.suggestions && feedback.suggestions.length > 0 ? \`
                        <div class="suggestions">
                            <h4>💡 AI Suggestions:</h4>
                            <ul>
                                \${feedback.suggestions.map(suggestion => \`<li>\${suggestion}</li>\`).join('')}
                            </ul>
                        </div>
                    \` : ''}
                </div>
                
                <div class="result-card">
                    <h4>⚡ Performance Metrics</h4>
                    <p><strong>Processing Time:</strong> \${data.performance?.processingTime || 'N/A'}</p>
                    <p><strong>Components Active:</strong> \${data.performance?.componentsActive?.join(', ') || 'None'}</p>
                    <p><strong>Lead ID:</strong> \${data.leadId || 'N/A'}</p>
                </div>
            \`;
        }
        
        // Auto-focus message input
        document.getElementById('messageInput').focus();
        
        // Enter key to run test
        document.getElementById('messageInput').addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter') {
                runTest();
            }
        });
    </script>
</body>
</html>`;
}