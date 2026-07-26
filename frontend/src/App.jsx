import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AvatharAssistant from './components/AvatharAssistant';
import AvatarFace3D from './components/AvatarFace3D';
import Desktop from './components/Desktop';
import Window from './components/Window';
import Modal from './components/Modal';
import Toast from './components/Toast';
import AaravOrb from './components/AaravOrb';
import RoleGate, { ROLES } from './components/RoleGate';
import { DataProvider, useData } from './DataContext';
import { api } from './api';

// Inner component so it can access DataContext
function AppInner() {
  const [currentScreen, setCurrentScreen] = useState(null);
  const [windowOpen, setWindowOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [role, setRole] = useState(() => localStorage.getItem('tn_role') || null);
  const { refreshData } = useData();

  const pickRole = (key) => {
    localStorage.setItem('tn_role', key);
    setRole(key);
    setWindowOpen(false);
    setCurrentScreen(null);
    // Resources land straight in their learning platform
    if (key === 'resource') {
      setCurrentScreen('learn');
      setWindowOpen(true);
    }
    if (key === 'coordinator') {
      setCurrentScreen('studio');
      setWindowOpen(true);
    }
  };

  const switchRole = () => {
    localStorage.removeItem('tn_role');
    setRole(null);
    setWindowOpen(false);
    setCurrentScreen(null);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const openScreen = (screen) => {
    setCurrentScreen(screen);
    setWindowOpen(true);
  };

  // Presentation mode — this browser instance IS the meeting bot's screenshare.
  // The backend voice bridge writes present-state; we follow it.
  const isPresent = React.useMemo(
    () => new URLSearchParams(window.location.search).get('present') === '1', [],
  );
  useEffect(() => {
    if (!isPresent) return undefined;
    if (!role) pickRole('lead'); // the bot's browser starts with no persona
    let lastSeq = 0;
    const iv = setInterval(async () => {
      try {
        const s = await api.presentState();
        if (!s || s.seq === lastSeq) return;
        lastSeq = s.seq;
        if (s.learner?.id) {
          localStorage.setItem('tn_learner', JSON.stringify(s.learner));
          openScreen('learn');
        } else if (s.screen === 'home') {
          setWindowOpen(false); setCurrentScreen(null);
        } else if (s.screen) {
          openScreen(s.screen);
          if (s.filter) {
            const detail = { screen: s.screen, filter: s.filter };
            setTimeout(() => window.dispatchEvent(new CustomEvent('aarav-filter', { detail })), 350);
          }
        }
      } catch { /* backend momentarily busy */ }
    }, 1200);
    return () => clearInterval(iv);
  }, [isPresent, role]);

  // goHome closes the window AND refreshes data from DB
  const goHome = () => {
    setWindowOpen(false);
    setCurrentScreen(null);
    refreshData();
  };

  const showModal = (content) => {
    setModal(content);
  };

  const closeModal = () => {
    setModal(null);
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  const desktopShell = (
        <div id="desktop">
          <Desktop openScreen={openScreen} windowOpen={windowOpen} goHome={goHome} currentScreen={currentScreen} isMaximized={isMaximized} dark={dark} toggleDark={() => setDark(d => !d)} role={role} />
          <Window
            currentScreen={currentScreen}
            windowOpen={windowOpen}
            goHome={goHome}
            showModal={showModal}
            showToast={showToast}
            onMaximizeChange={setIsMaximized}
            dark={dark}
            toggleDark={() => setDark(d => !d)}
            role={role}
          />
          {modal && <Modal content={modal} onClose={closeModal} />}
          {toast && <Toast message={toast} />}
          {role === 'lead' && <AaravOrb />}

          {/* Role chip — always visible, switch personas any time */}
          {role && (
            <button
              id="role-switch-btn"
              onClick={switchRole}
              title="Switch role"
              style={{
                position: 'absolute', bottom: '18px', left: '16px', zIndex: 3000,
                display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer',
                border: '1px solid rgba(255,255,255,.3)', borderRadius: '20px',
                background: 'rgba(15,23,42,.35)', backdropFilter: 'blur(10px)',
                padding: '5px 13px 5px 6px', fontFamily: 'Poppins, sans-serif',
              }}
            >
              <span style={{
                width: '24px', height: '24px', borderRadius: '50%', fontSize: '13px',
                background: ROLES[role]?.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{ROLES[role]?.emoji}</span>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#fff' }}>{ROLES[role]?.title}</span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,.75)' }}>⇄</span>
            </button>
          )}

          {/* Aarav — in-app voice assistant; drives the real screens.
              Hidden in presentation mode (the meeting voice takes over). */}
          {role && !isPresent && <AvatharAssistant role={role} openScreen={openScreen} refreshData={refreshData} />}

          {!role && <RoleGate onPick={pickRole} />}
        </div>
  );

  return (
    <Router>
      <Routes>
        {/* Bot camera feed for Teams/Meet/Zoom via agentcall.dev — NOT a user
            page; it's what the meeting bot renders as its webcam. */}
        <Route path="/aarav-cam" element={<AaravCam />} />
        <Route path="*" element={desktopShell} />
      </Routes>
    </Router>
  );
}

/* Fullscreen avatar for the meeting bot's camera. AgentCall loads this page
   with ?ws=<socket-url> appended; we connect, play the bot's voice audio
   (tts.webpage_audio chunks via AgentCallAudio), and drive the 3D face from
   voice.state — so the avatar's mouth moves while Aarav talks in the call. */
function AaravCam() {
  const [state, setState] = React.useState('idle');

  React.useEffect(() => {
    const wsUrl = new URLSearchParams(window.location.search).get('ws');
    let ws = null;
    let player = null;

    const mapState = (s) => (
      s === 'speaking' ? 'speaking'
        : s === 'thinking' || s === 'waiting_to_speak' ? 'thinking'
          : s === 'actively_listening' || s === 'listening' || s === 'contextually_aware' ? 'listening'
            : 'idle'
    );

    const boot = () => {
      player = new window.AgentCallAudio({
        onStateChange: (playing) => setState(playing ? 'speaking' : 'listening'),
        onSuspensionStart: () => setState('listening'),
        onSuspensionEnd: () => setState('speaking'),
        onInterrupted: (info) => {
          setState('listening');
          if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'tts.interrupted', ...info }));
        },
      });
      ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        const event = msg.event || msg.type;
        if (event === 'voice.state' && msg.state) {
          if (msg.state === 'listening' && player.isPlaying()) return; // server resets early
          setState(mapState(msg.state));
        }
        player.handleEvent(msg);
      };
    };

    if (!wsUrl) { setState('listening'); return undefined; } // preview without a call

    // AgentCallAudio ships as a plain script — load it, then connect
    if (window.AgentCallAudio) boot();
    else {
      const s = document.createElement('script');
      s.src = '/agentcall-audio.js';
      s.onload = boot;
      document.head.appendChild(s);
    }
    return () => { try { ws?.close(); } catch { /* closed */ } };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'radial-gradient(900px 600px at 50% 80%, #2a1b62 0%, transparent 65%), linear-gradient(160deg, #0b0920, #131033)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ flex: 1 }}>
        <AvatarFace3D state={state} height={window.innerHeight} />
      </div>
      <div style={{
        position: 'absolute', bottom: 26, width: '100%', textAlign: 'center',
        fontFamily: 'Poppins, sans-serif', color: 'rgba(238,240,255,.85)',
        fontSize: 20, fontWeight: 700, letterSpacing: '.4px',
      }}>
        Aarav · Talent Nurturing
      </div>
    </div>
  );
}

function App() {
  return (
    <DataProvider>
      <AppInner />
    </DataProvider>
  );
}

export default App;