import React from 'react';
import { useData } from '../../DataContext';

const AuditScreen = ({ showModal, showToast, pushLog }) => {
  const { auditLogs, loading } = useData();

  const lb = (l) => {
    const map = { info: 'b-pp', warning: 'b-wn', error: 'b-er', action: 'b-ok' };
    const label = { info: 'info', warning: 'warn', error: 'error', action: 'action' };
    const cls = map[l] || 'b-nt';
    return <span className={`badge ${cls}`}>{label[l] || l}</span>;
  };

  const ft = (ts) => {
    try {
      return new Date(ts).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return ts;
    }
  };

  return (
    <div className="screen active" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '16px 20px 16px', overflow: 'hidden' }}>
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: 0 }}>
          <div className="ovx" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: 0 }}>
            <table id="audit-log-table" className="tbl" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Level</th>
                  <th>RFP</th>
                  <th>Resource ID</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--n5)', padding: '40px', fontSize: '14px' }}>Loading…</td>
                  </tr>
                ) : auditLogs.map(l => (
                  <tr key={l.id} id={`audit-row-${l.id}`}>
                    <td style={{ fontSize: '12.5px', color: 'var(--n4)', whiteSpace: 'nowrap' }}>{ft(l.ts)}</td>
                    <td>{lb(l.level)}</td>
                    <td style={{ fontSize: '12.5px', color: 'var(--p)', fontWeight: 600 }}>{l.rfp_ref || '—'}</td>
                    <td><span className="id-chip" style={{ fontSize: '12px' }}>{l.resource_id || '—'}</span></td>
                    <td style={{ fontSize: '12.5px', color: 'var(--n2)' }}>{l.action_type}</td>
                    <td style={{ fontSize: '12.5px', color: 'var(--n4)' }}>{l.actor || 'system'}</td>
                    <td style={{ fontSize: '13.5px', color: 'var(--n1)' }}>{l.message}</td>
                  </tr>
                ))}
                {!loading && auditLogs.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--n5)', padding: '40px', fontSize: '14px' }}>No entries found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};


export default AuditScreen;
