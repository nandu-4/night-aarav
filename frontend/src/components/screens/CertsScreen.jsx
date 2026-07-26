import React, { useState } from 'react';
import { useData } from '../../DataContext';

const CertsScreen = ({ showModal, showToast, pushLog }) => {
  const { certs: certifications, loading } = useData();
  const [certFilter, setCertFilter] = useState('all');

  const filteredCerts = certFilter === 'all' ? certifications : certifications.filter(c => c.status === certFilter);

  const showCertJourney = (id) => {
    const c = certifications.find(x => x.id === id);
    if (!c) return;

    const stages = ['Gap Identified', 'Program Generated', 'HIL Approved', 'Training Assigned', 'Modules Complete', 'Test Passed', 'Case Study Done', 'Certified & Registered'];
    const done = c.status === 'registered' ? 8 : c.status === 'verified' ? 7 : 3;

    showModal(
      <div>
        <div className="modal-head grad">
          <div className="modal-htitle">Certification Journey — {c.resource?.full_name}</div>
          <button id="cert-journey-close-btn" className="modal-close" onClick={() => showModal(null)}>✕</button>
        </div>
        <div className="modal-body">
          {[
            ['Certification', c.cert_name],
            ['Resource', c.resource?.full_name],
            ['Resource ID', <span className="id-chip">{c.resource?.resource_code}</span>],
            ['Role', c.resource?.role],
            ['Program', c.program?.program_name],
            ['Verified', c.verified_date || '—'],
            ['Deployment', c.deployment_clearance || '—'],
            ['Cap. Register', c.capability_updated ? '✅ Updated' : '⏳ Pending'],
          ].map(([k, v]) => (
            <div key={k} className="kv">
              <span className="kk">{k}</span>
              <span className="kv-val">{v || '—'}</span>
            </div>
          ))}
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--n7)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--n4)', marginBottom: '10px' }}>
              Training Journey
            </div>
            {stages.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 800,
                  background: i < done ? 'var(--ok)' : i === done ? 'var(--wn)' : 'var(--n7)',
                  color: i < done || i === done ? '#fff' : 'var(--n5)'
                }}>
                  {i < done ? '✓' : i + 1}
                </div>
                <span style={{
                  fontSize: '13px',
                  color: i < done ? 'var(--ok)' : i === done ? 'var(--wn)' : 'var(--n5)',
                  fontWeight: i < done ? 600 : 400
                }}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
    pushLog({ level: 'info', message: `Cert journey: ${c.resource?.full_name} — ${c.cert_name}`, action_type: 'view_cert_journey', actor: 'user' });
  };

  return (
    <div className="screen active" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '16px 20px 16px', overflow: 'hidden' }}>
        <div className="frow" style={{ background: 'transparent', border: 'none', padding: '0 0 10px', flexShrink: 0 }}>
          {['all', 'registered', 'verified', 'pending'].map(f => (
            <button
              key={f}
              id={`certs-filter-${f}-btn`}
              className={`fbtn ${certFilter === f ? 'on' : ''}`}
              onClick={() => setCertFilter(f)}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--n5)', fontSize: '14px' }}>Loading…</div>
        )}
        {!loading && filteredCerts.length > 0 && (
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: 0 }}>
            <div className="ovx" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: 0 }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th>Certification</th>
                    <th>Resource</th>
                    <th>ID</th>
                    <th>Role</th>
                    <th>Verified</th>
                    <th>Deployment</th>
                    <th>Cap. Register</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCerts.map(c => {
                    const statusBadge = c.status === 'registered' ? 'b-ok'
                      : c.status === 'verified' ? 'b-pp' : 'b-nt';
                    return (
                      <tr key={c.id} id={`cert-row-${c.id}`} onClick={() => showCertJourney(c.id)}>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'var(--okl)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto' }}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--okd)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.5L3 3.5v3.5c0 3 2 5 5 6.5 3-1.5 5-3.5 5-6.5V3.5L8 1.5z"/><path d="M6 8l1.5 1.5 3-3"/></svg>
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, fontSize: '14px' }}>{c.cert_name || c.program?.program_name || '—'}</td>
                        <td>{c.resource?.full_name}</td>
                        <td><span className="id-chip">{c.resource?.resource_code}</span></td>
                        <td style={{ fontSize: '13px', color: 'var(--n4)' }}>{c.resource?.role}</td>
                        <td style={{ fontSize: '13px', color: 'var(--n4)' }}>{c.verified_date || '—'}</td>
                        <td style={{ fontSize: '13px', color: 'var(--n4)' }}>{c.deployment_clearance || '—'}</td>
                        <td style={{ fontSize: '12px' }}>
                          {c.capability_updated
                            ? <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', color:'var(--okd)', fontWeight:600 }}><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--okd)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="4.5"/><path d="M4 6l1.5 1.5 2.5-2.5"/></svg>Updated</span>
                            : <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', color:'var(--n4)', fontWeight:500 }}><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--n4)" strokeWidth="1.5" strokeLinecap="round"><circle cx="6" cy="6" r="4.5"/><path d="M6 3.5v3l1.5 1"/></svg>Pending</span>
                          }
                        </td>
                        <td>
                          <span className={`badge ${statusBadge}`}>
                            {c.status === 'registered' ? '✓ Registered' : c.status === 'verified' ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!loading && filteredCerts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--n5)', fontSize: '14px' }}>No certifications found</div>
        )}
      </div>
    </div>
  );
};

export default CertsScreen;
