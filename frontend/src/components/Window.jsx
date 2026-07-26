import React, { useState, useEffect } from 'react';
import AnalyticsScreen from './screens/AnalyticsScreen';
import TrackerScreen from './screens/TrackerScreen';
import EscalationsScreen from './screens/EscalationsScreen';
import HilScreen from './screens/HilScreen';
import CertsScreen from './screens/CertsScreen';
import AuditScreen from './screens/AuditScreen';
import StudioScreen from './screens/StudioScreen';
import LearnScreen from './screens/LearnScreen';
import LivePanel from './LivePanel';
import { useData } from '../DataContext';
import { api } from '../api';

const screenMeta = {
  analytics:   { name: 'Analytics Dashboard',    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="9" width="3" height="5" rx=".5" fill="var(--p)"/><rect x="6.5" y="6" width="3" height="8" rx=".5" fill="var(--p)"/><rect x="11.5" y="3" width="3" height="11" rx=".5" fill="var(--p)"/></svg> },
  tracker:     { name: 'Assignment Tracker',      icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--p)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/><path d="M6 1.5v2.5h4V1.5"/><path d="M5.5 7.5h5M5.5 10.5h3.5"/></svg> },
  escalations: { name: 'Escalation Panel',        icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--wn)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2.5L2 13.5h12L8 2.5z"/><line x1="8" y1="6.5" x2="8" y2="10" strokeWidth="1.8"/><circle cx="8" cy="11.5" r=".6" fill="var(--wn)" stroke="none"/></svg> },
  hil:         { name: 'HIL Approval Queue',      icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--ok)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M5.5 8.5l2 2 3.5-3.5" strokeWidth="1.8"/></svg> },
  certs:       { name: 'Certification Registry',  icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--pk)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.5L3 3.5v3.5c0 3 2 5 5 6.5 3-1.5 5-3.5 5-6.5V3.5L8 1.5z"/><path d="M6 8l1.5 1.5 3-3"/></svg> },
  audit:       { name: 'Audit Log',               icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--n4)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/><path d="M5.5 5.5h5M5.5 8.5h5M5.5 11.5h3"/></svg> },
  studio:      { name: 'Program Studio',          icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--p)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10.8 2.8l2.4 2.4L5.6 12.8H3.2v-2.4l7.6-7.6z"/><path d="M9.2 4.4l2.4 2.4"/></svg> },
  learn:       { name: 'My Learning',             icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#0E7490" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L1.5 6.2 8 9.4l6.5-3.2L8 3z"/><path d="M4.4 7.8v3.4c0 .8 1.6 2 3.6 2s3.6-1.2 3.6-2V7.8"/></svg> },
};

const Window = ({ currentScreen, windowOpen, goHome, showModal, showToast, onMaximizeChange, dark, toggleDark }) => {
  const { escalations, hilItems } = useData();
  const [logs, setLogs] = useState([]);
  const [lpCollapsed, setLpCollapsed] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [headerTime, setHeaderTime] = useState('');
  const [apiStatus, setApiStatus] = useState({ connected: false, text: 'Connecting…' });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const day = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      setHeaderTime(`${day} ${time}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const check = () =>
      fetch('/api/health')
        .then(r => r.json())
        .then(d => setApiStatus({ connected: d.status === 'healthy', text: d.status === 'healthy' ? 'API Connected' : 'API Error' }))
        .catch(() => setApiStatus({ connected: false, text: 'API Offline' }));
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    api.auditLogs().then(data => {
      if (data && data.length > 0) {
        setLogs(data.slice(0, 20).map(l => ({ ...l, ts: l.created_at })));
      }
    }).catch(() => {});
  }, []);

  const pushLog = (entry) => {
    const newLog = { ...entry, ts: new Date().toISOString() };
    setLogs(prev => [newLog, ...prev.slice(0, 79)]);
  };

  const toggleLP = () => {
    setLpCollapsed(!lpCollapsed);
  };

  const handleMin = () => {
    setIsMinimized(true);
  };

  const handleMax = () => {
    const next = !isMaximized;
    setIsMaximized(next);
    if (onMaximizeChange) onMaximizeChange(next);
  };

  const handleClose = () => {
    setIsMaximized(false);
    setIsMinimized(false);
    if (onMaximizeChange) onMaximizeChange(false);
    goHome();
  };

  // If window is opened, ensure it's not minimized
  useEffect(() => {
    if (windowOpen) {
      setIsMinimized(false);
    }
  }, [windowOpen, currentScreen]);

  const screenComponents = {
    analytics: AnalyticsScreen,
    tracker: TrackerScreen,
    escalations: EscalationsScreen,
    hil: HilScreen,
    certs: CertsScreen,
    audit: AuditScreen,
    studio: StudioScreen,
    learn: LearnScreen,
  };

  const CurrentScreenComponent = currentScreen ? screenComponents[currentScreen] : null;

  const openCount = escalations.filter(e => e.status === 'open').length;
  const pendingCount = hilItems.filter(h => h.status === 'pending').length;

  return (
    <div
      className={`window ${windowOpen && !isMinimized ? 'open' : ''} ${isMaximized ? 'maximized' : ''}`}
      style={isMaximized ? { width: '100%', height: '100vh', top: 0, left: 0, transform: 'none', margin: 0, borderRadius: 0 } : {}}
    >
      {/* Window Body */}
      <div className="win-body">
        <div className="screens-wrap">
          {/* Per-screen heading bar */}
          {currentScreen && (
            <div className="screen-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {screenMeta[currentScreen]?.icon}
                <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--n0)' }}>
                  {screenMeta[currentScreen]?.name}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--n5)', marginLeft: '4px' }}>
                  · {openCount} SLA · {pendingCount} Pending
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="api-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: apiStatus.connected ? 'var(--ok)' : 'var(--er)', flexShrink: 0 }} title={apiStatus.text}></div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--n2)', fontVariantNumeric: 'tabular-nums' }}>
                  {headerTime}
                </span>
                <button
                  id="dark-mode-toggle-btn"
                  onClick={toggleDark}
                  title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 7px', cursor: 'pointer', fontSize: '13px', color: 'var(--muted-foreground)', lineHeight: 1.4 }}
                >
                  {dark
                    ? <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="3.5"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M11.5 3.5l-1 1M4.5 11.5l-1 1"/></svg>
                    : <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M13.5 10A6 6 0 016 2.5a6 6 0 100 11A6 6 0 0013.5 10z"/></svg>
                  }
                </button>
                <button id="window-maximize-btn" className="wc wc-max" onClick={handleMax} title={isMaximized ? 'Restore' : 'Maximize'} style={{ marginLeft: '2px' }}>
                  {isMaximized ? '⊡' : '+'}
                </button>
                <button id="window-close-btn" className="wc wc-close" onClick={handleClose} title="Close">✕</button>
              </div>
            </div>
          )}
          {CurrentScreenComponent && (
            <CurrentScreenComponent
              showModal={showModal}
              showToast={showToast}
              pushLog={pushLog}
            />
          )}
        </div>

        {/* Live Panel */}
        <LivePanel
          logs={logs}
          collapsed={lpCollapsed}
          toggleLP={toggleLP}
        />
      </div>
    </div>
  );
};

export default Window;