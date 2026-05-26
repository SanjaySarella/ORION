import ScoreGauge from '../ScoreGauge'
import ParameterGrid from '../ParameterGrid'
import TrajectoryChart from '../TrajectoryChart'
import { getScoreColor } from '../../../utils/api'

function MetricBox({ label, value, sub, col }) {
  return (
    <div style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:14 }}>
      <div style={{ fontSize:9, color:'var(--text-muted)', letterSpacing:1.5, marginBottom:7 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:500, color: col || 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>{sub}</div>}
    </div>
  )
}

export default function ExecutiveTab({ data }) {
  const { score, parameters: p, signals, trajectory, briefs } = data
  const exec = briefs?.executive
  const icov = p?.interest_coverage
  const curr = p?.current_ratio
  const ocf  = p?.ocf_vs_net_income

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
        <ScoreGauge score={score.score} label={score.label} criticalCount={score.critical_count} watchCount={score.watch_count} />
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <MetricBox label="INTEREST COVERAGE" value={icov?.display||'N/A'} sub="10-K Income Statement" col={icov?.flag==='critical'?'var(--danger)':icov?.flag==='watch'?'var(--accent)':'var(--success)'} />
          <MetricBox label="CURRENT RATIO"     value={curr?.display||'N/A'} sub="Threshold: 1.0"       col={curr?.flag==='critical'?'var(--danger)':curr?.flag==='watch'?'var(--accent)':'var(--success)'} />
          <MetricBox label="OCF VS NET INCOME" value={ocf?.display||'N/A'}  sub="Cash earnings quality" col={ocf?.flag==='critical'?'var(--danger)':'var(--success)'} />
          <MetricBox label="GOING CONCERN"     value={signals?.going_concern_issued?'FLAGGED':'Clear'} sub={signals?.going_concern_issued?'Auditor flagged doubt':'No auditor warning'} col={signals?.going_concern_issued?'var(--danger)':'var(--success)'} />
        </div>
      </div>
      <TrajectoryChart trajectory={trajectory} />
      <ParameterGrid parameters={p} />
      {exec && (
        <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--accent-border)', borderRadius:'var(--radius)', padding:16 }}>
          <div style={{ fontSize:9, color:'var(--accent)', letterSpacing:1.5, marginBottom:12 }}>EXECUTIVE ACTION BRIEF</div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {exec.action_items.map((item,i) => (
              <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <div style={{ width:22, height:22, borderRadius:'50%', background:`rgba(${i===0?'226,75,74':'239,159,39'},.15)`, border:`0.5px solid ${i===0?'var(--danger)':'var(--accent)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:11, color:i===0?'var(--danger)':'var(--accent)', fontWeight:600 }}>{i+1}</div>
                <div style={{ fontSize:12, color:'var(--text-primary)', lineHeight:1.6 }}>{item}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop:'0.5px solid var(--border)', marginTop:14, paddingTop:10, fontSize:11, color:'var(--text-secondary)', lineHeight:1.6 }}>{exec.summary}</div>
          <div style={{ marginTop:6, fontSize:10, color:'#3a3a38' }}>Confidence: {Math.round((exec.confidence||0)*100)}% · SEC EDGAR</div>
        </div>
      )}
    </div>
  )
}
