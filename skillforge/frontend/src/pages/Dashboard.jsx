import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Badge, Empty, Ring, Stat, timeAgo } from '../ui';

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { api.dashboard().then(setD).catch((e) => setErr(e.message)); }, []);

  if (err) return <div className="card" style={{ color: 'var(--err)' }}>{err}</div>;
  if (!d) return <div className="card">Loading your learning world…</div>;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 16 }}>
      {/* Welcome + readiness */}
      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'stretch' }}>
        <div className="card card--hero">
          <div className="glow" />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{greet},</div>
            <h1 style={{ fontSize: 26, margin: '2px 0 6px' }}>{d.welcome.name} 👋</h1>
            <div style={{ fontSize: 12.5, opacity: 0.9 }}>
              {d.welcome.department} · {d.welcome.resource_code}
            </div>
            <div style={{ display: 'flex', gap: 26, marginTop: 22, flexWrap: 'wrap' }}>
              <div><b style={{ fontSize: 24, fontFamily: 'Sora' }}>🔥 {d.streak}</b><div style={{ fontSize: 10.5, opacity: .85 }}>DAY STREAK</div></div>
              <div><b style={{ fontSize: 24, fontFamily: 'Sora' }}>{d.hours_completed}h</b><div style={{ fontSize: 10.5, opacity: .85 }}>HOURS COMPLETED</div></div>
              <div><b style={{ fontSize: 24, fontFamily: 'Sora' }}>🎓 {d.certificates_earned}</b><div style={{ fontSize: 10.5, opacity: .85 }}>CERTIFICATES</div></div>
            </div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ring pct={d.readiness} size={128} sub="READINESS" />
          <div className="sub" style={{ textAlign: 'center', maxWidth: 220 }}>{d.readiness_note}</div>
        </div>
      </div>

      {/* Programs + right rail */}
      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h3>📚 Assigned Learning Programs</h3>
            {d.programs.length === 0 && <Empty text="No programs assigned yet — the Talent Nurturing Agent will enrol you when a skill gap is identified." />}
            {d.programs.map((p) => (
              <Link to={`/course/${p.assignment_id}`} key={p.assignment_id}>
                <div className="module" style={{ cursor: 'pointer' }}>
                  <div style={{ flex: 1 }}>
                    <b>{p.program}</b>
                    <div className="meta">{p.cert} · due {p.deadline}</div>
                    <div className="pbar" style={{ marginTop: 8 }}><i style={{ width: `${p.pct}%` }} /></div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <b style={{ fontFamily: 'Sora', fontSize: 17 }}>{p.pct}%</b>
                    <div><Badge kind={p.status}>{p.status.replace('_', ' ')}</Badge></div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="card">
            <h3>✨ Recommended for you</h3>
            {d.recommended.length === 0 && <Empty icon="🎯" text="You're enrolled in everything relevant right now." />}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {d.recommended.map((r) => (
                <div key={r.program_name} className="module" style={{ margin: 0, display: 'block' }}>
                  <b style={{ fontSize: 12.5 }}>{r.program_name}</b>
                  <div className="meta" style={{ marginTop: 4 }}>{r.skill_category} · ~{r.hours}h</div>
                  <div className="sub" style={{ marginTop: 6 }}>Ask your Talent Lead to assign it</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h3>⏰ Upcoming deadlines</h3>
            {d.deadlines.length === 0 && <Empty icon="🌤️" text="Nothing due — enjoy the calm." />}
            {d.deadlines.map((x) => (
              <div key={x.assignment_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12 }}>
                  <b>{x.program}</b>
                  <div className="sub">{x.deadline}</div>
                </div>
                <Badge kind={x.overdue ? 'overdue' : x.days_left <= 7 ? 'at_risk' : 'active'}>
                  {x.overdue ? 'overdue' : `${x.days_left}d left`}
                </Badge>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>🕐 Recent activity</h3>
            <div className="timeline">
              {d.recent_activity.length === 0 && <Empty icon="🌱" text="Your journey starts with the first module." />}
              {d.recent_activity.map((a) => (
                <div className="tl-item" key={a._id}>
                  <b>{a.message}</b>
                  <span>{timeAgo(a.ts)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>📣 Announcements</h3>
            {d.announcements.length === 0 && <Empty icon="📭" text="No announcements yet." />}
            {d.announcements.map((a) => (
              <div key={a._id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <b style={{ fontSize: 12.5 }}>{a.title}</b>
                <p className="sub" style={{ marginTop: 3, lineHeight: 1.5 }}>{a.body}</p>
                <span className="sub">{a.author} · {timeAgo(a.ts)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
