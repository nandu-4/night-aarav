import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useData } from '../DataContext';

// macOS dock magnification constants
const BASE_SIZE = 54;
const MAX_SIZE = 82;
const SPREAD = 150;

const Desktop = ({ openScreen, windowOpen, goHome, currentScreen, isMaximized, role }) => {
  const { hilItems, escalations, loading, refreshData } = useData();
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [localTasksDone, setLocalTasksDone] = useState({});
  const [iconSizes, setIconSizes] = useState({});
  // When maximized: dock is hidden unless cursor is near bottom
  const [dockPeeking, setDockPeeking] = useState(false);
  const dockRef = useRef(null);

  // ── Tasks ──────────────────────────────────────────────
  const dynamicTasks = [];
  if (!loading) {
    hilItems.filter(h => h.status === 'pending').forEach(h => {
      dynamicTasks.push({ txt: `Approve HIL — ${h.assignment?.resource?.full_name}`, done: false });
    });
    escalations.filter(e => e.status === 'open').forEach(e => {
      dynamicTasks.push({ txt: `Resolve escalation (${e.assignment?.resource?.full_name})`, done: false });
    });
    if (dynamicTasks.length === 0) {
      dynamicTasks.push({ txt: 'All clear! No pending actions.', done: true });
    }
  }
  const doneCount = dynamicTasks.filter((t, i) => t.done || localTasksDone[i]).length;
  const taskCount = dynamicTasks.length || 1;

  // ── Clock ──────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const t = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const d = now.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
      setCurrentTime(t);
      setCurrentDate(d);
    };
    tick();
    const iv = setInterval(tick, 10000);
    return () => clearInterval(iv);
  }, []);

  // ── Auto-show dock when cursor near bottom (maximized mode) ──
  useEffect(() => {
    if (!isMaximized) {
      setDockPeeking(false);
      return;
    }
    const onMove = (e) => {
      const nearBottom = e.clientY >= window.innerHeight - 60;
      setDockPeeking(nearBottom);
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, [isMaximized]);

  // ── macOS magnification ────────────────────────────────
  const handleDockMouseMove = useCallback((e) => {
    if (!dockRef.current) return;
    const items = dockRef.current.querySelectorAll('.dock-item');
    const sizes = {};
    items.forEach((item, i) => {
      const rect = item.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.sqrt(Math.pow(e.clientX - cx, 2) + Math.pow(e.clientY - cy, 2));
      const ratio = Math.max(0, 1 - dist / SPREAD);
      sizes[i] = Math.round(BASE_SIZE + (MAX_SIZE - BASE_SIZE) * ratio);
    });
    setIconSizes(sizes);
  }, []);

  const handleDockMouseLeave = useCallback(() => {
    setIconSizes({});
  }, []);

  const toggleTask = (i) => setLocalTasksDone(prev => ({ ...prev, [i]: !prev[i] }));

  // ── Dock items — Home first, then apps ─────────────────
  const W = { fill: 'none', stroke: 'rgba(255,255,255,.95)', strokeWidth: '1.7', strokeLinecap: 'round', strokeLinejoin: 'round' };
  const allItems = {
    home: { key: 'home', label: 'Home', bg: 'linear-gradient(145deg,#5929d0,#7C3AED)', badge: 0, isHome: true,
      icon: <svg style={{width:'52%',height:'52%'}} viewBox="0 0 20 20" {...W}><path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1h-4v-4H8v4H4a1 1 0 01-1-1V9.5z"/></svg> },
    analytics: { key: 'analytics', label: 'Analytics', bg: 'linear-gradient(145deg,#5929d0,#A855F7)', badge: 0,
      icon: <svg style={{width:'52%',height:'52%'}} viewBox="0 0 20 20" fill="none"><rect x="3" y="12" width="3.5" height="5" rx=".5" fill="rgba(255,255,255,.95)"/><rect x="8.5" y="8" width="3" height="9" rx=".5" fill="rgba(255,255,255,.95)"/><rect x="14" y="4" width="3" height="13" rx=".5" fill="rgba(255,255,255,.95)"/></svg> },
    tracker: { key: 'tracker', label: 'Tracker', bg: 'linear-gradient(145deg,#6B8EF0,#4A6CF7)', badge: 0,
      icon: <svg style={{width:'52%',height:'52%'}} viewBox="0 0 20 20" {...W}><rect x="4" y="2" width="12" height="16" rx="2" strokeWidth="1.5"/><path d="M8 2.5v2.5h4V2.5"/><path d="M7 9h6M7 12.5h4"/></svg> },
    escalations: { key: 'escalations', label: 'Escalations', bg: 'linear-gradient(145deg,#E4902E,#F59E0B)',
      badge: !loading ? escalations.filter(e => e.status === 'open').length : 0,
      icon: <svg style={{width:'52%',height:'52%'}} viewBox="0 0 20 20" {...W}><path d="M10 3L2.5 17h15L10 3z"/><line x1="10" y1="9" x2="10" y2="13" strokeWidth="2"/><circle cx="10" cy="15" r="1" fill="rgba(255,255,255,.95)" stroke="none"/></svg> },
    hil: { key: 'hil', label: 'Approval', bg: 'linear-gradient(145deg,#16A34A,#22C55E)',
      badge: !loading ? hilItems.filter(h => h.status === 'pending').length : 0,
      icon: <svg style={{width:'52%',height:'52%'}} viewBox="0 0 20 20" {...W}><circle cx="10" cy="10" r="7"/><path d="M7 10.5l2.5 2.5 4.5-4.5" strokeWidth="2"/></svg> },
    certs: { key: 'certs', label: 'Certifications', bg: 'linear-gradient(145deg,#CF008B,#F472B6)', badge: 0,
      icon: <svg style={{width:'52%',height:'52%'}} viewBox="0 0 20 20" {...W}><path d="M10 2L4 4.5v4.5c0 4.5 2.5 6.5 6 8 3.5-1.5 6-3.5 6-8V4.5L10 2z"/><path d="M7.5 10.5l2 2 4-4"/></svg> },
    audit: { key: 'audit', label: 'Audit Log', bg: 'linear-gradient(145deg,#64748B,#94A3B8)', badge: 0,
      icon: <svg style={{width:'52%',height:'52%'}} viewBox="0 0 20 20" {...W}><rect x="4" y="2" width="12" height="16" rx="2"/><path d="M7.5 7h5M7.5 10.5h5M7.5 14h3"/></svg> },
    studio: { key: 'studio', label: 'Program Studio', bg: 'linear-gradient(145deg,#7C3AED,#C084FC)', badge: 0,
      icon: <svg style={{width:'52%',height:'52%'}} viewBox="0 0 20 20" {...W}><path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z"/><path d="M11.5 5.5l3 3"/></svg> },
    learn: { key: 'learn', label: 'My Learning', bg: 'linear-gradient(145deg,#0E7490,#22D3EE)', badge: 0,
      icon: <svg style={{width:'52%',height:'52%'}} viewBox="0 0 20 20" {...W}><path d="M10 4L2 8l8 4 8-4-8-4z"/><path d="M5.5 9.8V14c0 1 2 2.5 4.5 2.5s4.5-1.5 4.5-2.5V9.8"/><path d="M18 8v4"/></svg> },
  };

  // Role-based docks: Coordinator builds, Talent Lead approves, Resource learns
  const dockLayouts = {
    coordinator: ['home', 'sep1', 'studio', 'tracker', 'analytics', 'sep2', 'audit'],
    lead: ['home', 'sep1', 'analytics', 'tracker', 'escalations', 'sep2', 'hil', 'certs', 'audit'],
    resource: ['home', 'sep1', 'learn'],
  };
  const dockItems = (dockLayouts[role] || dockLayouts.lead).map(k =>
    k.startsWith('sep') ? { key: k } : allItems[k]
  );

  let itemIndex = 0;

  const dockBottom = isMaximized
    ? (dockPeeking ? '10px' : '-100px')
    : '10px';

  return (
    <>
      {/* Big Clock — centered on desktop */}
      {!windowOpen && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', zIndex: 10, pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: '96px', fontWeight: 800, color: '#fff',
            textShadow: '0 4px 32px rgba(0,0,0,.25)',
            letterSpacing: '-2px', lineHeight: 1,
          }}>{currentTime}</div>
          <div style={{
            fontSize: '20px', fontWeight: 600, color: 'rgba(255,255,255,.85)',
            textShadow: '0 2px 12px rgba(0,0,0,.2)',
            marginTop: '8px',
          }}>{currentDate}</div>
        </div>
      )}

      {/* Desktop Widgets — Talent Lead only (they reference HIL & escalations) */}
      {role === 'lead' && (<>
      <div className="desk-widget dw-notes">
        <div className="dw-title">
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="1" width="11" height="12" rx="1.5"/><path d="M4 4.5h6M4 7h6M4 9.5h3.5"/></svg>
          Agent Notes
        </div>
        <div className="dw-note">
          {loading ? 'Loading notes...' : (
            <>
              {escalations.filter(e => e.status === 'open').length > 0 && <span>Review open escalations<br /></span>}
              {hilItems.filter(h => h.status === 'pending').length > 0 && <span>Check HIL queue<br /></span>}
              <span>Monitor capability register</span>
            </>
          )}
        </div>
      </div>

      <div className="desk-widget dw-tasks">
        {/* Card header */}
        <div className="dw-card-head">
          <div className="dw-title" style={{ margin: 0 }}>
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="1.5" width="11" height="11" rx="1.5"/><path d="M4.5 7l2 2 3.5-3.5"/></svg>
            <span>Today's Tasks</span>
          </div>
          <span className="dw-pct">{Math.round((doneCount / taskCount) * 100)}%</span>
        </div>

        {/* Progress bar */}
        <div className="dw-prog-bg">
          <div className="dw-prog-fill" style={{ width: `${Math.round((doneCount / taskCount) * 100)}%` }} />
        </div>

        {/* Scrollable task list */}
        <div className="dw-tasks-body">
          {loading ? (
            <div style={{ color: 'var(--n5)', fontSize: '11px', padding: '4px 0' }}>Loading...</div>
          ) : dynamicTasks.map((task, i) => {
            const isDone = task.done || localTasksDone[i];
            return (
              <div key={i} className="task-item">
                <div id={`task-cb-${i}`} className={`task-cb ${isDone ? 'done' : ''}`} onClick={() => toggleTask(i)}>
                  {isDone ? '✓' : ''}
                </div>
                <span style={{ textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'var(--n5)' : 'inherit' }}>
                  {task.txt}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      </>)}

      {/* ── Dock with Home button ── */}
      <div
        id="dock-container"
        ref={dockRef}
        className={`dock ${windowOpen ? 'window-open' : ''}`}
        style={{ bottom: dockBottom, transition: 'bottom 0.28s cubic-bezier(.4,0,.2,1)' }}
        onMouseMove={handleDockMouseMove}
        onMouseLeave={handleDockMouseLeave}
      >
        {dockItems.map((item) => {
          if (item.key.startsWith('sep')) return <div key={item.key} className="dock-sep" />;

          const idx = itemIndex++;
          const size = iconSizes[idx] || BASE_SIZE;
          const isActive = item.isHome ? !windowOpen : currentScreen === item.key;
          const lift = ((size - BASE_SIZE) / (MAX_SIZE - BASE_SIZE)) * 24;
          const fontSize = Math.round(size * 0.50);

          return (
            <div key={item.key} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                id={`dock-${item.key}-btn`}
                className={`dock-item ${isActive ? 'active' : ''}`}
                onClick={() => item.isHome ? goHome() : openScreen(item.key)}
                title={item.label}
                style={{
                  transform: `translateY(-${lift}px)`,
                  transition: 'transform 0.12s ease',
                  width: `${size + 8}px`,
                }}
              >
                <div
                  className="dock-icon"
                  style={{
                    background: item.bg,
                    width: `${size}px`,
                    height: `${size}px`,
                    fontSize: `${fontSize}px`,
                    borderRadius: `${Math.round(size * 0.27)}px`,
                    boxShadow: isActive ? '0 6px 22px rgba(99,102,241,.30)' : '0 4px 14px rgba(0,0,0,.13)',
                    transition: 'width 0.12s ease, height 0.12s ease, font-size 0.12s ease, border-radius 0.12s ease',
                  }}
                >
                  {item.icon}
                </div>
                <div className="dock-pip" style={{ opacity: isActive ? 1 : 0, background: isActive ? 'var(--n2)' : 'transparent' }} />
              </button>
              {item.badge > 0 && (
                <span className="dock-badge" style={{ top: `-${Math.round(lift * 0.5 + 4)}px` }}>
                  {item.badge}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

export default Desktop;
