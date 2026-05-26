import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { searchCompanies } from '../utils/api'
import { useIsMobile } from '../hooks/useIsMobile'

const BANKRUPT_CHIPS = [
  'Enron · ENE · Bankruptcy Dec 2001','Lehman Brothers · LEH · Bankruptcy Sep 2008',
  'Toys R Us · Bankruptcy Sep 2017','Sears Holdings · SHLD · Bankruptcy Oct 2018',
  'WeWork · WE · Bankruptcy Nov 2023','Bed Bath and Beyond · BBBY · Bankruptcy Apr 2023',
  'Silicon Valley Bank · FDIC seizure Mar 2023','Revlon · REV · Bankruptcy Jun 2022',
  'Rite Aid · RAD · Bankruptcy Oct 2023','JC Penney · JCP · Bankruptcy May 2020',
]
const MONITOR_CHIPS = [
  'Apple · AAPL','Microsoft · MSFT','Tesla · TSLA','Amazon · AMZN',
  'JPMorgan · JPM','Goldman Sachs · GS','Boeing · BA','General Motors · GM',
  'Disney · DIS','Netflix · NFLX','Uber · UBER','Airbnb · ABNB',
  'Ford · F','BlackRock · BLK','Salesforce · CRM','Nvidia · NVDA',
]
const EXAMPLES = [
  { ticker:'BBBY', name:'Bed Bath and Beyond', year:'2023', score:78, col:'var(--red)',   status:'HIGH RISK',     insight:'Interest coverage of -34.7x. Going concern issued by Ernst and Young. $145M in insider selling across Form 4 filings.' },
  { ticker:'AAPL', name:'Apple Inc.',          year:'Now',  score:17, col:'var(--green)', status:'LOW RISK',      insight:'Interest coverage of 33.8x. No going concern flag. Positive news sentiment across 120 articles. Recovering trajectory.' },
  { ticker:'WE',   name:'WeWork',              year:'2023', score:71, col:'var(--amber)', status:'ELEVATED RISK', insight:'$47B in lease obligations vs $3.2B revenue. 14.7x leverage ratio disclosed in every 10-K since SPAC listing.' },
  { ticker:'SIVB', name:'Silicon Valley Bank', year:'2023', score:76, col:'var(--red)',   status:'HIGH RISK',     insight:'$91.8B in HTM securities with $15.9B unrealized losses. Disclosed in Note 6 of FY2022 10-K three weeks before FDIC seizure.' },
  { ticker:'F',    name:'Ford Motor Company',  year:'Now',  score:38, col:'var(--amber)', status:'MODERATE RISK', insight:'High debt load from EV transition. Gross margin under pressure from legacy vehicle unit cost inflation.' },
  { ticker:'WMT',  name:'Walmart Inc.',        year:'Now',  score:14, col:'var(--green)', status:'LOW RISK',      insight:'Strong current ratio, consistent operating cash flow. No going concern flag. Industry-leading supply chain.' },
]

function SearchBox({ large = false }) {
  const navigate  = useNavigate()
  const isMobile  = useIsMobile()
  const [q, setQ] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading]   = useState(false)
  const [showSug, setShowSug]   = useState(false)
  const debounce  = useRef(null)
  const wrapRef   = useRef(null)

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSug(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleChange = (val) => {
    setQ(val)
    clearTimeout(debounce.current)
    if (val.trim().length < 2) { setSuggestions([]); setShowSug(false); return }
    setLoading(true)
    debounce.current = setTimeout(async () => {
      try { const r = await searchCompanies(val); setSuggestions(r.results||[]); setShowSug(true) }
      catch { setSuggestions([]) }
      finally { setLoading(false) }
    }, 300)
  }

  const go = (query) => { setShowSug(false); setQ(''); navigate(`/dashboard/${encodeURIComponent(query)}`) }
  const handleKey = (e) => { if (e.key === 'Enter' && q.trim()) go(q.trim()) }

  return (
    <div ref={wrapRef} style={{ position:'relative', width:'100%', maxWidth: large ? (isMobile ? '100%' : 560) : 400 }}>
      <div style={{ display:'flex', alignItems:'center', background:'#fff', border:'1.5px solid var(--border-2)', borderRadius:'var(--radius)', overflow:'hidden', height: isMobile ? 50 : (large ? 52 : 44), boxShadow:'var(--shadow-sm)' }}>
        <span style={{ padding:'0 14px', color:'var(--text-muted)', flexShrink:0 }}>
          {loading ? <i className="ti ti-loader-2 spin" style={{ fontSize:16 }} /> : <i className="ti ti-search" style={{ fontSize:16 }} />}
        </span>
        <input value={q} onChange={e=>handleChange(e.target.value)} onKeyDown={handleKey} onFocus={()=>suggestions.length>0&&setShowSug(true)}
          placeholder={isMobile ? 'Search company or ticker...' : 'Search by company name or ticker (e.g. Apple, TSLA)...'}
          style={{ flex:1, border:'none', outline:'none', fontSize: isMobile ? 14 : (large ? 15 : 14), color:'var(--text)', background:'transparent', minWidth:0 }} />
        <button onClick={()=>q.trim()&&go(q.trim())} className="btn-primary" style={{ borderRadius:0, height:'100%', padding:'0 20px', fontSize:14, flexShrink:0 }}>
          {isMobile ? <i className="ti ti-arrow-right" style={{ fontSize:16 }} /> : 'Analyze'}
        </button>
      </div>
      {showSug && suggestions.length > 0 && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', boxShadow:'var(--shadow)', zIndex:200, overflow:'hidden' }}>
          {suggestions.map((s,i) => (
            <div key={i} onClick={()=>go(s.ticker||s.name)} style={{ padding:'12px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, borderBottom:i<suggestions.length-1?'1px solid var(--border)':'none' }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--bg-subtle)'}
              onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
              <span style={{ fontSize:12, fontWeight:700, color:'var(--green)', background:'var(--green-light)', padding:'3px 8px', borderRadius:3, border:'1px solid var(--green-bdr)', flexShrink:0 }}>{s.ticker}</span>
              <span style={{ fontSize:14, color:'var(--text)', fontWeight:500 }}>{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LandingPage() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [active, setActive] = useState(null)

  const b2 = [...BANKRUPT_CHIPS, ...BANKRUPT_CHIPS]
  const m2 = [...MONITOR_CHIPS, ...MONITOR_CHIPS]

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>

      {/* NAV */}
      <nav style={{ background:'var(--bg-nav)', padding: isMobile ? '0 16px' : '0 32px', height: isMobile ? 56 : 64, display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ color:'#fff', fontSize: isMobile ? 16 : 22, fontWeight:600, letterSpacing:4, fontFamily:'var(--font-serif)' }}>ORION</div>
          {!isMobile && <div style={{ color:'#86EFAC', fontSize:10, letterSpacing:2, marginTop:1, fontWeight:500 }}>Corporate Distress Intelligence by Sanjay Sarella</div>}
          {isMobile && <div style={{ color:'rgba(134,239,172,.7)', fontSize:9, letterSpacing:1 }}>by Sanjay Sarella</div>}
        </div>
        <Link to="/about" style={{ background:'transparent', border:'1.5px solid rgba(134,239,172,.4)', borderRadius:'var(--radius-sm)', padding: isMobile ? '7px 14px' : '8px 20px', color:'#86EFAC', fontSize: isMobile ? 12 : 13, fontWeight:500, whiteSpace:'nowrap' }}>
          About
        </Link>
      </nav>

      {/* HERO */}
      <section style={{ background:'#fff', padding: isMobile ? '36px 16px 28px' : '72px 32px 60px', textAlign:'center', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'var(--green-light)', border:'1px solid var(--green-bdr)', borderRadius:20, padding:'5px 14px', marginBottom: isMobile ? 16 : 24 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--green-mid)', display:'inline-block' }} />
          <span style={{ fontSize: isMobile ? 10 : 12, color:'var(--green)', fontWeight:600, letterSpacing:.3 }}>Agentic AI · SEC EDGAR · Academically Validated</span>
        </div>
        <h1 style={{ fontSize: isMobile ? 24 : 40, fontWeight:700, color:'var(--text)', lineHeight:1.3, marginBottom: isMobile ? 14 : 20, maxWidth:640, margin: `0 auto ${isMobile?14:20}px` }}>
          {isMobile ? 'Detect corporate collapse 6–12 months early.' : 'Corporate collapse is visible\n6–12 months before it happens.'}
        </h1>
        <p style={{ fontSize: isMobile ? 14 : 17, color:'var(--text-3)', maxWidth:560, margin: `0 auto ${isMobile?24:36}px`, lineHeight:1.75 }}>
          ORION reads every SEC 10-K, 10-Q, and Form 4 filing — cross-referencing 12 academically validated distress parameters — and delivers four role-specific intelligence briefs in under three minutes.
        </p>
        <div style={{ display:'flex', justifyContent:'center', padding: isMobile ? '0 4px' : '0', marginBottom:12 }}>
          <SearchBox large />
        </div>
        <p style={{ fontSize:12, color:'var(--text-muted)' }}>10,247 public US companies · Type any company name or ticker</p>
      </section>

      {/* STATS */}
      <div style={{ background:'var(--bg-nav)', padding: isMobile ? '16px' : '20px 32px', display:'flex', flexWrap:'wrap', justifyContent:'space-around', alignItems:'center', gap: isMobile ? 16 : 0 }}>
        {[['10,247','Companies'],['180K+','SEC Filings'],['12','Parameters'],['< 3 min','Analysis'],['$300K','Big 4 Equiv.'],['4','Briefs']].map(([n,l]) => (
          <div key={l} style={{ textAlign:'center', minWidth: isMobile ? '28%' : 'auto' }}>
            <div style={{ fontSize: isMobile ? 16 : 20, fontWeight:700, color:'#86EFAC' }}>{n}</div>
            <div style={{ fontSize: isMobile ? 10 : 11, color:'rgba(255,255,255,.45)', marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* TICKER 1 */}
      <div style={{ background:'#FEF2F2', padding:'10px 0', overflow:'hidden', borderBottom:'1px solid #FECACA' }}>
        <p style={{ fontSize:9, fontWeight:600, color:'#9B1C1C', letterSpacing:2, padding:'0 16px 6px', textTransform:'uppercase' }}>Historically Flagged — Verified Bankruptcies</p>
        <div style={{ overflow:'hidden' }}>
          <div className="ticker-left">
            {b2.map((t,i) => <span key={i} style={{ padding:'4px 12px', borderRadius:20, fontSize:10, fontWeight:500, margin:'0 5px', flexShrink:0, background:'rgba(185,28,28,.08)', color:'#9B1C1C', border:'1px solid rgba(185,28,28,.18)' }}>{t}</span>)}
          </div>
        </div>
      </div>

      {/* TICKER 2 */}
      <div style={{ background:'var(--green-light)', padding:'8px 0 10px', overflow:'hidden', borderBottom:'1px solid var(--border)' }}>
        <p style={{ fontSize:9, fontWeight:600, color:'var(--green)', letterSpacing:2, padding:'0 16px 6px', textTransform:'uppercase' }}>Currently Monitored — 10,247 US Public Companies</p>
        <div style={{ overflow:'hidden' }}>
          <div className="ticker-right">
            {m2.map((t,i) => <span key={i} style={{ padding:'4px 12px', borderRadius:20, fontSize:10, fontWeight:500, margin:'0 5px', flexShrink:0, background:'rgba(22,101,52,.06)', color:'var(--green)', border:'1px solid var(--green-bdr)' }}>{t}</span>)}
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section style={{ padding: isMobile ? '40px 16px' : '64px 32px', background:'#fff', borderBottom:'1px solid var(--border)' }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom: isMobile ? 28 : 48 }}>
            <p className="label" style={{ color:'var(--green)', marginBottom:10 }}>How It Works</p>
            <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight:600, color:'var(--text)' }}>From SEC filing to boardroom brief in three minutes</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 14 : 24 }}>
            {[
              { n:'01', icon:'ti-file-text', title:'Ingest', body:'Pulls eight quarters of 10-K, 10-Q, and Form 4 filings from SEC EDGAR in real time. No data purchase. All public and auditable.' },
              { n:'02', icon:'ti-calculator', title:'Score', body:'A six-node LangGraph pipeline computes all 12 parameters and applies the Beneish, Sloan, and Richardson models to produce a 0–100 distress score.' },
              { n:'03', icon:'ti-users', title:'Brief', body:'Four role-specific briefs — Executive, Consultant, Investor, and Board — each written for the exact question that stakeholder needs answered.' },
            ].map(({ n, icon, title, body }) => (
              <div key={n} className="card" style={{ padding: isMobile ? 20 : 28 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <div style={{ width:34, height:34, borderRadius:8, background:'var(--green-light)', border:'1px solid var(--green-bdr)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <i className={`ti ${icon}`} style={{ color:'var(--green)', fontSize:16 }} />
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:2 }}>STEP {n}</span>
                </div>
                <h3 style={{ fontSize:17, fontWeight:600, color:'var(--text)', marginBottom:8 }}>{title}</h3>
                <p style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.7 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXAMPLES */}
      <section style={{ padding: isMobile ? '40px 16px' : '64px 32px', background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom: isMobile ? 20 : 12 }}>
            <p className="label" style={{ color:'var(--green)', marginBottom:10 }}>Live Examples — Tap to Analyze</p>
            <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight:600, color:'var(--text)', marginBottom:8 }}>These collapses were predictable.</h2>
            <p style={{ fontSize: isMobile ? 13 : 14, color:'var(--text-muted)', marginBottom: isMobile ? 20 : 36 }}>All analysis uses real SEC filings. Tap any company to run a live analysis.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 12 : 16 }}>
            {EXAMPLES.map(ex => (
              <div key={ex.ticker} className="card" style={{ padding: isMobile ? 16 : 22, cursor:'pointer', transition:'box-shadow .15s, border-color .15s', borderColor:active===ex.ticker?ex.col:'var(--border)' }}
                onClick={()=>setActive(active===ex.ticker?null:ex.ticker)}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <div>
                    <h3 style={{ fontSize: isMobile ? 15 : 16, fontWeight:600, color:'var(--text)', marginBottom:2 }}>{ex.name}</h3>
                    <p style={{ fontSize:11, color:'var(--text-muted)' }}>{ex.ticker} · {ex.year}</p>
                  </div>
                  <div style={{ background:`${ex.col}15`, border:`1.5px solid ${ex.col}`, borderRadius:6, padding:'4px 8px', textAlign:'center', flexShrink:0, marginLeft:10 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:ex.col }}>{ex.score}</div>
                    <div style={{ fontSize:9, color:ex.col, fontWeight:600 }}>/100</div>
                  </div>
                </div>
                <span style={{ display:'inline-block', fontSize:10, fontWeight:600, color:ex.col, background:`${ex.col}12`, border:`1px solid ${ex.col}30`, borderRadius:4, padding:'2px 8px', marginBottom:8 }}>{ex.status}</span>
                <p style={{ fontSize:12, color:'var(--text-3)', lineHeight:1.6, marginBottom:10 }}>{ex.insight}</p>
                <p style={{ fontSize:12, color:'var(--green)', fontWeight:500 }}>
                  {active===ex.ticker ? '▲ Collapse' : 'View live analysis →'}
                </p>
              </div>
            ))}
          </div>
          {active && (() => {
            const ex = EXAMPLES.find(e=>e.ticker===active)
            return (
              <div className="card" style={{ marginTop:14, padding: isMobile ? 18 : 24, borderColor:'var(--green)' }}>
                <p style={{ fontSize: isMobile ? 14 : 15, fontWeight:600, color:'var(--text)', marginBottom:8 }}>
                  Run the full pipeline for <strong style={{ color:'var(--green)' }}>{ex?.name} ({active})</strong>
                </p>
                <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:14 }}>All six nodes — Filing Extractor, Distress Scorer, Signal Intelligence, Peer Benchmarking, Trajectory, Stakeholder Briefs. Real SEC data. 30–60 seconds.</p>
                <button onClick={()=>navigate(`/dashboard/${active}`)} className="btn-primary" style={{ width: isMobile ? '100%' : 'auto' }}>
                  Open Full Dashboard →
                </button>
              </div>
            )
          })()}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background:'var(--bg-nav)', padding: isMobile ? '24px 16px' : '28px 32px' }}>
        <div style={{ maxWidth:960, margin:'0 auto', display:'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent:'space-between', gap: isMobile ? 16 : 0 }}>
          <div>
            <div style={{ color:'#fff', fontSize:16, fontWeight:600, fontFamily:'var(--font-serif)', letterSpacing:2, marginBottom:4 }}>ORION</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,.4)' }}>Corporate Distress Intelligence · Sanjay Sarella</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,.4)', marginTop:2 }}>M.S. Data Analytics · Oklahoma City University</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems: isMobile ? 'flex-start' : 'flex-end' }}>
            <p style={{ fontSize:12, color:'rgba(255,255,255,.55)' }}>sanjaysarella11@gmail.com</p>
            <p style={{ fontSize:12, color:'rgba(255,255,255,.55)' }}>github.com/SanjaySarella</p>
            <Link to="/about" style={{ fontSize:12, color:'#86EFAC', fontWeight:500 }}>About ORION →</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}