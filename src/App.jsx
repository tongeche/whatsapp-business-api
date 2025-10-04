import { useState, useEffect } from 'react'

export default function App() {
  const [to, setTo] = useState('')
  const [body, setBody] = useState('')
  const [resp, setResp] = useState(null)
  const [loading, setLoading] = useState(false)
  const [leads, setLeads] = useState([])
  const [activeTab, setActiveTab] = useState('send')

  async function send(e) {
    e.preventDefault()
    setLoading(true)
    setResp(null)
    try {
      const r = await fetch('/api/send-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, body })
      })
      const data = await r.json()
      setResp(data)
    } catch (err) {
      setResp({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function sendTemplate(e) {
    e.preventDefault()
    setLoading(true)
    setResp(null)
    try {
      const r = await fetch('/api/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to })
      })
      const data = await r.json()
      setResp(data)
    } catch (err) {
      setResp({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function loadLeads() {
    try {
      const r = await fetch('/api/get-leads')
      const data = await r.json()
      if (data.success) {
        setLeads(data.leads)
      }
    } catch (err) {
      console.error('Failed to load leads:', err)
    }
  }

  useEffect(() => {
    if (activeTab === 'leads') {
      loadLeads()
    }
  }, [activeTab])

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', fontFamily: 'Inter, system-ui' }}>
      <h1>🚗 AutoTrust WhatsApp Business Hub</h1>
      
      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #e5e7eb' }}>
        <button 
          onClick={() => setActiveTab('send')}
          style={{ 
            padding: '8px 16px', 
            border: 'none', 
            background: activeTab === 'send' ? '#3b82f6' : 'transparent',
            color: activeTab === 'send' ? 'white' : '#374151',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer'
          }}
        >
          📤 Send Message
        </button>
        <button 
          onClick={() => setActiveTab('leads')}
          style={{ 
            padding: '8px 16px', 
            border: 'none', 
            background: activeTab === 'leads' ? '#3b82f6' : 'transparent',
            color: activeTab === 'leads' ? 'white' : '#374151',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer'
          }}
        >
          👥 WhatsApp Leads ({leads.length})
        </button>
      </div>

      {activeTab === 'send' && (
        <div>
          <h2>Send WhatsApp Message</h2>
          <form onSubmit={send} style={{ display: 'grid', gap: 12 }}>
            <label>
              To (E.164)  
              <input
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="351931608896"
                style={{ width: '100%', padding: 8, marginTop: 4 }}
                required
              />
            </label>
            <label>
              Message  
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={4}
                placeholder="Hello from AutoTrust! 🚗"
                style={{ width: '100%', padding: 8, marginTop: 4 }}
                required
              />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={loading} style={{ padding: '10px 14px', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', flex: 1 }}>
                {loading ? 'Sending…' : 'Send Custom Message'}
              </button>
              <button 
                disabled={loading} 
                onClick={(e) => sendTemplate(e)}
                style={{ padding: '10px 14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', flex: 1 }}
              >
                {loading ? 'Sending…' : 'Send Template (Works Now!)'}
              </button>
            </div>
          </form>

          {resp && (
            <pre style={{ background: '#f6f8fa', padding: 12, marginTop: 16, overflowX: 'auto', borderRadius: 4 }}>
{JSON.stringify(resp, null, 2)}
            </pre>
          )}
        </div>
      )}

      {activeTab === 'leads' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2>WhatsApp Leads</h2>
            <button 
              onClick={loadLeads}
              style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              🔄 Refresh
            </button>
          </div>
          
          {leads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, background: '#f9fafb', borderRadius: 8, color: '#6b7280' }}>
              <p>📱 No WhatsApp leads yet. Send a message to your WhatsApp Business number to create your first lead!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {leads.map(lead => (
                <div key={lead.id} style={{ 
                  padding: 16, 
                  border: '1px solid #e5e7eb', 
                  borderRadius: 8, 
                  background: 'white',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'start', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                        {lead.name || 'Anonymous Lead'} 
                        <span style={{ marginLeft: 8, fontSize: 12, padding: '2px 6px', background: getStatusColor(lead.status), color: 'white', borderRadius: 12 }}>
                          {lead.status}
                        </span>
                      </h3>
                      <p style={{ margin: '4px 0', color: '#6b7280', fontSize: 14 }}>
                        📞 {lead.phone} | 🎯 {lead.intent}
                      </p>
                    </div>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>
                      {new Date(lead.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {lead.meta && JSON.parse(lead.meta).first_message && (
                    <div style={{ background: '#f3f4f6', padding: 8, borderRadius: 4, fontSize: 14 }}>
                      <strong>First message:</strong> "{JSON.parse(lead.meta).first_message}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )

  function getStatusColor(status) {
    switch(status) {
      case 'new': return '#059669'
      case 'qualified': return '#3b82f6'  
      case 'hot': return '#dc2626'
      case 'converted': return '#7c3aed'
      default: return '#6b7280'
    }
  }
}

