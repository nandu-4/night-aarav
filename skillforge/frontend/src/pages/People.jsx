import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Badge, Empty } from '../ui';

/* Manager / Lead / Admin — every employee's live progress (pulled from TN). */
export function People() {
  const [rows, setRows] = useState(null);
  const [openRow, setOpenRow] = useState(null);
  useEffect(() => { api.employees().then(setRows).catch(() => setRows([])); }, []);

  if (!rows) return <div className="card">Loading live progress from the Talent Nurturing Agent…</div>;

  return (
    <div className="card">
      <h3>👥 Employees · live from the Talent Nurturing Agent</h3>
      {rows.length === 0 && <Empty text="No employees synced yet." />}
      <table className="table">
        <thead><tr><th>Employee</th><th>Department</th><th>Programs</th><th>Avg readiness</th><th>Hours</th><th>Overdue</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <React.Fragment key={r.email}>
              <tr style={{ cursor: 'pointer' }} onClick={() => setOpenRow(openRow === r.email ? null : r.email)}>
                <td><b>{r.name}</b><div className="sub">{r.resource_code}</div></td>
                <td>{r.department}</td>
                <td>{r.programs.length}</td>
                <td style={{ minWidth: 130 }}>
                  <div className="pbar"><i style={{ width: `${r.readiness}%` }} /></div>
                  <span className="sub">{r.readiness}%</span>
                </td>
                <td>{r.hours}h</td>
                <td>{r.overdue > 0 ? <Badge kind="overdue">{r.overdue}</Badge> : '—'}</td>
              </tr>
              {openRow === r.email && r.programs.map((p) => (
                <tr key={p.program} style={{ background: 'var(--grad-soft)' }}>
                  <td colSpan={2} style={{ paddingLeft: 30 }}>{p.program}</td>
                  <td><Badge kind={p.status}>{p.status.replace('_', ' ')}</Badge></td>
                  <td>{p.pct}%</td>
                  <td className="sub">test {p.test_passed ? '✓' : '—'} · project {p.case_submitted ? '✓' : '—'}</td>
                  <td className="sub">{p.deadline}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Manager — review Stage-3 project submissions. */
export function Submissions({ user }) {
  const [rows, setRows] = useState(null);
  const [drafts, setDrafts] = useState({});
  const readOnly = user.role === 'lead';
  const load = () => api.submissions().then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  if (!rows) return <div className="card">Loading…</div>;

  const act = async (id, verdict) => {
    await api.review(id, verdict, drafts[id] || '');
    load();
  };

  return (
    <div>
      {rows.length === 0 && <div className="card"><Empty icon="📥" text="No project submissions yet." /></div>}
      {rows.map((s) => (
        <div className="card" key={s._id} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div><b>{s.name}</b> · <span className="sub">{s.program}</span></div>
            <span className="sub">{new Date(s.ts).toLocaleString()}</span>
          </div>
          <p className="sub" style={{ margin: '10px 0', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{s.text}</p>
          {s.github_url && <div className="sub">🔗 {s.github_url}</div>}
          {s.file_name && <div className="sub">📎 {s.file_name}</div>}
          <div className="sub" style={{ margin: '10px 0', fontStyle: 'italic' }}>🤖 {s.ai_review}</div>
          {s.mentor_review ? (
            <div>
              <Badge kind={s.mentor_review.verdict === 'approved' ? 'approved' : 'needs_work'}>
                {s.mentor_review.verdict.replace('_', ' ')}
              </Badge>
              <span className="sub" style={{ marginLeft: 8 }}>{s.mentor_review.comment} — {s.mentor_review.by}</span>
            </div>
          ) : readOnly ? (
            <Badge kind="pending">awaiting mentor review</Badge>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input className="input" style={{ flex: 1 }} placeholder="Feedback for the employee…"
                value={drafts[s._id] || ''} onChange={(e) => setDrafts({ ...drafts, [s._id]: e.target.value })} />
              <button className="btn btn--sm btn--teal" onClick={() => act(s._id, 'approved')}>✓ Approve</button>
              <button className="btn btn--sm btn--ghost" onClick={() => act(s._id, 'needs_work')}>Needs work</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
