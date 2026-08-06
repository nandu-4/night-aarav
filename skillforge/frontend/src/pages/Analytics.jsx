import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Stat } from '../ui';

/* Analytics — hand-rolled SVG, one measure per chart (single hue), status
   donut with direct labels, hover tooltips everywhere, one axis per chart. */

const P = 'var(--viz-purple)';

function useTip() {
  const [tip, setTip] = useState(null); // {x, y, lines}
  const show = (e, lines) => {
    const host = e.currentTarget.closest('.chartbox').getBoundingClientRect();
    setTip({ x: e.clientX - host.left + 12, y: e.clientY - host.top - 10, lines });
  };
  return [tip, show, () => setTip(null)];
}

const Tip = ({ tip }) => tip && (
  <div style={{
    position: 'absolute', left: tip.x, top: tip.y, zIndex: 20, pointerEvents: 'none',
    background: 'var(--glass-strong)', border: '1px solid var(--border)', borderRadius: 10,
    padding: '7px 11px', fontSize: 11, boxShadow: 'var(--shadow)',
    backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', whiteSpace: 'nowrap',
  }}>
    {tip.lines.map((l, i) => <div key={i} style={{ color: i ? 'var(--t2)' : 'var(--t1)', fontWeight: i ? 400 : 700 }}>{l}</div>)}
  </div>
);

/* Horizontal magnitude bars — single hue, rounded data-end, direct labels */
function BarsH({ rows, unit = '%' }) {
  const [tip, show, hide] = useTip();
  const max = Math.max(...rows.map((r) => r.value), 1);
  const W = 460, LBL = 130, BAR = 18, GAP = 10;
  const H = rows.length * (BAR + GAP);
  return (
    <div className="chartbox" style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {rows.map((r, i) => {
          const w = Math.max(6, (r.value / max) * (W - LBL - 56));
          const y = i * (BAR + GAP);
          return (
            <g key={r.label}
              onMouseMove={(e) => show(e, [r.label, `${r.value}${unit}`])} onMouseLeave={hide}>
              <text x={LBL - 8} y={y + BAR / 2 + 4} textAnchor="end" className="axis-label" style={{ fontSize: 11, fill: 'var(--t2)' }}>{r.label}</text>
              <rect x={LBL} y={y} width={W - LBL} height={BAR} rx={4} fill="var(--border)" opacity=".35" />
              <rect x={LBL} y={y} width={w} height={BAR} rx={4} fill={P} />
              <text x={LBL + w + 8} y={y + BAR / 2 + 4} className="axis-label" style={{ fontSize: 11, fill: 'var(--t1)', fontWeight: 700 }}>
                {r.value}{unit}
              </text>
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

/* Status donut — validated trio, 2px surface gaps, direct labels + legend */
function Donut({ complete, active, overdue }) {
  const [tip, show, hide] = useTip();
  const parts = [
    { k: 'Complete', v: complete, c: 'var(--viz-teal)' },
    { k: 'Active', v: active, c: P },
    { k: 'Overdue', v: overdue, c: 'var(--viz-red)' },
  ].filter((p) => p.v > 0);
  const total = parts.reduce((a, p) => a + p.v, 0) || 1;
  const R = 62, STROKE = 26, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="chartbox" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 22 }}>
      <svg width={170} height={170} viewBox="0 0 170 170">
        {parts.map((p) => {
          const frac = p.v / total;
          const dash = Math.max(frac * C - 2, 2); // 2px surface gap between segments
          const el = (
            <circle key={p.k} cx={85} cy={85} r={R} fill="none" stroke={p.c} strokeWidth={STROKE}
              strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc * C}
              transform="rotate(-90 85 85)" style={{ cursor: 'pointer' }}
              onMouseMove={(e) => show(e, [p.k, `${p.v} programs · ${Math.round(frac * 100)}%`])} onMouseLeave={hide} />
          );
          acc += frac;
          return el;
        })}
        <text x="85" y="82" textAnchor="middle" style={{ fontSize: 26, fontWeight: 800, fill: 'var(--t1)', fontFamily: 'Sora' }}>{total}</text>
        <text x="85" y="100" textAnchor="middle" className="axis-label">programs</text>
      </svg>
      <div>
        {parts.map((p) => (
          <div key={p.k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
            <span style={{ width: 11, height: 11, borderRadius: 4, background: p.c, display: 'inline-block' }} />
            <span style={{ color: 'var(--t2)' }}>{p.k}</span>
            <b style={{ marginLeft: 'auto', paddingLeft: 14 }}>{p.v}</b>
          </div>
        ))}
      </div>
      <Tip tip={tip} />
    </div>
  );
}

/* Single-series line — 2px stroke, hover markers ≥8px, crosshair tooltip */
function Line({ points, unit = '' }) {
  const [tip, show, hide] = useTip();
  const [hover, setHover] = useState(null);
  if (points.length === 0) return <div className="sub">Not enough activity yet.</div>;
  const W = 460, H = 150, PAD = 26;
  const max = Math.max(...points.map((p) => p.v), 1);
  const x = (i) => PAD + (i * (W - PAD * 2)) / Math.max(points.length - 1, 1);
  const y = (v) => H - PAD - (v / max) * (H - PAD * 2);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.v)}`).join(' ');
  return (
    <div className="chartbox" style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}
        onMouseLeave={() => { hide(); setHover(null); }}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          const i = Math.round(((px - PAD) / (W - PAD * 2)) * (points.length - 1));
          if (i >= 0 && i < points.length) {
            setHover(i);
            show(e, [points[i].k, `${points[i].v}${unit}`]);
          }
        }}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={y(max * f)} y2={y(max * f)} className="grid-line" opacity=".5" />
        ))}
        <path d={`${d} L${x(points.length - 1)},${H - PAD} L${x(0)},${H - PAD} Z`} fill={P} opacity=".12" />
        <path d={d} fill="none" stroke={P} strokeWidth={2} strokeLinecap="round" />
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD} y2={H - PAD} stroke="var(--t3)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(points[hover].v)} r={5} fill={P} stroke="var(--bg1)" strokeWidth={2} />
          </g>
        )}
        <text x={PAD} y={H - 8} className="axis-label">{points[0].k}</text>
        <text x={W - PAD} y={H - 8} textAnchor="end" className="axis-label">{points[points.length - 1].k}</text>
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

/* Score histogram — one hue */
function Hist({ scores }) {
  const [tip, show, hide] = useTip();
  if (scores.length === 0) return <div className="sub">No assessment attempts recorded yet.</div>;
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    k: `${i * 10}–${i * 10 + 9}`,
    v: scores.filter((s) => s >= i * 10 && (i === 9 ? s <= 100 : s < i * 10 + 10)).length,
  }));
  const max = Math.max(...buckets.map((b) => b.v), 1);
  const W = 460, H = 140, PAD = 24, bw = (W - PAD * 2) / 10 - 3;
  return (
    <div className="chartbox" style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {buckets.map((b, i) => {
          const h = (b.v / max) * (H - PAD * 2);
          return (
            <g key={b.k} onMouseMove={(e) => show(e, [`Score ${b.k}%`, `${b.v} attempt${b.v === 1 ? '' : 's'}`])} onMouseLeave={hide}>
              <rect x={PAD + i * ((W - PAD * 2) / 10)} y={H - PAD - h} width={bw} height={Math.max(h, b.v ? 4 : 0)} rx={4} fill={P} />
              {i % 2 === 0 && <text x={PAD + i * ((W - PAD * 2) / 10) + bw / 2} y={H - 8} textAnchor="middle" className="axis-label">{i * 10}</text>}
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

/* Heatmap — sequential single hue via opacity steps (monotone lightness) */
function Heatmap({ data }) {
  const [tip, show, hide] = useTip();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const slots = ['00–04', '04–08', '08–12', '12–16', '16–20', '20–24'];
  const max = Math.max(...Object.values(data), 1);
  return (
    <div className="chartbox" style={{ position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `44px repeat(${slots.length}, 1fr)`, gap: 3, fontSize: 10 }}>
        <div />
        {slots.map((s) => <div key={s} className="axis-label" style={{ color: 'var(--t3)', textAlign: 'center' }}>{s}</div>)}
        {days.map((d, di) => (
          <React.Fragment key={d}>
            <div className="axis-label" style={{ color: 'var(--t3)', lineHeight: '22px' }}>{d}</div>
            {slots.map((_, si) => {
              const v = data[`${di}-${si}`] || 0;
              return (
                <div key={si} style={{
                  height: 22, borderRadius: 5,
                  background: v ? `color-mix(in oklab, var(--viz-purple) ${20 + (v / max) * 80}%, transparent)` : 'var(--border)',
                  cursor: v ? 'pointer' : 'default',
                }}
                  onMouseMove={(e) => show(e, [`${d} · ${slots[si]}`, `${v} learning event${v === 1 ? '' : 's'}`])}
                  onMouseLeave={hide} />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <Tip tip={tip} />
    </div>
  );
}

export default function Analytics() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.analytics().then(setD).catch((e) => setErr(e.message)); }, []);

  if (err) return <div className="card" style={{ color: 'var(--err)' }}>{err}</div>;
  if (!d) return <div className="card">Crunching live data from the Talent Nurturing Agent…</div>;

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <Stat icon="🧑‍🎓" value={d.employee_progress.length} label="Learners" accent />
        <Stat icon="⏱" value={`${d.avg_hours}h`} label="Avg hours / learner" />
        <Stat icon="🧠" value={d.quiz_performance.avg != null ? `${d.quiz_performance.avg}%` : '—'} label="Avg quiz score" />
        <Stat icon="🛠️" value={d.project_success} label="Projects submitted" />
        <Stat icon="🎓" value={d.certificates_issued} label="Certificates issued" accent />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        <div className="card">
          <h3>Department progress <span className="sub">avg completion</span></h3>
          <BarsH rows={d.department_progress.map((r) => ({ label: r.department, value: r.avg_pct }))} />
        </div>
        <div className="card">
          <h3>Program completion</h3>
          <Donut complete={d.completion.complete} active={d.completion.active} overdue={d.completion.overdue} />
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <h3>Learning velocity <span className="sub">events / week</span></h3>
          <Line points={d.learning_velocity.map((w) => ({ k: w.week.replace('20', ''), v: w.events }))} />
        </div>
        <div className="card">
          <h3>Quiz score distribution</h3>
          <Hist scores={d.quiz_performance.scores} />
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1.2fr' }}>
        <div className="card">
          <h3>Activity heatmap <span className="sub">last 8 weeks</span></h3>
          <Heatmap data={d.heatmap} />
        </div>
        <div className="card">
          <h3>Most requested skills <span className="sub">open programs per skill</span></h3>
          <BarsH rows={d.most_requested_skills.map((r) => ({ label: r.skill.length > 22 ? r.skill.slice(0, 21) + '…' : r.skill, value: r.open }))} unit="" />
        </div>
      </div>

      <div className="card">
        <h3>Employee progress <span className="sub">table view</span></h3>
        <table className="table">
          <thead><tr><th>Employee</th><th>Department</th><th>Programs</th><th>Avg progress</th><th>Hours</th></tr></thead>
          <tbody>
            {d.employee_progress.map((r) => (
              <tr key={r.name}>
                <td><b>{r.name}</b></td><td className="sub">{r.department}</td><td>{r.programs}</td>
                <td style={{ minWidth: 140 }}><div className="pbar"><i style={{ width: `${r.avg_pct}%` }} /></div><span className="sub">{r.avg_pct}%</span></td>
                <td>{r.hours}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
