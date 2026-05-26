import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const directionStyle = (d) => ({
  accelerating: { color:'var(--red)',   bg:'var(--red-light)',   border:'var(--red-bdr)',   label:'Accelerating ↑' },
  stabilising:  { color:'var(--amber)', bg:'var(--amber-light)', border:'var(--amber-bdr)', label:'Stabilising →' },
  recovering:   { color:'var(--green)', bg:'var(--green-light)', border:'var(--green-bdr)', label:'Recovering ↓' },
}[d] || { color:'var(--text-muted)', bg:'var(--bg-subtle)', border:'var(--border)', label:d })

export default function TrajectoryChart({ trajectory }) {
  if (!trajectory?.quarters?.length) return null
  const data = [...trajectory.quarters].reverse().map(q => ({
    period: q.quarter.substring(0,7),
    score:  Math.round(q.score),
  }))
  const ds = directionStyle(trajectory.direction)

  const Tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const s = payload[0].value
    const c = s>=75?'var(--red)':s>=50?'var(--amber)':s>=25?'#D97706':'var(--green-mid)'
    return (
      <div className="card" style={{ padding:'10px 14px' }}>
        <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</p>
        <p style={{ fontSize:16, fontWeight:700, color:c }}>{s} / 100</p>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <h3 style={{ fontSize:15, fontWeight:600, color:'var(--text)', marginBottom:4 }}>8-Quarter Distress Trajectory</h3>
          <p style={{ fontSize:13, color:'var(--text-muted)' }}>{trajectory.quarters_in_red} of {trajectory.quarters.length} periods above the red zone threshold</p>
        </div>
        <span style={{ fontSize:12, fontWeight:600, color:ds.color, background:ds.bg, border:`1px solid ${ds.border}`, padding:'4px 12px', borderRadius:20 }}>{ds.label}</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top:5, right:10, left:-20, bottom:5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis dataKey="period" tick={{ fontSize:11, fill:'var(--text-muted)' }} />
          <YAxis domain={[0,100]} tick={{ fontSize:11, fill:'var(--text-muted)' }} />
          <Tooltip content={<Tip />} />
          <ReferenceLine y={75} stroke="var(--red)"   strokeDasharray="4 4" strokeOpacity={.4} label={{ value:'High', position:'right', fontSize:10, fill:'var(--red)' }} />
          <ReferenceLine y={50} stroke="var(--amber)" strokeDasharray="4 4" strokeOpacity={.35} />
          <Line type="monotone" dataKey="score" stroke="var(--green)" strokeWidth={2.5} dot={{ fill:'var(--green)', r:4, strokeWidth:0 }} activeDot={{ r:6 }} />
        </LineChart>
      </ResponsiveContainer>
      <p style={{ fontSize:12, color:'var(--text-3)', marginTop:12, lineHeight:1.6 }}>{trajectory.trend_summary}</p>
    </div>
  )
}
