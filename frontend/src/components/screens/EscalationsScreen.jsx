import React from 'react';
import { useData } from '../../DataContext';
import { api } from '../../api';

const EscalationsScreen = ({ showModal, showToast, pushLog }) => {
  const { escalations, setEscalations, loading } = useData();

  const openEscalations = escalations;

  const showExtendModal = (eid) => {
    showModal(
      <div>
        <div className="modal-head">
          <div className="modal-htitle">⏱ Extend Deadline</div>
          <button id="extend-deadline-close-btn" className="modal-close" onClick={() => showModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '14px', color: 'var(--n2)', marginBottom: '14px' }}>
            Select a new completion deadline. The tracker will update automatically.
          </p>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--n4)', display: 'block', marginBottom: '5px' }}>
              New Deadline
            </label>
            <input type="date" className="cal-inp" id="nd-inp" min={new Date().toISOString().split('T')[0]} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--n4)', display: 'block', marginBottom: '5px' }}>
              Reason
            </label>
            <textarea
              style={{
                width: '100%', border: '1.5px solid var(--n6)', borderRadius: '8px',
                padding: '8px 12px', fontFamily: 'Poppins, sans-serif', fontSize: '13px',
                resize: 'vertical', minHeight: '70px', outline: 'none'
              }}
              id="nd-notes" placeholder="Reason for extension…"
            ></textarea>
          </div>
          <div className="mactions">
            <button id="extend-deadline-confirm-btn" className="btn btn-wn" onClick={() => submitExtend(eid)}>Confirm Extension</button>
            <button id="extend-deadline-cancel-btn" className="btn btn-gh" onClick={() => showModal(null)}>Cancel</button>
          </div>
        </div>
      </div>
    );
  };

  const submitExtend = async (eid) => {
    const nd = document.getElementById('nd-inp')?.value;
    const notes = document.getElementById('nd-notes')?.value || 'Deadline extended';
    if (!nd) { showToast('⚠ Please select a new deadline'); return; }
    const esc = escalations.find(e => e.id === eid);
    showModal(null);
    try {
      await api.resolveEscalation(eid, { action: 'extend_deadline', new_deadline: nd, resolution_notes: notes, resolved_by: 'talent_lead_01' });
      setEscalations(prev => prev.map(e => e.id === eid ? { ...e, status: 'resolved_extend' } : e));
      showToast(`✅ Deadline extended to ${nd}`);
      pushLog({ level: 'action', message: `Deadline extended to ${nd}: ${esc?.assignment?.resource?.full_name}`, action_type: 'extend_deadline', actor: 'talent_lead_01' });
    } catch { showToast('⚠ Action failed — check backend connection'); }
  };

  // Confirmation popup before any action
  const confirmAction = (eid, action) => {
    const labels = { extend_deadline: 'Extend Deadline', replace_resource: 'Replace Resource', accept_risk: 'Accept Risk' };
    const esc = escalations.find(e => e.id === eid);
    const name = esc?.assignment?.resource?.full_name || 'Unknown';

    if (action === 'extend_deadline') { showExtendModal(eid); return; }

    showModal(
      <div>
        <div className="modal-head">
          <div className="modal-htitle">⚠ Confirm: {labels[action]}</div>
          <button id="escalation-confirm-close-btn" className="modal-close" onClick={() => showModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '14px', color: 'var(--n2)', marginBottom: '6px' }}>
            Are you sure you want to <strong>{labels[action]}</strong> for <strong>{name}</strong>?
          </p>
          <p style={{ fontSize: '13px', color: 'var(--n4)', marginBottom: '14px' }}>
            This action cannot be undone.
          </p>
          <textarea
            style={{
              width: '100%', border: '1.5px solid var(--n6)', borderRadius: '8px',
              padding: '8px 12px', fontFamily: 'Poppins, sans-serif', fontSize: '13px',
              resize: 'vertical', minHeight: '60px', outline: 'none'
            }}
            id="res-notes" placeholder="Optional notes…"
          ></textarea>
          <div className="mactions" style={{ marginTop: '12px' }}>
            <button id="escalation-confirm-resolve-btn" className="btn btn-p" onClick={() => executeResolve(eid, action)}>Confirm</button>
            <button id="escalation-confirm-cancel-btn" className="btn btn-gh" onClick={() => showModal(null)}>Cancel</button>
          </div>
        </div>
      </div>
    );
  };

  const executeResolve = async (eid, action) => {
    const notes = document.getElementById('res-notes')?.value || action;
    const esc = escalations.find(e => e.id === eid);
    showModal(null);
    try {
      await api.resolveEscalation(eid, { action, resolution_notes: notes, resolved_by: 'talent_lead_01' });
      setEscalations(prev => prev.map(e => e.id === eid ? { ...e, status: `resolved_${action}` } : e));
      showToast(`✅ Resolved: ${action.replace('_', ' ')}`);
      pushLog({ level: 'action', message: `Escalation resolved (${action}): ${esc?.assignment?.resource?.full_name}`, action_type: `escalation_${action}`, actor: 'talent_lead_01' });
    } catch { showToast('⚠ Action failed — check backend connection'); }
  };

  const escStatusBadge = (status, assignmentStatus) => {
    if (status === 'open') {
      const ov = assignmentStatus === 'overdue';
      return (
        <span className={`badge ${ov ? 'b-er' : 'b-wn'}`} style={{ display:'inline-flex', alignItems:'center', gap:'5px' }}>
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><circle cx="4" cy="4" r="3.5" fill={ov ? '#DC2626' : '#E4902E'}/></svg>
          {ov ? 'Overdue' : 'At Risk'}
        </span>
      );
    }
    if (status?.startsWith('resolved')) {
      const action = status.replace('resolved_', '').replace('_', ' ');
      return <span className="badge b-ok">Resolved · {action}</span>;
    }
    return <span className="badge b-nt">{status}</span>;
  };

  return (
    <div className="screen active" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '16px 20px 16px', overflow: 'hidden' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--n5)', fontSize: '14px' }}>Loading…</div>
        )}
        {!loading && openEscalations.length > 0 && (
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: 0 }}>
            <div className="ovx" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: 0 }}>
              <table className="tbl tbl-sm" style={{ minWidth: '900px' }}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Resource</th>
                    <th>ID</th>
                    <th>Program</th>
                    <th>Due</th>
                    <th>Content</th>
                    <th>Test</th>
                    <th>Overall</th>
                    <th>Days Left</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {openEscalations.map(e => {
                    const a = e.assignment;
                    const snap = e.progress_snapshot || {};
                    return (
                      <tr key={e.id}>
                        <td>{escStatusBadge(e.status, a.status)}</td>
                        <td style={{ fontWeight: 600, fontSize: '14px' }}>{a.resource?.full_name}</td>
                        <td><span className="id-chip">{a.resource?.resource_code}</span></td>
                        <td style={{ fontSize: '13px', color: 'var(--n2)' }}>{a.program?.program_name}</td>
                        <td style={{ fontSize: '13px', color: 'var(--n4)' }}>{a.deadline}</td>
                        <td style={{ fontWeight: 700, color: 'var(--p)' }}>{snap.content || 0}%</td>
                        <td style={{ fontWeight: 700, color: 'var(--wn)' }}>{snap.test || 0}%</td>
                        <td style={{ fontWeight: 700 }}>{snap.overall || a.overall_progress || 0}%</td>
                        <td style={{ fontWeight: 700, color: (snap.days_remaining || 0) < 0 ? 'var(--er)' : 'var(--wn)' }}>
                          {snap.days_remaining || 0}
                        </td>
                        <td>
                          {e.status === 'open' ? (
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <button id={`escalation-extend-${e.id}-btn`} className="btn btn-wn" style={{ fontSize: '11px', padding: '5px 10px' }} onClick={() => confirmAction(e.id, 'extend_deadline')}>Extend</button>
                              <button id={`escalation-replace-${e.id}-btn`} className="btn btn-er" style={{ fontSize: '11px', padding: '5px 10px' }} onClick={() => confirmAction(e.id, 'replace_resource')}>Replace</button>
                              <button id={`escalation-accept-${e.id}-btn`} className="btn btn-gh" style={{ fontSize: '11px', padding: '5px 10px' }} onClick={() => confirmAction(e.id, 'accept_risk')}>Accept</button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--n5)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '8px 18px', fontSize: '11px', color: 'var(--n5)', borderTop: '1px solid var(--n7)', flexShrink: 0 }}>
              {openEscalations.filter(e => e.status === 'open').length} open · {openEscalations.length} total
            </div>
          </div>
        )}
        {!loading && openEscalations.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--n5)', fontSize: '14px' }}>✅ No escalations found</div>
        )}
      </div>
    </div>
  );
};

export default EscalationsScreen;
