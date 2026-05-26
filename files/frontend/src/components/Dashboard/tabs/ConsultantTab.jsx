import TrajectoryChart from '../TrajectoryChart'

function Box({ label, children }) {
  return (
    <div style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:16 }}>
      <div style={{ fontSize:9, color:'var(--text-muted)', letterSpacing:1.5, marginBottom:8 }}>{label}</div>
      {children}
    </div>
  )
}

export default function ConsultantTab({ data }) {
  const { score, briefs, trajectory } = data
  const con = briefs?.consultant
  if (!con) return null
  const col = con.deal_rating==='red'?'var(--danger)':con.deal_rating==='amber'?'var(--accent)':'var(--success)'
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
        <Box label="DEAL RISK RATING"><div style={{ fontSize:28, fontWeight:600, color:col, textTransform:'uppercase' }}>{con.deal_rating}</div><div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>{con.deal_rating==='red'?'Do not engage':con.deal_rating==='amber'?'Proceed with caution':'Proceed normally'}</div></Box>
        <Box label="PATTERN MATCH"><div style={{ fontSize:28, fontWeight:600, color:'var(--accent)' }}>{con.pattern_match_pct}%</div><div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>{con.matched_company||'No match'}</div></Box>
        <Box label="DISTRESS SCORE"><div style={{ fontSize:28, fontWeight:600, color:'var(--text-primary)' }}>{score.score}</div><div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>{score.label}</div></Box>
      </div>
      <TrajectoryChart trajectory={trajectory} />
      <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--accent-border)', borderRadius:'var(--radius)', padding:16 }}>
        <div style={{ fontSize:9, color:'var(--accent)', letterSpacing:1.5, marginBottom:10 }}>CLIENT RECOMMENDATION BRIEF — SLIDE-READY</div>
        <div style={{ fontSize:12, color:'var(--text-primary)', lineHeight:1.7, marginBottom:12 }}>{con.recommendation}</div>
        <div style={{ background:'var(--bg-primary)', borderLeft:'2px solid var(--accent)', borderRadius:'0 4px 4px 0', padding:'10px 14px', fontSize:11, color:'var(--text-muted)', fontStyle:'italic' }}>{con.slide_summary}</div>
        <div style={{ marginTop:10, fontSize:10, color:'#3a3a38' }}>Confidence: {Math.round((con.confidence||0)*100)}% · SEC EDGAR</div>
      </div>
    </div>
  )
}
