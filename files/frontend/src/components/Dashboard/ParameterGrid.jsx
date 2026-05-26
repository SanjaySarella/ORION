import { useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'

const EXPLANATIONS = {
  accruals_ratio:         { short:'Earnings vs cash gap', detail:'Measures the gap between reported profit and actual cash received. A strongly negative ratio suggests earnings may be inflated without real cash backing. Academic basis: Sloan Accruals Model (1996).' },
  revenue_vs_ar_growth:   { short:'Revenue booking quality', detail:'When accounts receivable grows much faster than revenue, the company may be booking sales it has not collected. Ratio above 2.0x is a red flag for aggressive revenue recognition.' },
  days_sales_outstanding: { short:'How long customers take to pay', detail:'The average number of days customers take to pay their invoices. A rising number means customers are paying slower, which can signal risky credit extension to inflate sales.' },
  gross_margin_trend:     { short:'Core business profitability', detail:'Revenue minus direct costs as a percentage. Declining gross margins signal pricing pressure, rising costs, or competitive erosion of the core business.' },
  ocf_vs_net_income:      { short:'Are profits turning into cash?', detail:'If a company reports large profits but operating cash flow is much lower or negative, the profits may not be real. Healthy businesses convert their profits into cash reliably.' },
  interest_coverage:      { short:'Can they pay their debt interest?', detail:'How many times a company can pay its interest from operating income. Below 1.0x means it cannot cover its own interest — a critical warning signal.' },
  current_ratio:          { short:'Short-term liquidity', detail:'Current assets divided by current liabilities. Below 1.0 means more short-term debts than accessible assets. A persistent sub-1.0 ratio signals a liquidity crisis.' },
  debt_maturity_schedule: { short:'When does the debt come due?', detail:'Large debt payments due in a short window create a maturity cliff. If the company cannot refinance at that point, it faces a severe liquidity crisis.' },
  going_concern_flag:     { short:'Has the auditor flagged doubt?', detail:'A going concern opinion is the auditor formally stating in the company\'s own financial statements that there is doubt about its ability to continue operating.' },
  insider_selling:        { short:'Are executives selling their stock?', detail:'Company insiders must disclose stock sales via SEC Form 4. When executives sell large amounts at a high sell-to-buy ratio, it may signal private knowledge of trouble.' },
  guidance_accuracy:      { short:'Does management tell the truth?', detail:'How accurately has management predicted their own financial results over the last eight quarters. Consistent overestimation suggests loss of visibility into the business.' },
  news_sentiment:         { short:'What does market coverage say?', detail:'Aggregated sentiment from Yahoo Finance and Google News. Sustained negative coverage often reflects growing market awareness of problems not yet in official filings.' },
}

const PARAM_ORDER = [
  'accruals_ratio','revenue_vs_ar_growth','days_sales_outstanding','gross_margin_trend',
  'ocf_vs_net_income','interest_coverage','current_ratio','debt_maturity_schedule',
  'going_concern_flag','insider_selling','guidance_accuracy','news_sentiment',
]

function InfoTooltip({ content }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position:'relative', display:'inline-flex', marginLeft:5 }}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}
      onClick={e=>{e.stopPropagation();setShow(s=>!s)}}>
      <i className="ti ti-info-circle" style={{ fontSize:13, color:'var(--text-muted)', cursor:'help' }} />
      {show && (
        <div style={{ position:'absolute', bottom:'calc(100% + 8px)', left:'50%', transform:'translateX(-50%)', background:'#0F172A', color:'#F1F5F9', fontSize:12, lineHeight:1.65, padding:'10px 14px', borderRadius:'var(--radius)', width:240, zIndex:500, boxShadow:'0 8px 24px rgba(0,0,0,.15)', pointerEvents:'none' }}>
          {content}
          <div style={{ position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)', borderTop:'5px solid #0F172A', borderLeft:'5px solid transparent', borderRight:'5px solid transparent' }} />
        </div>
      )}
    </div>
  )
}

export default function ParameterGrid({ parameters }) {
  const isMobile = useIsMobile()
  if (!parameters) return null

  const counts = Object.values(parameters).reduce((a,p)=>{ a[p.flag]=(a[p.flag]||0)+1; return a }, {})

  const flagBadge = (flag) => ({
    fontSize:10, fontWeight:600, letterSpacing:.5,
    color:flag==='critical'?'var(--red)':flag==='watch'?'var(--amber)':'var(--green)',
    background:flag==='critical'?'var(--red-light)':flag==='watch'?'var(--amber-light)':'var(--green-light)',
    border:`1px solid ${flag==='critical'?'var(--red-bdr)':flag==='watch'?'var(--amber-bdr)':'var(--green-bdr)'}`,
    padding:'1px 7px', borderRadius:4, textTransform:'uppercase',
  })

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <h3 style={{ fontSize:15, fontWeight:600, color:'var(--text)' }}>12-Parameter Breakdown</h3>
        {counts.critical>0 && <span style={flagBadge('critical')}>{counts.critical} Critical</span>}
        {counts.watch>0    && <span style={flagBadge('watch')}>{counts.watch} Watch</span>}
        {counts.clear>0    && <span style={flagBadge('clear')}>{counts.clear} Clear</span>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:10 }}>
        {PARAM_ORDER.map(key => {
          const p    = parameters[key]
          const info = EXPLANATIONS[key]
          if (!p) return null
          const col = p.flag==='critical'?'var(--red)':p.flag==='watch'?'var(--amber)':'var(--green-mid)'
          return (
            <div key={key} className="card" style={{ borderLeft:`3px solid ${col}`, borderRadius:'0 var(--radius) var(--radius) 0', padding: isMobile ? '12px 14px' : '12px 14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                <div style={{ display:'flex', alignItems:'center', flex:1, minWidth:0 }}>
                  <span style={{ fontSize:13, fontWeight:500, color:'var(--text)', marginRight:4 }}>{p.name}</span>
                  {info && <InfoTooltip content={info.detail} />}
                </div>
                <span style={{ fontSize:13, fontWeight:700, color:col, flexShrink:0, marginLeft:8 }}>{p.display}</span>
              </div>
              {info && <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>{info.short}</p>}
              <p style={{ fontSize:11, color:'var(--text-3)', lineHeight:1.5 }}>{p.explanation}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}