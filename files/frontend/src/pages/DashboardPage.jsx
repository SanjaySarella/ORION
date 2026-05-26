import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { analyzeCompany, searchCompanies } from '../utils/api'
import { useIsMobile } from '../hooks/useIsMobile'
import ScoreGauge      from '../components/Dashboard/ScoreGauge'
import ParameterGrid   from '../components/Dashboard/ParameterGrid'
import TrajectoryChart from '../components/Dashboard/TrajectoryChart'
import ChatBot         from '../components/Dashboard/ChatBot'

const TABS = [
  { id:'executive',  label:'Executive',  icon:'ti-building' },
  { id:'consultant', label:'Consultant', icon:'ti-briefcase' },
  { id:'investor',   label:'Investor',   icon:'ti-chart-line' },
  { id:'board',      label:'Board',      icon:'ti-shield' },
]

function MetricCard({ label, value, sub, flag, tooltip }) {
  const [show, setShow] = useState(false)
  const col = flag==='critical'?'var(--red)':flag==='watch'?'var(--amber)':'var(--green-mid)'
  return (
    <div className="card" style={{ padding:16, position:'relative' }}
      onMouseEnter={()=>tooltip&&setShow(true)} onMouseLeave={()=>setShow(false)}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <p style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.8, lineHeight:1.3 }}>{label}</p>
        {tooltip && <i className="ti ti-info-circle" style={{ fontSize:13, color:'var(--text-muted)', flexShrink:0 }} />}
      </div>
      <p style={{ fontSize:22, fontWeight:700, color:col, lineHeight:1 }}>{value}</p>
      {sub && <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:5 }}>{sub}</p>}
      {show && tooltip && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, background:'#0F172A', color:'#F1F5F9', fontSize:12, lineHeight:1.6, padding:'10px 13px', borderRadius:'var(--radius)', zIndex:200, boxShadow:'var(--shadow)' }}>{tooltip}</div>
      )}
    </div>
  )
}

function LoadingScreen({ ticker }) {
  const STEPS = ['Fetching SEC EDGAR filings','Computing 12 distress parameters','Running signal intelligence','Benchmarking sector peers','Analysing trajectory','Generating stakeholder briefs']
  const [step, setStep] = useState(0)
  useEffect(() => { const t = setInterval(()=>setStep(s=>Math.min(s+1,STEPS.length-1)),9000); return ()=>clearInterval(t) }, [])
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-nav)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:28, padding:'20px 16px' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ color:'#fff', fontSize:22, fontWeight:600, letterSpacing:4, fontFamily:'var(--font-serif)', marginBottom:6 }}>ORION</div>
        <div style={{ color:'rgba(255,255,255,.5)', fontSize:13 }}>Analysing {decodeURIComponent(ticker)}...</div>
      </div>
      <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:12, padding:'24px 28px', width:'100%', maxWidth:380 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {STEPS.map((s,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, opacity:i<=step?1:.3, transition:'opacity .4s' }}>
              <div style={{ width:20, height:20, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {i<step ? <i className="ti ti-check" style={{ color:'#86EFAC', fontSize:15 }} />
                  : i===step ? <i className="ti ti-loader-2 spin" style={{ color:'#86EFAC', fontSize:15 }} />
                  : <div style={{ width:6, height:6, borderRadius:'50%', background:'rgba(255,255,255,.2)' }} />}
              </div>
              <span style={{ fontSize:13, color:i===step?'#fff':'rgba(255,255,255,.6)' }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
      <p style={{ fontSize:12, color:'rgba(255,255,255,.3)', textAlign:'center' }}>This takes 30–60 seconds · Real SEC EDGAR data</p>
    </div>
  )
}

function ExecutiveView({ data, isMobile }) {
  const { score, parameters:p, signals, trajectory, briefs } = data
  const exec = briefs?.executive
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', gap:14, alignItems:'flex-start' }}>
        <ScoreGauge score={score.score} label={score.label} criticalCount={score.critical_count} watchCount={score.watch_count} />
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, width: isMobile ? '100%' : 'auto' }}>
          <MetricCard label="Interest Coverage" value={p?.interest_coverage?.display||'N/A'} flag={p?.interest_coverage?.flag} sub="Times interest can be paid" tooltip="Below 1.0x means the company cannot pay its own interest — a critical warning." />
          <MetricCard label="Current Ratio"     value={p?.current_ratio?.display||'N/A'}     flag={p?.current_ratio?.flag}     sub="Short-term liquidity"    tooltip="Below 1.0 means more short-term debts than accessible assets." />
          <MetricCard label="OCF vs Net Income" value={p?.ocf_vs_net_income?.display||'N/A'} flag={p?.ocf_vs_net_income?.flag} sub="Cash earnings quality"   tooltip="If profits are high but cash flow is much lower, the reported profits may not be real." />
          <MetricCard label="Going Concern"     value={signals?.going_concern_issued?'Flagged':'Clear'} flag={signals?.going_concern_issued?'critical':'clear'} sub={signals?.going_concern_issued?'Auditor flagged doubt':'No auditor warning'} tooltip="A going concern opinion means the auditor formally doubts the company can continue operating." />
        </div>
      </div>
      <TrajectoryChart trajectory={trajectory} />
      <ParameterGrid parameters={p} />
      {exec && (
        <div className="card" style={{ padding: isMobile ? 18 : 24, borderLeft:'3px solid var(--green)' }}>
          <h3 style={{ fontSize:16, fontWeight:600, color:'var(--text)', marginBottom:16 }}>Executive Action Brief</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {exec.action_items.map((item,i) => (
              <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <div style={{ width:24, height:24, borderRadius:'50%', background:i===0?'var(--red-light)':'var(--amber-light)', border:`1.5px solid ${i===0?'var(--red-bdr)':'var(--amber-bdr)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:12, color:i===0?'var(--red)':'var(--amber)', fontWeight:700 }}>{i+1}</div>
                <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.65, flex:1 }}>{item}</p>
              </div>
            ))}
          </div>
          <div style={{ borderTop:'1px solid var(--border)', marginTop:16, paddingTop:14 }}>
            <p style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.7 }}>{exec.summary}</p>
            <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:8 }}>Confidence: {Math.round((exec.confidence||0)*100)}%</p>
          </div>
        </div>
      )}
    </div>
  )
}

function ConsultantView({ data, isMobile }) {
  const { score, briefs, trajectory } = data
  const con = briefs?.consultant
  if (!con) return null
  const col = con.deal_rating==='red'?'var(--red)':con.deal_rating==='amber'?'var(--amber)':'var(--green)'
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap:12 }}>
        <div className="card" style={{ padding:16 }}><p style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.8, marginBottom:8 }}>Deal Risk</p><p style={{ fontSize:22, fontWeight:700, color:col, textTransform:'uppercase' }}>{con.deal_rating}</p></div>
        <div className="card" style={{ padding:16 }}><p style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.8, marginBottom:8 }}>Pattern Match</p><p style={{ fontSize:22, fontWeight:700, color:'var(--text)' }}>{con.pattern_match_pct}%</p><p style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>{con.matched_company}</p></div>
        {!isMobile && <div className="card" style={{ padding:16 }}><p style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.8, marginBottom:8 }}>Score</p><p style={{ fontSize:22, fontWeight:700, color:'var(--text)' }}>{score.score}/100</p></div>}
      </div>
      <TrajectoryChart trajectory={trajectory} />
      <div className="card" style={{ padding: isMobile ? 18 : 24, borderLeft:'3px solid var(--green)' }}>
        <h3 style={{ fontSize:16, fontWeight:600, color:'var(--text)', marginBottom:14 }}>Client Recommendation</h3>
        <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.75, marginBottom:14 }}>{con.recommendation}</p>
        <div style={{ background:'var(--green-light)', border:'1px solid var(--green-bdr)', borderRadius:'var(--radius-sm)', padding:'12px 16px' }}>
          <p style={{ fontSize:11, fontWeight:600, color:'var(--green)', marginBottom:4 }}>Slide-ready summary</p>
          <p style={{ fontSize:13, color:'var(--green-dark)', fontStyle:'italic' }}>{con.slide_summary}</p>
        </div>
        <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:10 }}>Confidence: {Math.round((con.confidence||0)*100)}%</p>
      </div>
    </div>
  )
}

function InvestorView({ data, isMobile }) {
  const { signals, briefs } = data
  const inv = briefs?.investor
  if (!inv) return null
  const bpCol = inv.bankruptcy_probability>=70?'var(--red)':inv.bankruptcy_probability>=40?'var(--amber)':'var(--green)'
  const pc = p => p==='exit'?'var(--red)':p==='consider'?'var(--green)':'var(--amber)'
  const pb = p => p==='exit'?'var(--red-light)':p==='consider'?'var(--green-light)':'var(--amber-light)'
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div className="card" style={{ padding:16 }}><p style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.8, marginBottom:8 }}>Bankruptcy Probability</p><p style={{ fontSize:24, fontWeight:700, color:bpCol, marginBottom:4 }}>{inv.bankruptcy_probability}%</p><p style={{ fontSize:11, color:'var(--text-muted)' }}>12-month horizon</p></div>
        <div className="card" style={{ padding:16 }}><p style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.8, marginBottom:8 }}>Insider Sell Ratio</p><p style={{ fontSize:24, fontWeight:700, color:signals?.insider_sell_ratio>0.8?'var(--red)':'var(--text)', marginBottom:4 }}>{Math.round((signals?.insider_sell_ratio||0)*100)}%</p><p style={{ fontSize:11, color:'var(--text-muted)' }}>Form 4 — last 6 months</p></div>
        <div className="card" style={{ padding:16 }}><p style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.8, marginBottom:8 }}>News Sentiment</p><p style={{ fontSize:24, fontWeight:700, color:signals?.news_sentiment_score<-0.3?'var(--red)':'var(--green)', marginBottom:4 }}>{signals?.news_sentiment_score>0?'+':''}{(signals?.news_sentiment_score||0).toFixed(2)}</p><p style={{ fontSize:11, color:'var(--text-muted)' }}>{signals?.news_article_count||0} articles</p></div>
        <div className="card" style={{ padding:16 }}><p style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.8, marginBottom:8 }}>Macro Context</p><p style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.6, marginTop:4 }}>{signals?.macro_context||'N/A'}</p></div>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        {[{label:'Long Equity',pos:inv.equity_position},{label:'Bonds',pos:inv.credit_position},{label:'Put Options',pos:inv.options_signal?.toLowerCase().includes('worth')?'consider':'hold'}].map(({label,pos})=>(
          <div key={label} style={{ flex:1, background:pb(pos), border:`1px solid ${pc(pos)}30`, borderRadius:'var(--radius)', padding: isMobile ? '12px 8px' : 14, textAlign:'center' }}>
            <p style={{ fontSize:10, fontWeight:600, color:pc(pos), textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>{label}</p>
            <p style={{ fontSize:16, fontWeight:700, color:pc(pos), textTransform:'uppercase' }}>{pos}</p>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: isMobile ? 18 : 24, borderLeft:'3px solid var(--green)' }}>
        <h3 style={{ fontSize:16, fontWeight:600, color:'var(--text)', marginBottom:14 }}>Position Brief</h3>
        <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.75, marginBottom:10 }}>{inv.position_rationale}</p>
        <p style={{ fontSize:12, color:'var(--text-muted)', fontStyle:'italic' }}>{inv.options_signal}</p>
        <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:10 }}>Confidence: {Math.round((inv.confidence||0)*100)}%</p>
      </div>
    </div>
  )
}

function BoardView({ data, isMobile }) {
  const { signals, briefs } = data
  const brd = briefs?.board
  if (!brd) return null
  const lvlCol = brd.escalation_level>=4?'var(--red)':brd.escalation_level>=3?'var(--amber)':brd.escalation_level>=2?'#D97706':'var(--green)'
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div className="card" style={{ padding:16 }}><p style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.8, marginBottom:8 }}>Escalation Level</p><p style={{ fontSize:22, fontWeight:700, color:lvlCol, marginBottom:4 }}>Level {brd.escalation_level}/4</p><p style={{ fontSize:11, color:'var(--text-muted)' }}>{brd.escalation_level>=4?'Board intervention required':brd.escalation_level>=3?'Urgent review required':brd.escalation_level>=2?'Board monitoring required':'Routine monitoring'}</p></div>
        <div className="card" style={{ padding:16 }}><p style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.8, marginBottom:8 }}>Going Concern</p><p style={{ fontSize:20, fontWeight:700, color:signals?.going_concern_issued?'var(--red)':'var(--green)', marginBottom:4 }}>{signals?.going_concern_issued?'Issued':'Clear'}</p><p style={{ fontSize:11, color:'var(--text-muted)' }}>10-K audit text scan</p></div>
      </div>
      {brd.active_triggers?.length>0 && (
        <div className="card" style={{ padding: isMobile ? 16 : 20 }}>
          <h3 style={{ fontSize:15, fontWeight:600, color:'var(--text)', marginBottom:14 }}>Escalation Trigger Matrix</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {brd.active_triggers.map((t,i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 14px', background:i===0?'var(--red-light)':'var(--amber-light)', borderRadius:'var(--radius-sm)', borderLeft:`3px solid ${i===0?'var(--red)':'var(--amber)'}` }}>
                <i className={`ti ${i===0?'ti-alert-triangle':'ti-eye'}`} style={{ color:i===0?'var(--red)':'var(--amber)', fontSize:16, flexShrink:0, marginTop:1 }} />
                <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.55, flex:1 }}>{t}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card" style={{ padding: isMobile ? 18 : 24, borderLeft:'3px solid var(--green)' }}>
        <h3 style={{ fontSize:16, fontWeight:600, color:'var(--text)', marginBottom:14 }}>Governance Brief</h3>
        <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.75, marginBottom:12 }}>{brd.governance_brief}</p>
        <p style={{ fontSize:12, color:'var(--text-3)', fontStyle:'italic', marginBottom:10 }}>{brd.regulatory_exposure}</p>
        <p style={{ fontSize:11, color:'var(--text-muted)' }}>Confidence: {Math.round((brd.confidence||0)*100)}%</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { ticker }   = useParams()
  const navigate     = useNavigate()
  const isMobile     = useIsMobile()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [activeTab, setActiveTab] = useState('executive')
  const [chatOpen, setChatOpen]   = useState(false)
  const [q, setQ]                 = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSug, setShowSug]     = useState(false)
  const debounce = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    if (!ticker) return
    setLoading(true); setError(null); setData(null)
    analyzeCompany(decodeURIComponent(ticker))
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [ticker])

  useEffect(() => {
    const h = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowSug(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleSearch = (val) => {
    setQ(val)
    clearTimeout(debounce.current)
    if (val.trim().length < 2) { setSuggestions([]); setShowSug(false); return }
    debounce.current = setTimeout(async () => {
      try { const r = await searchCompanies(val); setSuggestions(r.results||[]); setShowSug(true) } catch {}
    }, 300)
  }

  const go = (query) => { setShowSug(false); setQ(''); navigate(`/dashboard/${encodeURIComponent(query)}`) }

  if (loading) return <LoadingScreen ticker={ticker} />

  if (error) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:'20px 16px' }}>
      <i className="ti ti-alert-circle" style={{ fontSize:40, color:'var(--red)' }} />
      <h2 style={{ fontSize:20, color:'var(--text)', textAlign:'center' }}>Analysis Failed</h2>
      <p style={{ fontSize:14, color:'var(--text-3)', maxWidth:400, textAlign:'center' }}>{error}</p>
      <button onClick={()=>navigate('/')} className="btn-primary">Back to Search</button>
    </div>
  )

  if (!data) return null

  const scoreCol = data.score.score>=75?'var(--red)':data.score.score>=50?'var(--amber)':data.score.score>=25?'#D97706':'var(--green)'

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>

      {/* NAV */}
      <nav style={{ background:'var(--bg-nav)', height: isMobile ? 56 : 60, padding: isMobile ? '0 14px' : '0 24px', display:'flex', alignItems:'center', gap: isMobile ? 10 : 16, flexShrink:0, position:'sticky', top:0, zIndex:100 }}>
        <Link to="/" style={{ flexShrink:0 }}>
          <div style={{ color:'#fff', fontSize: isMobile ? 15 : 18, fontWeight:600, letterSpacing:3, fontFamily:'var(--font-serif)', lineHeight:1 }}>ORION</div>
          {!isMobile && <div style={{ color:'rgba(134,239,172,.7)', fontSize:9, letterSpacing:1.5, marginTop:2 }}>by Sanjay Sarella</div>}
        </Link>

        {/* Search — hidden on mobile */}
        {!isMobile && (
          <div ref={searchRef} style={{ flex:1, maxWidth:480, position:'relative' }}>
            <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.12)', borderRadius:'var(--radius-sm)', height:36, overflow:'hidden' }}>
              <i className="ti ti-search" style={{ color:'rgba(255,255,255,.4)', fontSize:15, padding:'0 12px', flexShrink:0 }} />
              <input value={q} onChange={e=>handleSearch(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&q.trim()) go(q.trim()) }} onFocus={()=>suggestions.length>0&&setShowSug(true)}
                placeholder={`${data.company.name} (${data.company.ticker})`}
                style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:'#fff', minWidth:0 }} />
            </div>
            {showSug && suggestions.length>0 && (
              <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', boxShadow:'var(--shadow)', zIndex:300 }}>
                {suggestions.map((s,i) => (
                  <div key={i} onClick={()=>go(s.ticker||s.name)} style={{ padding:'10px 14px', cursor:'pointer', display:'flex', gap:10, alignItems:'center', borderBottom:i<suggestions.length-1?'1px solid var(--border)':'none' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg-subtle)'}
                    onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                    <span style={{ fontSize:11, fontWeight:700, color:'var(--green)', background:'var(--green-light)', padding:'2px 8px', borderRadius:3, border:'1px solid var(--green-bdr)' }}>{s.ticker}</span>
                    <span style={{ fontSize:13, color:'var(--text)' }}>{s.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: isMobile ? 1 : 0 }} />

        <div style={{ background:`${scoreCol}20`, border:`1.5px solid ${scoreCol}`, borderRadius:'var(--radius-sm)', padding: isMobile ? '4px 10px' : '5px 14px', flexShrink:0 }}>
          <span style={{ color:scoreCol, fontSize: isMobile ? 10 : 11, fontWeight:700, letterSpacing:.5 }}>{data.score.label}</span>
        </div>
        <button onClick={()=>setChatOpen(o=>!o)} style={{ background:chatOpen?'rgba(134,239,172,.15)':'transparent', border:'1.5px solid rgba(134,239,172,.3)', borderRadius:'var(--radius-sm)', padding: isMobile ? '6px 10px' : '7px 16px', color:'#86EFAC', fontSize:12, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap: isMobile ? 0 : 6, flexShrink:0 }}>
          <i className="ti ti-message-circle" style={{ fontSize:15 }} />
          {!isMobile && 'Ask ORION'}
        </button>
        {!isMobile && <Link to="/about" style={{ fontSize:12, color:'rgba(255,255,255,.5)', flexShrink:0 }}>About</Link>}
      </nav>

      {/* COMPANY HEADER */}
      <div style={{ background:'#fff', padding: isMobile ? '14px 16px' : '16px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems: isMobile ? 'flex-start' : 'center', gap:16, flexDirection: isMobile ? 'row' : 'row', justifyContent:'space-between' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <h1 style={{ fontSize: isMobile ? 17 : 22, fontWeight:700, color:'var(--text)', fontFamily:'var(--font-serif)', marginBottom:3, lineHeight:1.2 }}>{data.company.name}</h1>
          <p style={{ fontSize: isMobile ? 11 : 13, color:'var(--text-muted)' }}>{data.company.ticker} · CIK: {data.company.cik}</p>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <p style={{ fontSize: isMobile ? 24 : 28, fontWeight:800, color:scoreCol, lineHeight:1 }}>{data.score.score}<span style={{ fontSize: isMobile ? 13 : 16, fontWeight:400, color:'var(--text-muted)' }}>/100</span></p>
          <p style={{ fontSize: isMobile ? 10 : 11, fontWeight:600, color:scoreCol, letterSpacing:.5 }}>{data.score.label}</p>
        </div>
      </div>

      {/* TABS */}
      <div style={{ background:'#fff', borderBottom:'1px solid var(--border)', display:'flex', padding: isMobile ? '0 8px' : '0 24px', flexShrink:0, overflowX:'auto' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{ background:'transparent', border:'none', borderBottom:`2.5px solid ${activeTab===tab.id?'var(--green)':'transparent'}`, padding: isMobile ? '12px 14px' : '14px 20px', fontSize: isMobile ? 13 : 14, fontWeight:activeTab===tab.id?600:400, color:activeTab===tab.id?'var(--green)':'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', gap: isMobile ? 5 : 7, whiteSpace:'nowrap', flexShrink:0 }}>
            <i className={`ti ${tab.icon}`} style={{ fontSize:14 }} />{tab.label}
          </button>
        ))}
      </div>

      {/* MAIN */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        <div style={{ flex:1, padding: isMobile ? '16px' : '24px', overflowY:'auto' }} className="fade-in">
          {activeTab==='executive'  && <ExecutiveView  data={data} isMobile={isMobile} />}
          {activeTab==='consultant' && <ConsultantView data={data} isMobile={isMobile} />}
          {activeTab==='investor'   && <InvestorView   data={data} isMobile={isMobile} />}
          {activeTab==='board'      && <BoardView      data={data} isMobile={isMobile} />}
        </div>
        {chatOpen && !isMobile && (
          <div style={{ width:320, flexShrink:0, display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
            <ChatBot data={data} role={activeTab} onClose={()=>setChatOpen(false)} />
          </div>
        )}
      </div>

      {/* MOBILE CHAT OVERLAY */}
      {chatOpen && isMobile && (
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', flexDirection:'column' }}>
          <ChatBot data={data} role={activeTab} onClose={()=>setChatOpen(false)} />
        </div>
      )}

      <div style={{ background:'var(--bg-nav)', padding: isMobile ? '10px 16px' : '10px 24px', display:'flex', justifyContent:'space-between', fontSize:11, color:'rgba(255,255,255,.3)', flexShrink:0 }}>
        <span>SEC EDGAR · Yahoo Finance RSS · Google News · FRED</span>
        {!isMobile && <span>Sanjay Sarella · sanjaysarella11@gmail.com</span>}
      </div>
    </div>
  )
}