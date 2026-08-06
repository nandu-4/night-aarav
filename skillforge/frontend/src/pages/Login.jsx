import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await api.login(email, password);
      localStorage.setItem('sf_token', res.token);
      localStorage.setItem('sf_user', JSON.stringify(res.user));
      onLogin(res.user);
      nav('/');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="card login__card">
        <div className="login__logo">
          <div className="side__logo" style={{ width: 46, height: 46, fontSize: 20 }}>Sf</div>
          <div>
            <div className="side__name" style={{ fontSize: 22 }}>SkillForge</div>
            <div className="side__tag" style={{ fontSize: 11 }}>Forging skills, closing gaps</div>
          </div>
        </div>
        <form onSubmit={submit}>
          <label className="lbl">Company email</label>
          <input id="login-email" className="input" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="r-1051@skillforge.dev" autoFocus />
          <label className="lbl">Password</label>
          <input id="login-password" className="input" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          {err && <div style={{ color: 'var(--err)', fontSize: 12, marginTop: 10 }}>{err}</div>}
          <button id="login-submit" className="btn" style={{ width: '100%', marginTop: 18 }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="sub" style={{ marginTop: 18, lineHeight: 1.7 }}>
          Employees use their resource code, e.g. <b>r-1051@skillforge.dev</b>.<br />
          Staff: <b>manager@</b> · <b>lead@</b> · <b>admin@skillforge.dev</b><br />
          Default password: <b>learn123</b>
        </div>
      </div>
    </div>
  );
}
