import React from 'react';

// Roles follow the BRD: the Training & Certification Coordinator builds
// programs, the Talent Lead holds HIL approval authority, and Resources are
// the people being trained. No login by design — this is a persona switcher.
export const ROLES = {
  coordinator: {
    key: 'coordinator',
    title: 'Training Coordinator',
    subtitle: 'Build programs, tests & sandbox tasks · send to HIL',
    emoji: '🎯',
    gradient: 'linear-gradient(145deg,#5929d0,#A855F7)',
  },
  lead: {
    key: 'lead',
    title: 'Talent Lead',
    subtitle: 'Approve programs (HIL) · escalations · analytics',
    emoji: '✅',
    gradient: 'linear-gradient(145deg,#16A34A,#22C55E)',
  },
  resource: {
    key: 'resource',
    title: 'Resource · Learner',
    subtitle: 'Take your assigned training like a course',
    emoji: '🎓',
    gradient: 'linear-gradient(145deg,#0E7490,#22D3EE)',
  },
};

const RoleGate = ({ onPick }) => (
  <div style={{
    position: 'absolute', inset: 0, zIndex: 4000,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(14px)',
  }}>
    <div style={{ textAlign: 'center', marginBottom: '34px' }}>
      <div style={{ fontSize: '30px', fontWeight: 800, color: '#fff', textShadow: '0 2px 18px rgba(0,0,0,.35)' }}>
        Talent Nurturing
      </div>
      <div style={{ fontSize: '14px', color: 'rgba(255,255,255,.85)', marginTop: '6px' }}>
        Who's working today?
      </div>
    </div>

    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', padding: '0 20px' }}>
      {Object.values(ROLES).map(r => (
        <button
          key={r.key}
          id={`role-${r.key}-btn`}
          onClick={() => onPick(r.key)}
          style={{
            width: '235px', padding: '26px 20px', cursor: 'pointer',
            border: '1px solid rgba(255,255,255,.25)', borderRadius: '18px',
            background: 'rgba(255,255,255,.92)', textAlign: 'center',
            boxShadow: '0 18px 44px rgba(0,0,0,.28)',
            transition: 'transform .15s ease, box-shadow .15s ease',
            fontFamily: 'Poppins, sans-serif',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <div style={{
            width: '64px', height: '64px', margin: '0 auto 14px', borderRadius: '18px',
            background: r.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '30px', boxShadow: '0 8px 22px rgba(0,0,0,.22)',
          }}>{r.emoji}</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#1E293B' }}>{r.title}</div>
          <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '6px', lineHeight: 1.5 }}>
            {r.subtitle}
          </div>
        </button>
      ))}
    </div>

    <div style={{ marginTop: '30px', fontSize: '11.5px', color: 'rgba(255,255,255,.7)' }}>
      Role-based views — no password needed. Switch any time from the top bar.
    </div>
  </div>
);

export default RoleGate;
