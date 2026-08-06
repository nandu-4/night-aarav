import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Badge, Empty, timeAgo } from '../ui';

export function AdminConsole() {
  const [usersList, setUsersList] = useState(null);
  const [msg, setMsg] = useState('');
  const load = () => api.usersList().then(setUsersList).catch(() => setUsersList([]));
  useEffect(() => { load(); }, []);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  return (
    <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
      <div className="card">
        <h3>👤 User accounts</h3>
        {msg && <div className="sub" style={{ color: 'var(--teal-bright)', marginBottom: 8 }}>{msg}</div>}
        {!usersList ? 'Loading…' : (
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead>
            <tbody>
              {usersList.map((u) => (
                <tr key={u.email}>
                  <td><b>{u.name}</b>{u.resource_code && <div className="sub">{u.resource_code} · {u.department}</div>}</td>
                  <td className="sub">{u.email}</td>
                  <td><Badge kind={u.role === 'admin' ? 'purple' : u.role === 'employee' ? 'active' : 'complete'}>{u.role}</Badge></td>
                  <td><button className="btn btn--sm btn--ghost"
                    onClick={() => api.resetPassword(u.email).then((r) => flash(`Password for ${u.email} reset to ${r.default_password}`))}>
                    Reset password</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card">
          <h3>🔄 Talent Nurturing sync</h3>
          <p className="sub" style={{ lineHeight: 1.7, marginBottom: 12 }}>
            Pulls the latest approved learners from the Talent Nurturing Agent and creates
            accounts for anyone new.
          </p>
          <button className="btn" onClick={() => api.syncEmployees().then((r) => { flash(`Synced ${r.synced} employees ✅`); load(); })}>
            Sync employees now
          </button>
        </div>
        <div className="card">
          <h3>🛡️ Governance</h3>
          <p className="sub" style={{ lineHeight: 1.8 }}>
            SkillForge recommends; it never decides. Deployment eligibility, capability upgrades and
            certification validation are approved by the <b>Talent Lead</b> inside the Talent
            Nurturing Agent's Human-in-the-Loop queue.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Announce({ user }) {
  const [rows, setRows] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const load = () => api.announcements().then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
      <div className="card" style={{ alignSelf: 'start' }}>
        <h3>📣 New announcement</h3>
        <label className="lbl">Title</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Q3 learning sprint kicks off" />
        <label className="lbl">Message</label>
        <textarea className="input" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Broadcast to every SkillForge user…" />
        <button className="btn" style={{ marginTop: 14 }} disabled={!title.trim() || !body.trim()}
          onClick={() => api.postAnnouncement(title, body).then(() => { setTitle(''); setBody(''); load(); })}>
          Publish to everyone
        </button>
      </div>
      <div className="card">
        <h3>History</h3>
        {rows.length === 0 && <Empty icon="📭" text="Nothing announced yet." />}
        {rows.map((a) => (
          <div key={a._id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <b>{a.title}</b>
            <p className="sub" style={{ margin: '4px 0', lineHeight: 1.6 }}>{a.body}</p>
            <span className="sub">{a.author} · {timeAgo(a.ts)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Leaderboard() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.leaderboard().then(setRows).catch(() => setRows([])); }, []);
  if (!rows) return <div className="card">Loading…</div>;

  const medal = (r) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`);
  return (
    <div className="card">
      <h3>🏆 Learning leaderboard</h3>
      <table className="table">
        <thead><tr><th>Rank</th><th>Employee</th><th>Department</th><th>Certs</th><th>Points</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rank} style={r.me ? { background: 'var(--grad-soft)' } : undefined}>
              <td style={{ fontSize: 15 }}>{medal(r.rank)}</td>
              <td><b>{r.name}</b>{r.me && <Badge kind="purple"> you</Badge>}</td>
              <td className="sub">{r.department}</td>
              <td>{r.certs > 0 ? `🎓 ${r.certs}` : '—'}</td>
              <td><b style={{ fontFamily: 'Sora' }}>{r.points.toLocaleString()}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
