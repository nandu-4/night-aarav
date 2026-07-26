import React, { useState } from 'react';
import { useData } from '../../DataContext';

const TrackerScreen = ({ showModal, showToast, pushLog }) => {
  const { assignments, loading } = useData();
  const [trFilter, setTrFilter] = useState('all');

  // Aarav (the assistant) can drive the status filter by voice/chat command
  React.useEffect(() => {
    const onFilter = (e) => {
      if (e.detail?.screen === 'tracker' && e.detail.filter) setTrFilter(e.detail.filter);
    };
    window.addEventListener('aarav-filter', onFilter);
    return () => window.removeEventListener('aarav-filter', onFilter);
  }, []);

  const filteredAssignments = assignments.filter(a => {
    return trFilter === 'all' || a.status === trFilter;
  });

  const cd = (s) => {
    const c = s === 'complete' ? '#16A34A' : s === 'in_progress' ? '#E4902E' : s === 'failed' ? '#DC2626' : '#94A3B8';
    return <div className="cdot" style={{ background: c }}></div>;
  };

  const sb = (s) => {
    const m = { complete: 'b-ok', active: 'b-pp', at_risk: 'b-wn', overdue: 'b-er', pending: 'b-nt', cancelled: 'b-nt' };
    return <span className={`badge ${m[s] || 'b-nt'}`}>{s.replace('_', ' ')}</span>;
  };

  const pc = (p) => p >= 75 ? '#16A34A' : p >= 35 ? '#E4902E' : '#DC2626';

  const showAssignment = (id) => {
    const a = assignments.find(x => x.id === id);
    if (!a) return;

    const cs = (s) => ({
      complete: '✅ Complete',
      in_progress: '⏳ In Progress',
      failed: '❌ Failed',
      not_started: '○ Not Started'
    }[s] || s);

    const p = a.overall_progress;
    const progressColor = p >= 75 ? 'var(--ok)' : p >= 35 ? 'var(--wn)' : 'var(--er)';

    showModal(
      <div>
        <div className="modal-head grad">
          <div className="modal-htitle">{a.resource?.full_name} — {a.program?.program_name}</div>
          <button id="assignment-detail-close-btn" className="modal-close" onClick={() => showModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 0', marginBottom: '12px', borderBottom: '1px solid var(--n7)' }}>
            <svg viewBox="0 0 72 72" style={{ width: '58px', height: '58px', flexShrink: 0, transform: 'rotate(-90deg)' }}>
              <circle cx="36" cy="36" r="28" fill="none" stroke="#E2E8F0" strokeWidth="8" />
              <circle
                cx="36" cy="36" r="28" fill="none"
                stroke={progressColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 - (p / 100) * 2 * Math.PI * 28}`}
              />
            </svg>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--n0)' }}>{p}%</div>
              <div style={{ fontSize: '12px', color: 'var(--n4)' }}>
                {p === 100 ? 'All components complete' : p >= 75 ? 'Final stretch' : p >= 35 ? 'In progress' : 'Needs attention'}
              </div>
            </div>
          </div>
          {[
            ['Resource ID', <span className="id-chip">{a.resource?.resource_code}</span>],
            ['Full Name', a.resource?.full_name],
            ['Role', a.resource?.role],
            ['RFP', a.rfp?.rfp_reference],
            ['Program', a.program?.program_name],
            ['Deadline', a.deadline],
            ['Content', cs(a.content_status)],
            ['Online Test', cs(a.test_status) + (a.test_score != null ? ` · Score: ${a.test_score}%` : '')],
            ['Case Study', cs(a.case_study_status) + (a.case_study_score != null ? ` · Score: ${a.case_study_score}%` : '')],
            ['Attempts', a.test_attempts || 0],
            ['Notes', a.notes || '—'],
          ].map(([k, v]) => (
            <div key={k} className="kv">
              <span className="kk">{k}</span>
              <span className="kv-val">{v || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    );
    pushLog({ level: 'info', message: `Viewed: ${a.resource?.full_name} — ${a.program?.program_name}`, action_type: 'view_assignment', actor: 'user' });
  };

  return (
    <div className="screen active" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '16px 20px 16px', overflow: 'hidden' }}>
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: 0 }}>
          <div className="frow">
            {['all', 'active', 'at_risk', 'overdue', 'complete'].map(f => (
              <button
                key={f}
                id={`tracker-filter-${f.replace('_', '-')}-btn`}
                className={`fbtn ${trFilter === f ? 'on' : ''}`}
                onClick={() => setTrFilter(f)}
              >
                {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </button>
            ))}
          </div>
          <div className="ovx" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: 0 }}>
            <table className="tbl" style={{ minWidth: '760px' }}>
              <thead>
                <tr>
                  <th>Resource ID</th>
                  <th>Name</th>
                  <th>Program</th>
                  <th>RFP</th>
                  <th>C · T · CS</th>
                  <th>Progress</th>
                  <th>Deadline</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: 'var(--n5)', padding: '20px', fontSize: '14px' }}>
                      Loading…
                    </td>
                  </tr>
                ) : filteredAssignments.map(a => (
                  <tr key={a.id} id={`tracker-row-${a.id}`} onClick={() => showAssignment(a.id)}>
                    <td><span className="id-chip">{a.resource?.resource_code || '—'}</span></td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--n0)', fontSize: '14px' }}>{a.resource?.full_name || '—'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--n5)' }}>{a.resource?.role || ''}</div>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--n2)' }}>{a.program?.program_name || '—'}</td>
                    <td style={{ color: 'var(--p)', fontWeight: 700, fontSize: '13px' }}>{a.rfp?.rfp_reference || '—'}</td>
                    <td><div className="cdots">{cd(a.content_status)}{cd(a.test_status)}{cd(a.case_study_status)}</div></td>
                    <td>
                      <div className="prog-wrap">
                        <div className="prog-bg" style={{ width: '65px' }}>
                          <div className="prog-fill" style={{ width: `${a.overall_progress}%`, background: pc(a.overall_progress) }}></div>
                        </div>
                        <span className="prog-pct" style={{ color: pc(a.overall_progress) }}>{a.overall_progress}%</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--n4)' }}>{a.deadline || '—'}</td>
                    <td>{sb(a.status)}</td>
                  </tr>
                ))}
                {!loading && filteredAssignments.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: 'var(--n5)', padding: '20px', fontSize: '14px' }}>
                      No records match
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '8px 18px', fontSize: '11px', color: 'var(--n5)', borderTop: '1px solid var(--n7)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
            <span>C = Content · T = Online Test · CS = Case Study</span>
            <span>{filteredAssignments.length} of {assignments.length} records</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackerScreen;
