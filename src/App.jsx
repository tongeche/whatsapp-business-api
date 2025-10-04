import { useState } from 'react'

export default function App() {
  const [to, setTo] = useState('')
  const [body, setBody] = useState('')
  const [resp, setResp] = useState(null)
  const [loading, setLoading] = useState(false)

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

  return (
    <div style={{ maxWidth: 560, margin: '2rem auto', fontFamily: 'Inter, system-ui' }}>
      <h1>WhatsApp Cloud API — Quick Sender</h1>
      <form onSubmit={send} style={{ display: 'grid', gap: 12 }}>
        <label>
          To (E.164)  
          <input
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="2547XXXXXXXX"
            style={{ width: '100%', padding: 8 }}
            required
          />
        </label>
        <label>
          Message  
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={4}
            placeholder="Hello from the Cloud API 🎉"
            style={{ width: '100%', padding: 8 }}
            required
          />
        </label>
        <button disabled={loading} style={{ padding: '10px 14px' }}>
          {loading ? 'Sending…' : 'Send via WhatsApp'}
        </button>
      </form>

      {resp && (
        <pre style={{ background: '#f6f8fa', padding: 12, marginTop: 16, overflowX: 'auto' }}>
{JSON.stringify(resp, null, 2)}
        </pre>
      )}
    </div>
  )
}

