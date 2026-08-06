import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { api } from './api';
import { timeAgo } from './ui';

const NAV = {
  employee: [
    ['Learn', null],
    ['/', '🏠', 'Dashboard'],
    ['/learning', '📚', 'My Learning'],
    ['/certificates', '🎓', 'Certificates'],
    ['/leaderboard', '🏆', 'Leaderboard'],
  ],
  manager: [
    ['Training Ops', null],
    ['/', '🏠', 'Dashboard'],
    ['/people', '👥', 'Employees'],
    ['/submissions', '📥', 'Project Reviews'],
    ['/analytics', '📊', 'Analytics'],
    ['/announce', '📣', 'Announcements'],
  ],
  lead: [
    ['Oversight · read-only', null],
    ['/', '📊', 'Analytics'],
    ['/people', '👥', 'Employees'],
    ['/submissions', '📥', 'Submissions'],
  ],
  admin: [
    ['Administration', null],
    ['/', '🛠️', 'Admin Console'],
    ['/people', '👥', 'Employees'],
    ['/analytics', '📊', 'Analytics'],
    ['/announce', '📣', 'Announcements'],
  ],
};

export default function Layout({ user, title, onLogout, children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('sf_theme') || 'dark');
  const [bellOpen, setBellOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const bellRef = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sf_theme', theme);
  }, [theme]);

  useEffect(() => {
    let live = true;
    const load = () => api.notifications().then((n) => live && setNotifs(n)).catch(() => {});
    load();
    const iv = setInterval(load, 30000);
    return () => { live = false; clearInterval(iv); };
  }, []);

  useEffect(() => {
    const close = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const unread = notifs.filter((n) => !n.read).length;
  const items = NAV[user.role] || NAV.employee;
  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="shell">
      <aside className="side">
        <div className="side__brand">
          <div className="side__logo">Sf</div>
          <div>
            <div className="side__name">SkillForge</div>
            <div className="side__tag">forging skills · closing gaps</div>
          </div>
        </div>
        {items.map((it, i) =>
          it[1] === null ? (
            <div className="side__sect" key={i}>{it[0]}</div>
          ) : (
            <NavLink key={it[0]} to={it[0]} end={it[0] === '/'}
              className={({ isActive }) => `navlink ${isActive ? 'on' : ''}`}>
              <span className="ic">{it[1]}</span>{it[2]}
            </NavLink>
          ),
        )}
        <div className="side__foot">
          Progress syncs live with the <b>Talent Nurturing Agent</b> — the source of truth for readiness &amp; deployment.
        </div>
      </aside>

      <div className="maincol">
        <header className="topbar">
          <div className="topbar__title">{title}</div>
          <div className="topbar__spacer" />
          <button className="iconbtn" title="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div ref={bellRef} style={{ position: 'relative' }}>
            <button className="iconbtn" title="Notifications" onClick={() => {
              setBellOpen(!bellOpen);
              if (!bellOpen && unread) api.readAll().then(() => api.notifications().then(setNotifs));
            }}>
              🔔{unread > 0 && <span className="dot" />}
            </button>
            {bellOpen && (
              <div className="drop">
                {notifs.length === 0 && <div className="drop__item"><p>No notifications yet.</p></div>}
                {notifs.map((n) => (
                  <div key={n.id} className={`drop__item ${n.read ? '' : 'unread'}`}>
                    <b>{n.title}</b>
                    <p>{n.body}</p>
                    <span className="when">{timeAgo(n.ts)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="userchip">
            <div className="userchip__av">{initials}</div>
            <div><b>{user.name}</b><span>{user.role}{user.role === 'lead' ? ' · read-only' : ''}</span></div>
          </div>
          <button className="iconbtn" title="Sign out" onClick={() => { onLogout(); nav('/login'); }}>⎋</button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
