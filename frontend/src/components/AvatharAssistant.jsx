import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import AvatarFace3D from './AvatarFace3D';
import './avathar-assistant.css';

/* ══════════════════════════════════════════════════════════
   Avathar — the in-app conversational assistant. A ChatGPT-
   style chat grounded in the live database: ask it anything
   about the talent program and it answers from real data.
   When the conversation calls for it, it opens the app's
   REAL screens or proposes a HIL decision.

   Decisions (approve / reject) are read back and require
   "confirm" (spoken, typed, or clicked) before /avathar/execute
   runs — the same code path as the HIL screen's button.
   ══════════════════════════════════════════════════════════ */

const CONFIRM_RE = /^\s*(confirm|yes|yes please|go ahead|do it|proceed)[.!]?\s*$/i;
const CANCEL_RE = /^\s*(cancel|no|stop|never mind|nevermind)[.!]?\s*$/i;

const SCREEN_NAMES = {
  hil: 'HIL Approval Queue', studio: 'Program Studio', tracker: 'Assignment Tracker',
  analytics: 'Analytics Dashboard', certs: 'Certification Registry',
  escalations: 'Escalation Panel', audit: 'Audit Log', learn: 'My Learning',
};

/* conversation starters — suggestions, not a command set */
const SUGGESTIONS = [
  'Give me a tour of the application',
  'What should I focus on today?',
  'Show only the overdue assignments',
  'Summarise the pending approvals',
];

/* the guided tour — every screen, narrated. Runs client-side so it never
   burns API quota and always works, even offline. */
const TOUR = [
  { screen: 'analytics', text: 'This is the Analytics Dashboard — live metrics for the whole talent program: assignment rates, completions, pass rates and compliance, straight from the database.' },
  { screen: 'tracker', text: 'The Assignment Tracker. Every resource in training, their program, progress and deadline — filterable by status. You can just ask me to show only the overdue ones.' },
  { screen: 'escalations', text: 'The Escalation Panel. When someone falls behind, an escalation lands here for the Talent Lead to resolve — extend, replace, or accept the risk.' },
  { screen: 'hil', text: 'The HIL Approval Queue — the human-in-the-loop gate. Nothing the AI recommends is ever assigned until a human approves it here. You can approve by voice through me, but I always read it back and wait for your confirm.' },
  { screen: 'certs', text: 'The Certification Registry. When a learner completes everything, a certification is created here, pending verification.' },
  { screen: 'audit', text: 'The Audit Log — every action in the system, human or AI, is recorded here. My voice approvals show up too.' },
  { screen: 'studio', text: 'The Program Studio — where the Training Coordinator uploads skill-gap documents, and AI drafts personalised programs with modules, tests and sandbox tasks. Drafts go to HIL from here.' },
  { screen: 'learn', text: 'And My Learning — the learner platform. Approved programs appear here as courses with modules, a graded test and a sandbox case study.' },
];
const TOUR_OUTRO = "That's the whole application. Ask me anything — or tell me to open any screen.";

export default function AvatharAssistant({ role, openScreen, refreshData }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState('idle'); // idle | listening | thinking | speaking
  const [msgs, setMsgs] = useState([]);       // {who, text, opened?}
  const [interim, setInterim] = useState('');
  const [pending, setPending] = useState(null);
  const [typed, setTyped] = useState('');
  const [micOn, setMicOn] = useState(false);
  const [has3d, setHas3d] = useState(true); // false once /avathar.glb is confirmed missing

  const recRef = useRef(null);
  const micOnRef = useRef(false);
  const speakingRef = useRef(false);
  const pendingRef = useRef(null);
  const endRef = useRef(null);
  const msgsRef = useRef([]);
  const lastSpokenRef = useRef(''); // echo guard: Aarav's own last words

  useEffect(() => { micOnRef.current = micOn; }, [micOn]);
  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => { msgsRef.current = msgs; }, [msgs]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, interim, pending]);

  const push = (m) => setMsgs((x) => [...x.slice(-40), m]);

  /* ── speech out (mic is hard-muted while talking so it never hears itself) ── */
  const ttsSpeak = useCallback((text) => new Promise((resolve) => {
    if (!text || !window.speechSynthesis) { resolve(); return; }
    lastSpokenRef.current = text; // remember for the echo guard
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const vs = window.speechSynthesis.getVoices();
    u.voice =
      vs.find((v) => /en-IN/i.test(v.lang) && /male|prabhat|ravi/i.test(v.name)) ||
      vs.find((v) => /en-IN/i.test(v.lang)) ||
      vs.find((v) => /en[-_]/i.test(v.lang) && /male|david|guy|ryan/i.test(v.name)) ||
      vs.find((v) => /en[-_]/i.test(v.lang)) || null;
    u.rate = 1.03; u.pitch = 1.0;
    speakingRef.current = true; // set BEFORE speak — results arriving early get dropped
    setState('speaking');
    try { recRef.current?.stop(); } catch { /* not running */ }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      // small grace period so the speaker's tail isn't picked up as input
      setTimeout(() => {
        speakingRef.current = false;
        if (micOnRef.current) { setState('listening'); try { recRef.current?.start(); } catch { /* running */ } }
        else setState('idle');
        resolve();
      }, 450);
    };
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
    // watchdog: poll the engine — only give up when it is truly NOT speaking.
    // (The old fixed timer could fire mid-sentence and un-mute the mic while
    //  Aarav was still talking — the cause of the self-hearing loop.)
    const started = Date.now();
    const poll = setInterval(() => {
      const elapsed = Date.now() - started;
      if (elapsed > 90000) { done(); return; }                      // hard cap
      if (elapsed > 2500 && !window.speechSynthesis.speaking) done(); // engine finished/stalled
    }, 400);
  }), []);

  const speak = useCallback((text) => { ttsSpeak(text); }, [ttsSpeak]);

  const reply = useCallback((text, opened) => {
    push({ who: 'av', text, opened });
    speak(text);
  }, [speak]);

  /* ── the guided tour: open every screen, narrate, auto-advance ── */
  const tourRef = useRef(0); // token — bumping it cancels a running tour

  const stopTour = useCallback(() => {
    tourRef.current += 1;
    window.speechSynthesis?.cancel();
  }, []);

  const runTour = useCallback(async (intro) => {
    const token = ++tourRef.current;
    if (intro) { push({ who: 'av', text: intro }); await ttsSpeak(intro); }
    for (const stop of TOUR) {
      if (tourRef.current !== token) return; // user interrupted
      openScreen(stop.screen);
      push({ who: 'av', text: stop.text, opened: SCREEN_NAMES[stop.screen] });
      await ttsSpeak(stop.text);
      if (tourRef.current !== token) return;
      await new Promise((r) => setTimeout(r, 500)); // beat between rooms
    }
    if (tourRef.current !== token) return;
    push({ who: 'av', text: TOUR_OUTRO });
    await ttsSpeak(TOUR_OUTRO);
  }, [openScreen, ttsSpeak]);

  /* ── act on a backend response: open the REAL screen ── */
  const act = useCallback((res) => {
    let opened = null;

    if (res.view === 'start_tour') {
      runTour(res.speech);
      return;
    }

    if (res.view === 'open_screen' && res.data?.screen) {
      opened = res.data.screen;
      openScreen(opened);
      if (res.intent === 'executed') refreshData?.();
      if (res.data.filter) {
        // let the screen mount, then drive its filter chips
        const detail = { screen: res.data.screen, filter: res.data.filter };
        setTimeout(() => window.dispatchEvent(new CustomEvent('aarav-filter', { detail })), 350);
      }
    } else if (res.intent === 'show_training' && res.data?.person?.id) {
      // hand the real learning platform this learner — same as clicking the picker
      localStorage.setItem('tn_learner', JSON.stringify({
        id: res.data.person.id,
        resource_code: res.data.person.resource_code,
        full_name: res.data.person.full_name,
        role: res.data.person.role,
      }));
      opened = 'learn';
      openScreen('learn');
    }

    if (res.needs_confirmation) setPending(res.pending_action);
    reply(res.speech, opened ? SCREEN_NAMES[opened] || opened : null);
  }, [openScreen, refreshData, reply, runTour]);

  /* ── run a confirmed decision ── */
  const runPending = useCallback(async (p) => {
    setPending(null);
    setState('thinking');
    try {
      const res = await api.avatharExecute(p);
      act({ ...res, intent: 'executed' });
    } catch (e) {
      reply(`That failed: ${e.message}. Nothing was changed.`);
      setState(micOnRef.current ? 'listening' : 'idle');
    }
  }, [act, reply]);

  /* ── the command loop ── */
  const handleCommand = useCallback(async (raw) => {
    let text = raw.trim();
    if (!text) return;
    text = text.replace(/^(hey |ok |okay )?(aarav|avathar|avatar|arav|aarov)[,!.]?\s*/i, '') || text;
    push({ who: 'you', text: raw.trim() });

    // any new input interrupts a running tour
    const tourWasRunning = window.speechSynthesis?.speaking && tourRef.current > 0;
    stopTour();
    if (tourWasRunning && /^(stop|wait|pause|enough|cancel)[.!]?$/i.test(text)) {
      reply('Okay, stopping the tour. What would you like to see?');
      return;
    }

    const p = pendingRef.current;
    if (p) {
      if (CONFIRM_RE.test(text)) { runPending(p); return; }
      if (CANCEL_RE.test(text)) {
        setPending(null);
        reply('Cancelled — nothing was changed.');
        return;
      }
      setPending(null); // new command replaces the pending one
    }

    setState('thinking');
    try {
      // conversation memory: the panel's own transcript, oldest → newest
      const history = msgsRef.current.slice(-12).map((m) => ({
        role: m.who === 'you' ? 'user' : 'assistant',
        text: m.text,
      }));
      const res = await api.avatharCommand(text, history);
      act(res);
    } catch (e) {
      reply(`The backend didn't respond: ${e.message}`);
      setState(micOnRef.current ? 'listening' : 'idle');
    }
  }, [act, reply, runPending, stopTour]);

  const handleRef = useRef(handleCommand);
  useEffect(() => { handleRef.current = handleCommand; }, [handleCommand]);

  /* ── speech in ── */
  const startMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { reply('Voice needs Chrome or Edge — but you can type any command below.'); return; }
    const rec = new SR();
    rec.lang = 'en-IN'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = (e) => {
      // hard mute: while Aarav speaks, everything the mic hears is his own voice
      if (speakingRef.current) { setInterim(''); return; }
      let fin = '', mid = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t; else mid += t;
      }
      setInterim(mid);
      if (!fin.trim()) return;
      setInterim('');
      // echo guard: if most of the heard words are words Aarav just said, it's
      // the speaker bleeding into the mic — not the user. Drop it.
      const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
      const heard = norm(fin);
      const spoken = new Set(norm(lastSpokenRef.current));
      if (heard.length >= 3 && spoken.size > 0) {
        const overlap = heard.filter((w) => spoken.has(w)).length / heard.length;
        if (overlap > 0.6) return;
      }
      handleRef.current(fin);
    };
    rec.onend = () => { if (micOnRef.current && !speakingRef.current) { try { rec.start(); } catch { /* restarted */ } } };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') {
        setMicOn(false); setState('idle');
        push({ who: 'av', text: 'Microphone permission denied — allow it in the browser, or type commands.' });
      }
    };
    recRef.current = rec;
    setMicOn(true); setState('listening');
    rec.start();
  };
  const stopMic = () => {
    setMicOn(false); setInterim('');
    setState('idle');
    stopTour();                          // also halts a running tour…
    window.speechSynthesis?.cancel();    // …and cuts Aarav off mid-sentence
    speakingRef.current = false;
    try { recRef.current?.stop(); } catch { /* not running */ }
  };

  useEffect(() => () => {
    micOnRef.current = false;
    try { recRef.current?.stop(); } catch { /* not running */ }
    window.speechSynthesis?.cancel();
  }, []);
  useEffect(() => { window.speechSynthesis?.getVoices(); }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!typed.trim()) return;
    handleCommand(typed);
    setTyped('');
  };

  const joinMeeting = async () => {
    const url = window.prompt('Paste a Microsoft Teams / Google Meet / Zoom link for Aarav to join and present:');
    if (!url) return;
    setState('thinking');
    try {
      const res = await api.startMeeting(url);
      reply(`I'm joining the meeting as ${res.bot_name} — I'll appear on camera and share the app.`);
    } catch (e) {
      reply('Meeting mode is not configured yet.');
      push({ who: 'av', text: e.message });
      setState(micOnRef.current ? 'listening' : 'idle');
    }
  };

  // sits above the AARAV insights orb when the Talent Lead has it
  const bottomOff = role === 'lead' ? 104 : 28;

  /* SVG stand-in until the Avaturn export lands in frontend/public/avathar.glb */
  function FallbackFace({ state: st }) {
    return (
      <div className={`ava-svgface ava-svgface--${st}`}>
        <svg viewBox="0 0 200 200">
          <defs>
            <radialGradient id="avaHeadG" cx="38%" cy="32%" r="80%">
              <stop offset="0%" stopColor="#9d7bff" />
              <stop offset="55%" stopColor="#6a3df0" />
              <stop offset="100%" stopColor="#3c1e9e" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="76" fill="url(#avaHeadG)" />
          <g className="ava-svgface__eyes" fill="#0b0920">
            <ellipse cx="74" cy="92" rx="9" ry="14" />
            <ellipse cx="126" cy="92" rx="9" ry="14" />
            <circle cx="77.5" cy="86.5" r="3" fill="#fff" opacity=".9" />
            <circle cx="129.5" cy="86.5" r="3" fill="#fff" opacity=".9" />
          </g>
          <rect className="ava-svgface__mouth" x="83" y="125" width="34" height="9" rx="4.5" fill="#0b0920" />
        </svg>
        <div className="ava-svgface__hint">Put your Avaturn export at frontend/public/model.glb to see your avatar here</div>
      </div>
    );
  }

  return (
    <>
      {!open && (
        <button
          className={`ava-orb ${micOn ? 'ava-orb--live' : ''}`}
          style={{ bottom: bottomOff }}
          onClick={() => setOpen(true)}
          title="Aarav — your AI assistant"
          id="avathar-orb-btn"
        >
          A
        </button>
      )}

      {open && (
        <div className="ava-panel" style={{ bottom: bottomOff }} id="avathar-panel">
          <div className="ava-head">
            <div className="ava-head__logo">A</div>
            <div>
              <div className="ava-head__name">Aarav</div>
              <div className={`ava-head__state ava-head__state--${state}`}>
                {state === 'listening' ? 'Listening…' : state === 'thinking' ? 'Thinking…' : state === 'speaking' ? 'Speaking' : 'Idle'}
              </div>
            </div>
            <button className="ava-head__close" onClick={joinMeeting} id="avathar-meet-btn" title="Join a Teams / Meet / Zoom call and present the app">📹</button>
            <button className="ava-head__close" style={{ marginLeft: 0 }} onClick={() => { stopMic(); setOpen(false); }} id="avathar-close-btn">✕</button>
          </div>

          {/* the face — your Avaturn avatar if frontend/public/avathar.glb exists */}
          <div className={`ava-face-stage ava-face-stage--${state}`}>
            {has3d
              ? <AvatarFace3D state={state} height={185} onMissing={() => setHas3d(false)} />
              : <FallbackFace state={state} />}
          </div>

          {msgs.length === 0 && (
            <div className="ava-cmds">
              {SUGGESTIONS.map((c) => (
                <button key={c} onClick={() => handleCommand(c)}>{c}</button>
              ))}
            </div>
          )}

          <div className="ava-msgs">
            {msgs.length === 0 && (
              <div className="ava-msg ava-msg--av">
                Hi, I'm Aarav. Ask me anything about your talent program — or ask for a full
                tour and I'll walk you through every page while you share your screen.
                Decisions always get read back for your “confirm”.
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`ava-msg ava-msg--${m.who === 'you' ? 'you' : 'av'} ${m.opened ? 'ava-msg--action' : ''}`}>
                {m.text}
                {m.opened && <span className="ava-msg__open">↗ opened {m.opened}</span>}
              </div>
            ))}
            {interim && <div className="ava-msg ava-msg--you ava-msg--interim">{interim}…</div>}
            {pending && (
              <div className="ava-confirm">
                <b>{pending.action === 'approve' ? 'Approve' : 'Reject'}: {pending.person}</b>
                <p>{pending.program}</p>
                <div className="ava-confirm__row">
                  <button className="ava-confirm__yes" onClick={() => runPending(pending)} id="avathar-confirm-btn">✓ Confirm</button>
                  <button className="ava-confirm__no" onClick={() => { setPending(null); reply('Cancelled — nothing was changed.'); }} id="avathar-cancel-btn">Cancel</button>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="ava-inrow" onSubmit={submit}>
            <button type="button" className={`ava-mic ${micOn ? 'ava-mic--on' : ''}`} onClick={micOn ? stopMic : startMic} id="avathar-mic-btn" title={micOn ? 'Stop listening' : 'Start talking'}>
              {micOn ? '⏹' : '🎙'}
            </button>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Ask me anything…" id="avathar-typed-input" />
            <button type="submit" className="ava-send" title="Send">➤</button>
          </form>
        </div>
      )}
    </>
  );
}
