function Box({ label, children }) {
  return (
    <div style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:14 }}>
      <div style={{ fontSize:9, color:'var(--text-muted)', letterSpacing:1.5, marginBottom:7 }}>{label}</div>
      {children}
    </div>
  )
}
const posColor = p => p==='exit'?'var(--danger)':p==='consider'?'var(--success)':'var(--accent)'
const posBg    = p => p==='exit'?'var(--danger-bg)':p==='consider'?'var(--success-bg)':'var(--accent-bg)'

export default function InvestorTab({ data }) {
  const { score, signals, briefs } = data
  const inv = briefs?.investor
  if (!inv) return null
  const bpCol = inv.bankruptcy_probability>=70?'var(--danger)':inv.bankruptcy_probability>=40?'var(--accent)':'var(--success)'
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Box label="BANKRUPTCY PROBABILITY"><div style={{ fontSize:28, fontWeight:600, color:bpCol }}>{inv.bankruptcy_probability}%</div><div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>12-month horizon</div></Box>
        <Box label="INSIDER SELL RATIO"><div style={{ fontSize:28, fontWeight:600, color:signals?.insider_sell_ratio>0.8?'var(--danger)':'var(--text-primary)' }}>{Math.round((signals?.insider_sell_ratio||0)*100)}%</div><div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>Form 4 — last 6 months</div></Box>
        <Box label="NEWS SENTIMENT"><div style={{ fontSize:28, fontWeight:600, color:signals?.news_sentiment_score<-0.3?'var(--danger)':'var(--success)' }}>{signals?.news_sentiment_score>0?'+':''}{(signals?.news_sentiment_score||0).toFixed(2)}</div><div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>{signals?.news_article_count||0} articles</div></Box>
        <Box label="MACRO CONTEXT"><div style={{ fontSize:11, color:'var(--text-secondary)', lineHeight:1.6, marginTop:4 }}>{signals?.macro_context||'N/A'}</div></Box>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        {[{label:'LONG EQUITY',pos:inv.equity_position},{label:'BONDS / CREDIT',pos:inv.credit_position},{label:'PUT OPTIONS',pos:inv.options_signal?.toLowerCase().includes('worth')?'consider':'hold'}].map(({label,pos})=>(
          <div key={label} style={{ flex:1, background:posBg(pos), border:`0.5px solid ${posColor(pos)}`, borderRadius:'var(--radius)', padding:14, textAlign:'center' }}>
            <div style={{ fontSize:9, color:posColor(pos), letterSpacing:1.5, marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:18, color:posColor(pos), fontWeight:600, textTransform:'uppercase' }}>{pos}</div>
          </div>
        ))}
      </div>
      <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--accent-border)', borderRadius:'var(--radius)', padding:16 }}>
        <div style={{ fontSize:9, color:'var(--accent)', letterSpacing:1.5, marginBottom:10 }}>POSITION BRIEF</div>
        <div style={{ fontSize:12, color:'var(--text-primary)', lineHeight:1.7, marginBottom:10 }}>{inv.position_rationale}</div>
        <div style={{ fontSize:11, color:'var(--text-muted)', fontStyle:'italic' }}>{inv.options_signal}</div>
        <div style={{ marginTop:10, fontSize:10, color:'#3a3a38' }}>Confidence: {Math.round((inv.confidence||0)*100)}%</div>
      </div>
    </div>
  )
}
