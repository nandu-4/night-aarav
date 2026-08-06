import React from 'react';

/* Shared UI atoms — progress ring, stat card, badges, empty state */

export const Ring = ({ pct, size = 96, stroke = 9, label, sub, tealAt = 100 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(124,77,255,.15)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={pct >= tealAt ? 'url(#gradTeal)' : 'url(#gradMain)'} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (Math.min(pct, 100) / 100) * c}
        style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.16,1,.3,1)' }}
      />
      <defs>
        <linearGradient id="gradMain" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c4dff" /><stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
        <linearGradient id="gradTeal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#14b8a6" /><stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
      <g style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
        <text x="50%" y={sub ? '46%' : '52%'} textAnchor="middle" fill="var(--t1)"
          style={{ fontSize: size * 0.21, fontWeight: 800, fontFamily: 'Sora, sans-serif' }}>
          {label ?? `${pct}%`}
        </text>
        {sub && (
          <text x="50%" y="63%" textAnchor="middle" fill="var(--t3)" style={{ fontSize: size * 0.09 }}>
            {sub}
          </text>
        )}
      </g>
    </svg>
  );
};

export const Stat = ({ icon, value, label, accent }) => (
  <div className="card stat">
    <div style={{ fontSize: 20 }}>{icon}</div>
    <b className={accent ? 'grad-num' : ''}>{value}</b>
    <span>{label}</span>
  </div>
);

export const Badge = ({ kind, children }) => (
  <span className={`badge badge--${kind}`}>{children}</span>
);

export const Empty = ({ icon = '🌱', text }) => (
  <div style={{ textAlign: 'center', padding: '38px 16px', color: 'var(--t3)' }}>
    <div style={{ fontSize: 34, marginBottom: 10 }}>{icon}</div>
    <div style={{ fontSize: 13 }}>{text}</div>
  </div>
);

export const timeAgo = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};
