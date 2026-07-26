import React from 'react';
import { useData } from '../../DataContext';

const STATUS = {
  complete: { bg: '#DCFCE7', fg: '#15803D', bar: '#16A34A' },
  active:   { bg: '#E8E5FF', fg: '#5929d0', bar: '#5929d0' },
  on_track: { bg: '#CFFAFE', fg: '#0E7490', bar: '#22D3EE' },
  at_risk:  { bg: '#FEF3C7', fg: '#92400E', bar: '#E4902E' },
  overdue:  { bg: '#FEE2E2', fg: '#B91C1C', bar: '#DC2626' },
  pending:  { bg: '#F1F5F9', fg: '#64748B', bar: '#94A3B8' },
};

const BAR_COLOR = '#5929d0';

const kpiIcon = (key, color) => {
  const p = { width: 13, height: 13, viewBox: '0 0 16 16', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (key) {
    case 'assign': return <svg {...p}><circle cx="8" cy="5.5" r="2.5" stroke={color} strokeWidth="1.5"/><path d="M3 14c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" stroke={color} strokeWidth="1.5"/></svg>;
    case 'comp':   return <svg {...p}><path d="M3 8.5l3.5 3.5 6.5-7" stroke={color} strokeWidth="1.8"/></svg>;
    case 'pass':   return <svg {...p}><path d="M8 1.5l1.5 4.2h4.4l-3.6 2.6 1.4 4.2L8 9.8l-3.7 2.7 1.4-4.2L2.1 5.7h4.4L8 1.5z" stroke={color} strokeWidth="1.2"/></svg>;
    case 'over':   return <svg {...p}><path d="M8 3L2.5 13h11L8 3z" stroke={color} strokeWidth="1.5"/><line x1="8" y1="7" x2="8" y2="10" stroke={color} strokeWidth="1.8"/><circle cx="8" cy="11.5" r=".7" fill={color}/></svg>;
    case 'cert':   return <svg {...p}><path d="M8 1.5L3 3.5v3.5c0 3 2 5 5 6.5 3-1.5 5-3.5 5-6.5V3.5L8 1.5z" stroke={color} strokeWidth="1.5"/></svg>;
    case 'hil':    return <svg {...p}><circle cx="8" cy="8" r="5.5" stroke={color} strokeWidth="1.5"/><path d="M5.5 8.5l2 2 3.5-3.5" stroke={color} strokeWidth="1.5"/></svg>;
    case 'cap':    return <svg {...p}><ellipse cx="8" cy="4.5" rx="4.5" ry="1.7" stroke={color} strokeWidth="1.5"/><path d="M3.5 4.5v3c0 .9 2 1.7 4.5 1.7s4.5-.8 4.5-1.7v-3" stroke={color} strokeWidth="1.5"/><path d="M3.5 7.5v3c0 .9 2 1.7 4.5 1.7s4.5-.8 4.5-1.7v-3" stroke={color} strokeWidth="1.5"/></svg>;
    case 'time':   return <svg {...p}><circle cx="8" cy="8" r="5.5" stroke={color} strokeWidth="1.5"/><path d="M8 5v3.5l2 1.5" stroke={color} strokeWidth="1.5"/></svg>;
    default:       return null;
  }
};

const MotionBarChart = ({ rfpProgress, onBarClick }) => {
  if (!rfpProgress || rfpProgress.length === 0) return null;

  const W = 400, H = 160, pL = 38, pB = 30, pT = 10, pR = 10;
  const cW = W - pL - pR, cH = H - pB - pT;
  const n = rfpProgress.length;
  const maxV = Math.max(...rfpProgress.map(d => d.total), 1);
  const barWidth = Math.min(32, (cW / n) * 0.6);
  const step = Math.ceil(maxV / 4) || 1;
  const gridSteps = [];
  for (let v = 0; v <= maxV; v += step) gridSteps.push(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {gridSteps.map(v => {
        const y = pT + cH - (v / maxV) * cH;
        return (
          <React.Fragment key={v}>
            <line x1={pL} x2={W - pR} y1={y} y2={y} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3,3" />
            <text x={pL - 4} y={y + 4} textAnchor="end" style={{ fontSize: '9px', fill: '#94A3B8', fontFamily: 'Poppins,sans-serif' }}>{v}</text>
          </React.Fragment>
        );
      })}
      <line x1={pL} x2={pL} y1={pT} y2={pT + cH} stroke="#E2E8F0" strokeWidth="1" />
      <line x1={pL} x2={W - pR} y1={pT + cH} y2={pT + cH} stroke="#E2E8F0" strokeWidth="1" />

      {rfpProgress.map((d, i) => {
        const cx = pL + (cW / (n * 2)) + (i * cW / n);
        const x = cx - barWidth / 2;
        const totalH = (d.total / maxV) * cH;
        const barY = pT + cH - totalH;

        return (
          <React.Fragment key={d.rfp_reference}>
            <rect
              x={x - 8} y={pT} width={barWidth + 16} height={cH}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onBarClick && onBarClick(d)}
            />
            <rect
              id={`rfp-bar-${d.rfp_ref || i}-bar`}
              x={x} y={barY} width={barWidth} height={totalH}
              fill={BAR_COLOR}
              rx="3"
              style={{ cursor: 'pointer' }}
              onClick={() => onBarClick && onBarClick(d)}
            />
            <text x={cx} y={pT + cH + 14} textAnchor="middle" style={{ fontSize: '9px', fill: '#94A3B8', fontFamily: 'Poppins,sans-serif', fontWeight: 600 }}>
              {d.rfp_reference.replace('RFP-2026-', '')}
            </text>
            <text x={cx} y={pT + cH + 25} textAnchor="middle" style={{ fontSize: '9px', fill: '#5929d0', fontFamily: 'Poppins,sans-serif', fontWeight: 700 }}>
              {d.compliance_pct}%
            </text>
          </React.Fragment>
        );
      })}
    </svg>
  );
};

const AnalyticsScreen = ({ showModal, showToast, pushLog }) => {
  const { metrics: ctxMetrics, statusBreakdown, rfpProgress } = useData();

  const metrics = ctxMetrics || {
    assignment_rate_pct: 94, completion_rate_pct: 78,
    assessment_pass_rate_pct: 71, overdue_rate_pct: 6,
    cert_compliance_rate_pct: 89, hil_override_rate_pct: 12,
    capability_update_rate_pct: 100, avg_time_to_assignment_h: 1.4,
    overdue_count: 3, at_risk_count: 9, pending_hil: 2,
  };

  const kpis = [
    { key:'assign', label:'Assignment Rate',    val:metrics.assignment_rate_pct,        unit:'%', trend:'+3%', up:true,  color:'#15803D', bg:'#DCFCE7', sub:'Gaps assigned to program' },
    { key:'comp',   label:'Completion Rate',    val:metrics.completion_rate_pct,        unit:'%', trend:'+5%', up:true,  color:'#15803D', bg:'#DCFCE7', sub:'Completed on time' },
    { key:'pass',   label:'Assessment Pass',    val:metrics.assessment_pass_rate_pct,   unit:'%', trend:'-2%', up:false, color:'#5929d0', bg:'#E8E5FF', sub:'First-attempt passes' },
    { key:'over',   label:'Overdue Rate',       val:metrics.overdue_rate_pct,           unit:'%', trend:'+1%', up:false, color:'#B91C1C', bg:'#FEE2E2', sub:'Missed deadline' },
    { key:'cert',   label:'Cert Compliance',    val:metrics.cert_compliance_rate_pct,   unit:'%', trend:'',    up:true,  color:'#0E7490', bg:'#CFFAFE', sub:'Pre-deployment met' },
    { key:'hil',    label:'HIL Override Rate',  val:metrics.hil_override_rate_pct,      unit:'%', trend:'',    up:false, color:'#92400E', bg:'#FEF3C7', sub:'TL modifications' },
    { key:'cap',    label:'Capability Update',  val:metrics.capability_update_rate_pct, unit:'%', trend:'',    up:true,  color:'#15803D', bg:'#DCFCE7', sub:'Within SLA' },
    { key:'time',   label:'Avg Time to Assign', val:metrics.avg_time_to_assignment_h,   unit:'h', trend:'',    up:true,  color:'#5929d0', bg:'#E8E5FF', sub:'Gap to HIL delivery' },
  ];

  const openKpiDetail = (kpi) => {
    showModal(
      <div>
        <div className="modal-head" style={{ background: kpi.bg }}>
          <div className="modal-htitle" style={{ color: kpi.color }}>{kpi.label}</div>
          <button id="kpi-detail-close-btn" className="modal-close" onClick={() => showModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'16px' }}>
            <div style={{ fontSize:'52px', fontWeight:800, color:kpi.color, lineHeight:1 }}>
              {kpi.val}<span style={{ fontSize:'22px' }}>{kpi.unit}</span>
            </div>
            <div>
              <div style={{ fontSize:'13px', color:'var(--n3)', marginBottom:'4px' }}>{kpi.sub}</div>
              {kpi.trend && (
                <span style={{ fontSize:'13px', fontWeight:700, color: kpi.up ? '#15803D' : '#B91C1C' }}>
                  {kpi.up ? '↑' : '↓'} {kpi.trend} vs last period
                </span>
              )}
            </div>
          </div>
          <div className="mactions">
            <button id="kpi-detail-dismiss-btn" className="btn btn-p" onClick={() => showModal(null)}>Close</button>
          </div>
        </div>
      </div>
    );
  };

  const openStatusDetail = (item) => {
    const c = STATUS[item.status] || STATUS.pending;
    showModal(
      <div>
        <div className="modal-head" style={{ background: c.bg }}>
          <div className="modal-htitle" style={{ color: c.fg, textTransform:'capitalize' }}>
            {item.status.replace('_',' ')} Assignments
          </div>
          <button id="status-detail-close-btn" className="modal-close" onClick={() => showModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'16px' }}>
            <div style={{ fontSize:'56px', fontWeight:800, color:c.fg, lineHeight:1 }}>{item.count}</div>
            <div>
              <div style={{ fontSize:'15px', fontWeight:700, color:'var(--n1)' }}>assignments</div>
              <div style={{ fontSize:'13px', color:'var(--n4)' }}>{item.pct}% of total pipeline</div>
            </div>
          </div>
          <div className="mactions">
            <button id="status-detail-dismiss-btn" className="btn btn-p" onClick={() => showModal(null)}>Close</button>
          </div>
        </div>
      </div>
    );
  };

  const openRfpDetail = (d) => {
    showModal(
      <div>
        <div className="modal-head grad">
          <div className="modal-htitle">📋 {d.rfp_reference} — Compliance Detail</div>
          <button id="rfp-detail-close-btn" className="modal-close" onClick={() => showModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'16px' }}>
            <div style={{ fontSize:'52px', fontWeight:800, color:'var(--p)', lineHeight:1 }}>
              {d.compliance_pct}<span style={{ fontSize:'20px' }}>%</span>
            </div>
            <div>
              <div style={{ fontSize:'15px', fontWeight:700, color:'var(--n1)' }}>Compliance Rate</div>
              <div style={{ fontSize:'13px', color:'var(--n4)' }}>Total: {d.total} assignments</div>
            </div>
          </div>
          {[
            ['Complete',  d.complete||0,  STATUS.complete],
            ['On Track',  d.on_track||0,  STATUS.active],
            ['At Risk',   d.at_risk||0,   STATUS.at_risk],
            ['Overdue',   d.overdue||0,   STATUS.overdue],
          ].map(([label, count, c]) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
              <div style={{ width:'10px', height:'10px', borderRadius:'3px', background:c.bar, flexShrink:0 }}></div>
              <span style={{ flex:1, fontSize:'14px', color:'var(--n2)' }}>{label}</span>
              <span style={{ fontWeight:800, color:c.fg, fontSize:'15px' }}>{count}</span>
            </div>
          ))}
          <div className="mactions" style={{ marginTop:'14px' }}>
            <button id="rfp-detail-dismiss-btn" className="btn btn-p" onClick={() => showModal(null)}>Close</button>
          </div>
        </div>
      </div>
    );
  };

  const DonutChart = () => {
    const total = statusBreakdown.reduce((s, r) => s + r.count, 0) || 1;
    const r = 70, cx = 100, cy = 100, sw = 22;
    const circ = 2 * Math.PI * r;
    let off = 0;
    const slices = statusBreakdown.map(d => {
      const len = (d.count / total) * circ;
      const slice = { ...d, len, off, color: (STATUS[d.status] || STATUS.pending).bar };
      off += len;
      return slice;
    });
    return (
      <svg viewBox="0 0 200 200" style={{ width: '160px', height: '160px', flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E2E8F0" strokeWidth={sw} />
        {slices.map(s => (
          <circle
            key={s.status}
            id={`status-${s.status}-slice`}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={sw}
            strokeDasharray={`${s.len} ${circ - s.len}`}
            strokeDashoffset={circ / 4 - s.off}
            strokeLinecap="butt"
            style={{ cursor: 'pointer', transition: 'opacity .15s' }}
            onClick={() => openStatusDetail(s)}
            onMouseEnter={e => e.target.style.opacity = '.75'}
            onMouseLeave={e => e.target.style.opacity = '1'}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: '26px', fontWeight: 800, fill: '#0F172A', fontFamily: 'Poppins,sans-serif' }}>{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: '10px', fill: '#94A3B8', fontFamily: 'Poppins,sans-serif', fontWeight: 700, letterSpacing: '.08em' }}>TOTAL</text>
        <text x={cx} y={cy + 28} textAnchor="middle" style={{ fontSize: '9px', fill: '#5929d0', fontFamily: 'Poppins,sans-serif', fontWeight: 600 }}>assignments</text>
      </svg>
    );
  };

  const alerts = [
    ...(metrics.overdue_count > 0 ? [{ t:'er', txt:`${metrics.overdue_count} assignment${metrics.overdue_count!==1?'s':''} overdue — immediate action required` }] : []),
    ...(metrics.at_risk_count > 0 ? [{ t:'wn', txt:`${metrics.at_risk_count} assignment${metrics.at_risk_count!==1?'s':''} at risk of missing deadline` }] : []),
    ...(metrics.pending_hil > 0   ? [{ t:'pp', txt:`${metrics.pending_hil} training recommendation${metrics.pending_hil!==1?'s':''} awaiting HIL approval` }] : []),
  ];

  return (
    <div className="screen active">
      <div className="content-area">

        {/* ── KPI Grid ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'14px' }}>
          {kpis.map(k => (
            <div
              key={k.key}
              id={`kpi-${k.key}-card`}
              onClick={() => openKpiDetail(k)}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderLeft: `4px solid ${k.color}`,
                borderRadius: '10px',
                padding: '14px 16px 12px',
                cursor: 'pointer',
                transition: 'transform .15s, box-shadow .15s',
                boxShadow: '0 1px 4px rgba(0,0,0,.05)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.10)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.05)'; }}
            >
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                <span style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--n4)' }}>{k.label}</span>
                <div style={{ width:'26px', height:'26px', borderRadius:'7px', background:`${k.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {kpiIcon(k.key, k.color)}
                </div>
              </div>
              <div style={{ fontSize:'30px', fontWeight:800, color:'var(--n0)', lineHeight:1, marginBottom:'3px' }}>
                {k.val}<span style={{ fontSize:'13px', fontWeight:600, color:'var(--n4)', marginLeft:'2px' }}>{k.unit}</span>
              </div>
              <div style={{ fontSize:'11px', color:'var(--n5)', marginBottom: k.trend ? '5px' : 0 }}>{k.sub}</div>
              {k.trend && (
                <span style={{ display:'inline-flex', alignItems:'center', gap:'2px', fontSize:'11px', fontWeight:700, color: k.up ? '#15803D' : '#B91C1C' }}>
                  {k.up ? '↑' : '↓'} {k.trend}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* ── Charts Row ── */}
        <div className="section-label">Status Breakdown & RFP Compliance</div>
        <div className="two-col" style={{ marginBottom:'14px' }}>

          {/* Donut — bigger React SVG */}
          <div className="card" style={{ cursor:'default' }}>
            <div className="card-head">
              <div className="card-title">Assignment Status</div>
            </div>
            <div style={{ padding:'16px 18px', display:'flex', alignItems:'center', gap:'18px' }}>
              <DonutChart />
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'7px' }}>
                {statusBreakdown.map(d => {
                  const c = STATUS[d.status] || STATUS.pending;
                  return (
                    <div
                      key={d.status}
                      onClick={() => openStatusDetail(d)}
                      style={{
                        display:'flex', alignItems:'center', gap:'8px',
                        cursor:'pointer', borderRadius:'8px', padding:'6px 8px',
                        background:'transparent', transition:'background .12s',
                        border:'1px solid transparent',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = c.bg; e.currentTarget.style.borderColor = c.bar + '44'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                    >
                      <div style={{ width:'10px', height:'10px', borderRadius:'3px', background:c.bar, flexShrink:0 }}></div>
                      <span style={{ flex:1, color:'var(--n2)', textTransform:'capitalize', fontSize:'13px' }}>{d.status.replace('_',' ')}</span>
                      <span style={{ fontWeight:800, color:c.fg, fontSize:'14px' }}>{d.count}</span>
                      <span style={{ color:'var(--n4)', minWidth:'32px', textAlign:'right', fontSize:'12px' }}>{d.pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Motion Bar Chart — click bar to see RFP detail */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">RFP Compliance</div>
              <span style={{ fontSize:'10px', color:'var(--n4)', fontWeight:500 }}>Click a bar for detail</span>
            </div>
            <div style={{ padding:'16px 18px' }}>
              <MotionBarChart rfpProgress={rfpProgress} onBarClick={openRfpDetail} />
              <div style={{ display:'flex', gap:'14px', marginTop:'8px', fontSize:'11px', fontWeight:600, flexWrap:'wrap' }}>
                <span style={{ color:'#5929d0' }}>● Compliance %</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Alerts as Grid Cards ── */}
        {alerts.length > 0 && (
          <>
            <div className="section-label">
              System Alerts
              <span className="badge b-er" style={{ marginLeft:'8px' }}>{alerts.length} Active</span>
            </div>
            <div className="alert-grid">
              {alerts.map((a, i) => {
                const c = a.t === 'er'
                  ? { bg:'#FEE2E2', fg:'#B91C1C', border:'rgba(220,38,38,.25)', stroke:'#B91C1C' }
                  : a.t === 'wn'
                  ? { bg:'#FEF3C7', fg:'#92400E', border:'rgba(228,144,46,.25)', stroke:'#E4902E' }
                  : { bg:'#E8E5FF', fg:'#5929d0', border:'rgba(89,41,208,.25)', stroke:'#5929d0' };
                const icon = a.t === 'pp'
                  ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke={c.stroke} strokeWidth="1.5" strokeLinecap="round"/><line x1="8" y1="6" x2="8" y2="9" stroke={c.stroke} strokeWidth="1.8" strokeLinecap="round"/><circle cx="8" cy="11" r=".7" fill={c.stroke}/></svg>
                  : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3L2.5 13h11L8 3z" stroke={c.stroke} strokeWidth="1.5" strokeLinejoin="round"/><line x1="8" y1="7" x2="8" y2="10" stroke={c.stroke} strokeWidth="1.8" strokeLinecap="round"/><circle cx="8" cy="11.5" r=".7" fill={c.stroke}/></svg>;
                return (
                  <div key={i} className="alert-card" style={{ background:c.bg, borderColor:c.border }}>
                    <span style={{ flexShrink:0, display:'flex', alignItems:'center' }}>{icon}</span>
                    <div>
                      <div style={{ fontSize:'13.5px', fontWeight:600, color:c.fg }}>{a.txt}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AnalyticsScreen;
