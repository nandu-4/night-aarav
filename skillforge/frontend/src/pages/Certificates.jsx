import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { Empty } from '../ui';

export function Certificates() {
  const [certs, setCerts] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { api.myCerts().then(setCerts).catch(() => setCerts([])); }, []);

  if (!certs) return <div className="card">Loading…</div>;

  return (
    <div>
      {certs.length === 0 && <div className="card"><Empty icon="🎓" text="Complete all three stages of a program and your certificate appears here automatically." /></div>}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {certs.map((c) => (
          <div key={c.verify_id} className="card" style={{ cursor: 'pointer' }} onClick={() => setOpen(c)}>
            <div style={{ fontSize: 26 }}>🎓</div>
            <b style={{ fontSize: 15, display: 'block', margin: '8px 0 2px' }}>{c.cert_name}</b>
            <div className="sub">{c.program}</div>
            <div className="sub" style={{ marginTop: 10 }}>Completed {c.completed_at} · ID <b>{c.verify_id}</b></div>
          </div>
        ))}
      </div>
      {open && <CertDoc cert={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function CertDoc({ cert, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(6,4,20,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div className="certdoc" style={{ width: 640, maxWidth: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="side__logo" style={{ margin: '0 auto', width: 52, height: 52, fontSize: 22 }}>Sf</div>
        <div className="sub" style={{ letterSpacing: 3, marginTop: 14 }}>CERTIFICATE OF COMPLETION</div>
        <h1>{cert.cert_name}</h1>
        <div className="sub">is proudly presented to</div>
        <div className="who">{cert.name}</div>
        <div className="sub" style={{ margin: '10px auto', maxWidth: 420, lineHeight: 1.6 }}>
          for successfully completing all three stages — learning content, knowledge assessment and
          hands-on project — of <b>{cert.program}</b>.
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, fontSize: 11, position: 'relative' }}>
          <div style={{ textAlign: 'left' }}>
            <b>Completed</b><div className="sub">{cert.completed_at}</div>
          </div>
          <div>
            <b>Verification ID</b><div className="sub">{cert.verify_id}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <b>Digital signature</b>
            <div className="sub" style={{ fontFamily: 'monospace', fontSize: 9 }}>{cert.signature.slice(0, 16)}…</div>
          </div>
        </div>
        <div className="sub" style={{ marginTop: 20, fontSize: 10 }}>
          Verify at /verify/{cert.verify_id} · Capability upgrade pending Talent Lead verification in the Talent Nurturing Agent
        </div>
        <button className="btn btn--sm" style={{ marginTop: 16 }} onClick={() => window.print()}>🖨 Print / save PDF</button>
      </div>
    </div>
  );
}

export function VerifyPage() {
  const { vid } = useParams();
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.verifyCert(vid).then(setRes).catch((e) => setErr(e.message)); }, [vid]);

  return (
    <div className="login">
      <div className="card login__card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>{err ? '❌' : res?.valid ? '✅' : '⏳'}</div>
        <h2 style={{ margin: '10px 0' }}>Certificate verification</h2>
        {err && <div className="sub">{err}</div>}
        {res && (
          <div className="sub" style={{ lineHeight: 2 }}>
            <b style={{ fontSize: 15, color: 'var(--t1)' }}>{res.name}</b><br />
            {res.cert_name} · {res.program}<br />
            Completed {res.completed_at} · ID {res.verify_id}<br />
            Signature check: <b style={{ color: res.valid ? 'var(--ok)' : 'var(--err)' }}>{res.valid ? 'AUTHENTIC' : 'INVALID'}</b>
          </div>
        )}
      </div>
    </div>
  );
}
