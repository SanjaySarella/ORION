import { useIsMobile } from '../../hooks/useIsMobile'

export default function ScoreGauge({ score, label, criticalCount, watchCount }) {
  const isMobile = useIsMobile()
  const col = score>=75?'var(--red)':score>=50?'var(--amber)':score>=25?'#D97706':'var(--green-mid)'
  const totalArc = Math.round(62 * Math.PI)
  const arc = Math.round((score / 100) * totalArc)
  const size = isMobile ? 160 : 160
  return (
    <div className="card" style={{ padding: isMobile ? '16px 20px' : 20, textAlign:'center', width: isMobile ? '100%' : 210, flexShrink:0 }}>
      <p style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', letterSpacing:1, marginBottom:12, textTransform:'uppercase' }}>Distress Score</p>
      <svg viewBox="0 0 160 96" width={size} height={96} style={{ display:'block', margin:'0 auto' }}>
        <path d="M14 88 A62 62 0 0 1 146 88" stroke="#E5E7EB" strokeWidth="12" fill="none" strokeLinecap="round"/>
        <path d="M14 88 A62 62 0 0 1 146 88" stroke={col} strokeWidth="12" fill="none" strokeDasharray={`${arc} 1000`} strokeLinecap="round"/>
        <text x="80" y="76" textAnchor="middle" fontSize="32" fontWeight="700" fill={col}>{score}</text>
        <text x="80" y="90" textAnchor="middle" fontSize="10" fill="var(--text-muted)">out of 100</text>
      </svg>
      <p style={{ fontSize:13, fontWeight:700, color:col, letterSpacing:.5, marginTop:4 }}>{label}</p>
      <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>{criticalCount} critical · {watchCount} watch</p>
    </div>
  )
}