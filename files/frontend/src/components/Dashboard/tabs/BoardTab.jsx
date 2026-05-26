function Box({ label, children }) {
  return (
    <div style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:14 }}>
      <div style={{ fontSize:9, color:'var(--text-muted)', letterSpacing:1.5, marginBottom:7 }}>{label}</div>
      {children}
    </div>
  )
}

export default function BoardTab({ data }) {
  const { signals, briefs } = data
  const brd = briefs?.board
  if (!brd) return null
  const lvlCol = brd.escalation_level>=4?'var(--danger)':brd.escalation_level>=3?'var(--accent)':brd.escalation_level>=2?'#D4891E':'var(--success)'
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Box label="ESCALATION LEVEL"><div style={{ fontSize:28, fontWeight:600, color:lvlCol }}>LEVEL {brd.escalation_level} / 4</div><div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>{brd.escalation_level>=4?'Board intervention required':brd.escalation_level>=3?'Urgent review required':brd.escalation_level>=2?'Board monitoring required':'Routine monitoring'}</div></Box>
        <Box label="GOING CONCERN"><div style={{ fontSize:20, fontWeight:600, color:signals?.going_concern_issued?'var(--danger)':'var(--success)' }}>{signals?.going_concern_issued?'ISSUED':'Not flagged'}</div><div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>10-K audit opinion scan</div></Box>
      </div>
      {brd.active_triggers?.length>0&&(
        <div style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:16 }}>
          <div style={{ fontSize:9, color:'var(--text-muted)', letterSpacing:1.5, marginBottom:12 }}>ESCALATION TRIGGER MATRIX</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {brd.active_triggers.map((t,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px', background:'var(--bg-secondary)', borderRadius:'var(--radius)', borderLeft:`2px solid ${i===0?'var(--danger)':'var(--accent)'}` }}>
                <i className={`ti ${i===0?'ti-alert-triangle':'ti-eye'}`} style={{ color:i===0?'var(--danger)':'var(--accent)', fontSize:16, flexShrink:0, marginTop:1 }} />
                <div style={{ fontSize:11, color:'var(--text-primary)', lineHeight:1.5, flex:1 }}>{t}</div>
                <span style={{ fontSize:9, color:i===0?'var(--danger)':'var(--accent)', border:'0.5px solid currentColor', padding:'2px 8px', borderRadius:3, flexShrink:0 }}>{i===0?'ACTIVE':'WATCH'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--accent-border)', borderRadius:'var(--radius)', padding:16 }}>
        <div style={{ fontSize:9, color:'var(--accent)', letterSpacing:1.5, marginBottom:10 }}>GOVERNANCE BRIEF</div>
        <div style={{ fontSize:12, color:'var(--text-primary)', lineHeight:1.7, marginBottom:10 }}>{brd.governance_brief}</div>
        <div style={{ fontSize:11, color:'var(--text-muted)', fontStyle:'italic', marginBottom:10 }}>{brd.regulatory_exposure}</div>
        <div style={{ fontSize:10, color:'#3a3a38' }}>Confidence: {Math.round((brd.confidence||0)*100)}%</div>
      </div>
    </div>
  )
}
