import React from 'react';

const LivePanel = ({ logs, collapsed, toggleLP }) => {
  const formatTime = (ts) => {
    try {
      return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className={`live-panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="lp-header">
        <div className="lp-dot"></div>
        <div className="lp-title">Live Commentary</div>
        <button id="livepanel-toggle-btn" className="lp-toggle" onClick={toggleLP}>
          {collapsed ? '▶' : '◀'}
        </button>
      </div>
      <div className="lp-body">
        {logs.slice(0, 35).map((log, i) => (
          <div key={i} className={`log-card ${log.level || 'info'}`}>
            <span className="log-ts">{formatTime(log.ts)} · {log.actor || 'system'}</span>
            <span className="log-msg">{log.message}</span>
          </div>
        ))}
      </div>
      <div id="livepanel-collapsed-label" className="lp-collapsed-label" onClick={toggleLP}>LIVE</div>
    </div>
  );
};

export default LivePanel;