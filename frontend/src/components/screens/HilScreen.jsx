import React from 'react';
import { useData } from '../../DataContext';
import { api } from '../../api';

const HilScreen = ({ showModal, showToast, pushLog }) => {
  const { hilItems, setHilItems, loading } = useData();

  // Coordinator drafts never appear here — this queue is decisions only
  const pendingItems = hilItems.filter(h => h.status !== 'draft');

  const hilAct = (id, action) => {
    showModal(
      <div>
        <div className="modal-head">
          <div className="modal-htitle">Confirm HIL {action === 'approve' ? 'Approval' : 'Rejection'}</div>
          <button id="hil-confirm-close-btn" className="modal-close" onClick={() => showModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '14px', color: 'var(--n2)', marginBottom: '12px' }}>
            {action === 'approve' ? 'Approve and initiate this training assignment?' : 'Reject this recommendation? The assignment will be cancelled.'}
          </p>
          <textarea
            style={{
              width: '100%', border: '1.5px solid var(--n6)', borderRadius: '8px',
              padding: '8px 12px', fontFamily: 'Poppins, sans-serif', fontSize: '13px',
              resize: 'vertical', minHeight: '60px', outline: 'none'
            }}
            id="hil-act-notes"
            placeholder={action === 'approve' ? 'Optional approval notes…' : 'Reason for rejection…'}
          ></textarea>
          <div className="mactions" style={{ marginTop: '12px' }}>
            <button id="hil-confirm-action-btn" className={`btn ${action === 'approve' ? 'btn-ok' : 'btn-er'}`} onClick={() => confirmHilAct(id, action)}>
              Confirm {action === 'approve' ? 'Approval' : 'Rejection'}
            </button>
            <button id="hil-confirm-cancel-btn" className="btn btn-gh" onClick={() => showModal(null)}>Cancel</button>
          </div>
        </div>
      </div>
    );
  };

  const confirmHilAct = async (id, action) => {
    const notes = document.getElementById('hil-act-notes')?.value || '';
    const item = hilItems.find(x => x.id === id);
    showModal(null);
    try {
      await api.hilAction(id, { action, reviewer_id: 'talent_lead_01', reviewer_notes: notes });
      setHilItems(prev => prev.filter(h => h.id !== id));
      showToast(`✅ HIL ${action === 'approve' ? 'approved' : 'rejected'}`);
      pushLog({ level: 'action', message: `HIL ${action}: ${item?.assignment?.resource?.full_name}`, action_type: `hil_${action}`, actor: 'talent_lead_01' });
    } catch { showToast('⚠ Action failed — check backend connection'); }
  };

  const statusBadge = (s) => {
    if (s === 'pending') return <span className="badge b-pp">Pending HIL</span>;
    if (s === 'approved') return <span className="badge b-ok">Approved</span>;
    if (s === 'rejected') return <span className="badge b-er">Rejected</span>;
    return <span className="badge b-nt">{s}</span>;
  };

  return (
    <div className="screen active" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '16px 20px 16px', overflow: 'hidden' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--n5)', fontSize: '14px' }}>Loading…</div>
        )}
        {!loading && pendingItems.length > 0 && (
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: 0 }}>
            <div className="ovx" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: 0 }}>
              <table className="tbl" style={{ minWidth: '800px' }}>
                <thead>
                  <tr>
                    <th>Resource</th>
                    <th>ID</th>
                    <th>Program</th>
                    <th>RFP</th>
                    <th>Modules</th>
                    <th>Est. Hours</th>
                    <th>Deadline</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.map(h => {
                    const a = h.assignment;
                    const prog = h.proposed_program || {};
                    return (
                      <tr key={h.id}>
                        <td style={{ fontWeight: 600, fontSize: '14px' }}>{a.resource?.full_name}</td>
                        <td><span className="id-chip">{a.resource?.resource_code}</span></td>
                        <td style={{ fontSize: '13px', color: 'var(--n2)' }}>{prog.program || a.program?.program_name}</td>
                        <td style={{ color: 'var(--p)', fontWeight: 700, fontSize: '13px' }}>{a.rfp?.rfp_reference}</td>
                        <td style={{ textAlign: 'center' }}>{prog.modules || 3}</td>
                        <td style={{ textAlign: 'center' }}>{prog.est_hours || '—'}h</td>
                        <td style={{ fontSize: '13px', color: 'var(--n4)' }}>{prog.deadline || a.deadline}</td>
                        <td>{statusBadge(h.status)}</td>
                        <td>
                          {h.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <button id={`hil-approve-${h.id}-btn`} className="btn btn-ok" style={{ fontSize: '11px', padding: '5px 10px' }} onClick={() => hilAct(h.id, 'approve')}>Approve</button>
                              <button id={`hil-reject-${h.id}-btn`} className="btn btn-er" style={{ fontSize: '11px', padding: '5px 10px' }} onClick={() => hilAct(h.id, 'reject')}>Reject</button>
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
              {pendingItems.filter(h => h.status === 'pending').length} pending · {pendingItems.length} total
            </div>
          </div>
        )}
        {!loading && pendingItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--n5)', fontSize: '14px' }}>✅ No HIL reviews found</div>
        )}
      </div>
    </div>
  );
};

export default HilScreen;
