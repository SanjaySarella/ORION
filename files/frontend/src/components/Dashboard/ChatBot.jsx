import { useState, useRef, useEffect } from 'react'
import { sendChat } from '../../utils/api'

export default function ChatBot({ data, role, onClose }) {
  const [messages, setMessages] = useState([
    { from:'ai', text:`I have analysed ${data.company.name}. The distress score is ${data.score.score}/100 — ${data.score.label}. What would you like to know?` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  const send = async () => {
    const msg = input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { from:'user', text:msg }])
    setLoading(true)
    try {
      const history = messages.map(m => ({ role:m.from==='user'?'user':'assistant', content:m.text }))
      const res = await sendChat(data.company.ticker, role, msg, history)
      setMessages(prev => [...prev, { from:'ai', text:res.answer }])
    } catch {
      setMessages(prev => [...prev, { from:'ai', text:'Something went wrong. Please try again.' }])
    } finally { setLoading(false) }
  }

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
  const roleLabel = { executive:'Executive', consultant:'Consultant', investor:'Investor', board:'Board' }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#fff', borderLeft:'1px solid var(--border)' }}>
      <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg-nav)' }}>
        <div>
          <p style={{ fontSize:13, fontWeight:600, color:'#fff' }}>Ask ORION</p>
          <p style={{ fontSize:11, color:'rgba(255,255,255,.5)', marginTop:2 }}>{data.company.ticker} · {roleLabel[role]} View</p>
        </div>
        <button onClick={onClose} style={{ background:'transparent', border:'none', color:'rgba(255,255,255,.5)', fontSize:20, lineHeight:1, padding:0, cursor:'pointer' }}>×</button>
      </div>
      <div style={{ flex:1, padding:14, display:'flex', flexDirection:'column', gap:10, overflowY:'auto' }}>
        {messages.map((m,i) => (
          <div key={i} style={m.from==='user' ? {
            background:'var(--green-light)', border:'1px solid var(--green-bdr)', borderRadius:'10px 10px 2px 10px',
            padding:'10px 13px', fontSize:13, color:'var(--text)', marginLeft:20, lineHeight:1.55
          } : {
            background:'var(--bg-subtle)', border:'1px solid var(--border)', borderRadius:'10px 10px 10px 2px',
            padding:'10px 13px', fontSize:13, color:'var(--text-2)', marginRight:20, lineHeight:1.55
          }}>
            {m.text}
          </div>
        ))}
        {loading && (
          <div style={{ background:'var(--bg-subtle)', border:'1px solid var(--border)', borderRadius:'10px 10px 10px 2px', padding:'10px 13px', fontSize:13, color:'var(--text-muted)', marginRight:20 }}>
            <i className="ti ti-dots spin" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding:'12px 14px', borderTop:'1px solid var(--border)', display:'flex', gap:8, alignItems:'flex-end' }}>
        <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey} placeholder="Ask a question about this analysis..." rows={2}
          style={{ flex:1, border:'1px solid var(--border-2)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:13, color:'var(--text)', outline:'none', resize:'none', fontFamily:'var(--font-sans)', lineHeight:1.5 }} />
        <button onClick={send} disabled={loading||!input.trim()} className="btn-primary" style={{ padding:'9px 14px', opacity:loading||!input.trim()?0.5:1, flexShrink:0 }}>
          <i className="ti ti-send" style={{ fontSize:15 }} />
        </button>
      </div>
    </div>
  )
}
