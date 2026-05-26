import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useIsMobile } from '../hooks/useIsMobile'

const SECTIONS = [
  { num:'01', title:'What to expect', sub:'A complete distress analysis in under three minutes',
    content:[
      { h:'The output', b:'When you search any public US company, ORION pulls eight quarters of real SEC filings, computes all 12 distress parameters, benchmarks them against five industry peers, tracks an eight-quarter trajectory, and generates four role-specific intelligence briefs. Every output is source-cited and confidence-rated.' },
      { h:'The four stakeholder briefs', b:'Executive — cash position and immediate action items. Consultant — deal risk rating and client recommendation. Investor — bankruptcy probability and position brief. Board — escalation level and governance obligations.' },
      { h:'The chatbot', b:'A role-aware chatbot is built into every analysis. It knows which tab you are on, the full analysis context, and your conversation history. Ask any follow-up in plain English.' },
    ]},
  { num:'02', title:'What we provide', sub:'Six analytical layers from publicly available data',
    content:[
      { h:'Composite distress score', b:'A single number from 0 to 100, computed across all 12 parameters. Peer-benchmarked and tracked across eight annual periods. Citable and auditable.' },
      { h:'12-parameter breakdown', b:'Every parameter flagged critical, watch, or clear with the exact metric value and the SEC filing it came from. Covers accruals quality, revenue signals, liquidity ratios, debt structure, auditor opinion language, insider transactions, and news sentiment.' },
      { h:'Peer benchmarking and trajectory', b:'The same 12 parameters computed for five sector peers so every metric is contextualised against the industry. The eight-quarter trajectory shows whether distress is accelerating, stabilising, or recovering.' },
    ]},
  { num:'03', title:'Why trust ORION', sub:'Every number is verifiable. Every claim is sourceable.',
    content:[
      { h:'All data is publicly available', b:'The 10-K, 10-Q, Form 4, and 8-K filings that power ORION are free from SEC EDGAR. No proprietary data. Everything can be verified by any CPA with internet access.' },
      { h:'Three peer-reviewed academic models', b:'Beneish M-Score (1999), Sloan Accruals Model (1996), and Richardson Earnings Quality Framework (2005). The same frameworks used by Big 4 forensic accounting practices, cited across more than 4,000 academic papers.' },
      { h:'Backtested against real bankruptcies', b:'ORION has been run against Enron, Lehman Brothers, Toys R Us, Silicon Valley Bank, WeWork, and Bed Bath & Beyond using their real historical filings. The distress signals were present months before each collapse.' },
    ]},
  { num:'04', title:'What makes ORION different', sub:'Not a news aggregator. Not a credit rating.',
    content:[
      { h:'Reads twelve signals simultaneously', b:'Any individual metric can be misleading in isolation. ORION reads all 12 signals together, the way a forensic accountant does — not the way a financial screener does.' },
      { h:'Output shaped for the decision-maker', b:'A PE investor and a board member are asking fundamentally different questions. ORION produces four distinct briefs — each written for a specific decision context.' },
      { h:'Replicates a six-week engagement in three minutes', b:'A Big 4 forensic accounting engagement of this scope costs approximately $300,000 and takes six weeks. ORION delivers the same coverage using the same academic models.' },
    ]},
  { num:'05', title:'Agentic AI architecture', sub:'A six-node LangGraph pipeline, not a single prompt',
    content:[
      { h:'Why this architecture', b:'ORION distributes intelligence across six specialised agents in a directed graph. Each agent has a defined scope, a typed Pydantic output, and passes structured state to the next node.' },
      { h:'The six nodes', b:'Node 1: Filing Extractor — pulls eight quarters of filings from SEC EDGAR.\n\nNode 2: Distress Scorer — computes all 12 parameters and produces the composite score.\n\nNode 3: Signal Intelligence — Form 4 transactions, news sentiment, FRED macro context, going concern text scan.\n\nNode 4: Peer Benchmarking — same parameters for five sector peers via EDGAR SIC browse.\n\nNode 5: Trajectory — distress score across eight annual periods, direction analysis.\n\nNode 6: Stakeholder Briefs with Critic Loop — four role-specific briefs via Groq and Llama 3.3-70B. Briefs below 80% confidence are automatically revised.' },
    ]},
  { num:'06', title:'Technology stack', sub:'Zero cost. Production-grade. Fully open source.',
    content:[
      { h:'Frontend and backend', b:'React frontend with a green and white professional design. FastAPI Python backend handling pipeline orchestration and SEC EDGAR data fetching. Both deployed on GCP Cloud Run in region us-central1.' },
      { h:'AI and data infrastructure', b:'LangGraph for the six-node pipeline. Groq free tier for Llama 3.3-70B inference. ChromaDB for vector storage. Sentence Transformers for embeddings.' },
      { h:'Data sources — all free', b:'SEC EDGAR API — 10-K, 10-Q, Form 4, 8-K for 10,247 companies. No API key required.\n\nYahoo Finance RSS and Google News RSS — news sentiment with no rate limits.\n\nFRED API — Federal Reserve macro data including Fed Funds Rate and credit spreads.' },
    ]},
]

export default function AboutPage() {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(null)

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <nav style={{ background:'var(--bg-nav)', padding: isMobile ? '0 16px' : '0 32px', height: isMobile ? 56 : 64, display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ color:'#fff', fontSize: isMobile ? 16 : 20, fontWeight:600, letterSpacing:4, fontFamily:'var(--font-serif)' }}>ORION</div>
          {!isMobile && <div style={{ color:'rgba(134,239,172,.7)', fontSize:10, letterSpacing:2, marginTop:1 }}>Corporate Distress Intelligence by Sanjay Sarella</div>}
        </div>
        <Link to="/" style={{ border:'1.5px solid rgba(134,239,172,.35)', borderRadius:'var(--radius-sm)', padding: isMobile ? '7px 12px' : '8px 18px', color:'#86EFAC', fontSize: isMobile ? 12 : 13, fontWeight:500, display:'flex', alignItems:'center', gap:6, flexShrink:0, whiteSpace:'nowrap' }}>
          <i className="ti ti-arrow-left" style={{ fontSize:14 }} />{isMobile ? 'Back' : 'Back to Home'}
        </Link>
      </nav>

      <div style={{ background:'#fff', padding: isMobile ? '36px 16px 28px' : '56px 0 48px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ maxWidth:760, margin:'0 auto', padding: isMobile ? 0 : '0 32px' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'var(--green-light)', border:'1px solid var(--green-bdr)', borderRadius:20, padding:'5px 14px', marginBottom:18 }}>
            <span style={{ fontSize:12, color:'var(--green)', fontWeight:600 }}>Corporate Distress Intelligence Platform</span>
          </div>
          <h1 style={{ fontSize: isMobile ? 26 : 36, fontWeight:700, color:'var(--text)', lineHeight:1.25, marginBottom:14 }}>Sanjay Sarella's ORION</h1>
          <p style={{ fontSize: isMobile ? 14 : 16, color:'var(--text-3)', lineHeight:1.8, marginBottom:22, maxWidth:620 }}>
            A production-grade agentic AI platform that detects corporate financial distress 6 to 12 months before it becomes public — using free public SEC filings, three peer-reviewed academic models, and a six-node AI pipeline that delivers results in under three minutes.
          </p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {['10,247 companies','12 validated parameters','4 stakeholder briefs','LangGraph pipeline','GCP Cloud Run'].map(t => (
              <span key={t} style={{ background:'var(--green-light)', border:'1px solid var(--green-bdr)', borderRadius:20, padding:'5px 12px', fontSize: isMobile ? 11 : 12, fontWeight:600, color:'var(--green)' }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:760, margin:'0 auto', padding: isMobile ? '0 16px' : '0 32px' }}>
        {SECTIONS.map(sec => (
          <div key={sec.num} style={{ borderBottom:'1px solid var(--border)' }}>
            <button onClick={()=>setOpen(open===sec.num?null:sec.num)} style={{ width:'100%', background:'transparent', border:'none', padding: isMobile ? '20px 0' : '24px 0', display:'flex', alignItems:'center', gap:14, cursor:'pointer', textAlign:'left' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--green)', letterSpacing:2, width:28, flexShrink:0 }}>{sec.num}</span>
              <div style={{ flex:1, textAlign:'left' }}>
                <p style={{ fontSize: isMobile ? 15 : 17, fontWeight:600, color:'var(--text)', marginBottom:3 }}>{sec.title}</p>
                <p style={{ fontSize: isMobile ? 12 : 13, color:'var(--text-muted)' }}>{sec.sub}</p>
              </div>
              <i className="ti ti-chevron-down" style={{ color:'var(--green)', fontSize:18, transition:'transform .2s', transform:open===sec.num?'rotate(180deg)':'rotate(0)', flexShrink:0 }} />
            </button>
            {open===sec.num && (
              <div style={{ paddingBottom:24, paddingLeft: isMobile ? 42 : 42 }} className="fade-in">
                {sec.content.map(({h,b},i) => (
                  <div key={i} style={{ marginBottom:20 }}>
                    <h3 style={{ fontSize: isMobile ? 14 : 15, fontWeight:600, color:'var(--text)', marginBottom:7 }}>{h}</h3>
                    {b.split('\n\n').map((para,j) => (
                      <p key={j} style={{ fontSize: isMobile ? 13 : 14, color:'var(--text-3)', lineHeight:1.75, marginBottom:j<b.split('\n\n').length-1?10:0 }}>{para}</p>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <footer style={{ background:'var(--bg-nav)', padding: isMobile ? '24px 16px' : '32px 32px', marginTop:40 }}>
        <div style={{ maxWidth:760, margin:'0 auto', display:'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent:'space-between', gap: isMobile ? 16 : 0 }}>
          <div>
            <p style={{ color:'#fff', fontSize:15, fontWeight:600, fontFamily:'var(--font-serif)', letterSpacing:2, marginBottom:5 }}>Sanjay Sarella</p>
            <p style={{ fontSize:12, color:'rgba(255,255,255,.4)' }}>M.S. Data Analytics · Oklahoma City University</p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems: isMobile ? 'flex-start' : 'flex-end' }}>
            <p style={{ fontSize:12, color:'rgba(255,255,255,.55)' }}>sanjaysarella11@gmail.com</p>
            <p style={{ fontSize:12, color:'rgba(255,255,255,.55)' }}>github.com/SanjaySarella</p>
          </div>
        </div>
      </footer>
    </div>
  )
}