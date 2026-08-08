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
        if (micOnRef.current) {
          setState('listening');
          // recRef may hold a fresh instance (swapped in during aborted error).
          // start() throws if already running — that's fine, just ignore it.
          try { recRef.current?.start(); } catch { /* already running */ }
        }
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
    // cancel() fires ttsSpeak's onerror/done but leaves speakingRef true — clear it
    // so the mic can restart properly after the tour is stopped
    speakingRef.current = false;
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

    // meeting-bot controls — handled locally, not by the AI brain
    if (/^(stop|end|leave|delete|kill)( the)?( meeting)?( bot| call| meeting)?$/i.test(text) ||
        /\b(stop|end|leave)\b.*\b(bot|meeting|call)\b/i.test(text)) {
      try {
        const s = await api.ownBotStatus();
        if (s.running) {
          await api.stopOwnBot();
          reply('Done — I left the meeting and closed the bot window.');
        } else {
          reply("There's no meeting bot running right now.");
        }
      } catch {
        reply("I couldn't reach the backend to check the bot.");
      }
      return;
    }
    if (/\b(bot|meeting) status\b|\bis the bot (running|in)\b/i.test(text)) {
      try {
        const s = await api.ownBotStatus();
        reply(s.running ? `The bot is ${s.status}.` : "No meeting bot is running.");
      } catch {
        reply("I couldn't reach the backend to check the bot.");
      }
      return;
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

  /* ══════════════════════════════════════════════════════════
     Speech input — two modes:
     1. Web Speech API (primary): fast, streaming, needs Google servers
     2. MediaRecorder + Gemini transcription (fallback): works even when
        Google's speech servers are blocked by ISP/firewall. Switches
        automatically after 2 consecutive network errors.
     ══════════════════════════════════════════════════════════ */

  const retryCountRef   = useRef(0);
  const mediaRecRef     = useRef(null);  // MediaRecorder instance (fallback)
  const audioCtxRef     = useRef(null);  // AudioContext for VAD
  const chunksRef       = useRef([]);    // recorded audio chunks
  const silenceTimerRef = useRef(null);  // fires after 1.2 s of silence
  const [fallbackMode, setFallbackMode] = useState(false); // show mode badge

  /* ── helpers ── */
  const stopMediaRecorder = () => {
    try { mediaRecRef.current?.stop(); } catch { /* not running */ }
    try { audioCtxRef.current?.close(); } catch { /* already closed */ }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    mediaRecRef.current = null;
    audioCtxRef.current = null;
    chunksRef.current   = [];
  };

  /* ── FALLBACK: MediaRecorder + Gemini transcription ─────────────── */
  const startMediaRecorderMode = async () => {
    setFallbackMode(true);
    setMicOn(true);
    setState('listening');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      push({ who: 'av', text: 'Microphone permission denied — allow it in the browser, or type commands.' });
      setMicOn(false); setState('idle'); setFallbackMode(false); return;
    }

    /* VAD via AudioContext analyser */
    const ctx    = new AudioContext();
    audioCtxRef.current = ctx;
    const src    = ctx.createMediaStreamSource(stream);
    const anal   = ctx.createAnalyser();
    anal.fftSize = 512;
    src.connect(anal);
    const buf = new Float32Array(anal.fftSize);

    const SILENCE_DB  = -45;   // dBFS below which we consider silence
    const SILENCE_MS  = 1200;  // ms of silence before we send the clip
    const MIN_BYTES   = 3000;  // ignore clips shorter than this (background noise)

    /* start a fresh recording session */
    const startSession = () => {
      if (!micOnRef.current) return;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        // If Aarav is speaking, wait until she's done before transcribing —
        // otherwise we'd record her own voice output as the next command
        if (speakingRef.current) {
          const waitForSpeechEnd = () => {
            if (!micOnRef.current) return;
            if (speakingRef.current) { setTimeout(waitForSpeechEnd, 100); return; }
            startSession();
          };
          waitForSpeechEnd();
          return;
        }
        if (!micOnRef.current) return;
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < MIN_BYTES) { startSession(); return; } // too short — noise
        setInterim('Transcribing…');
        try {
          const res = await api.transcribeAudio(blob);
          setInterim('');
          const txt = (res.transcript || '').trim();
          if (!txt) { startSession(); return; }
          // echo guard
          const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
          const heard  = norm(txt);
          const spoken = new Set(norm(lastSpokenRef.current));
          if (heard.length >= 3 && spoken.size > 0) {
            const overlap = heard.filter((w) => spoken.has(w)).length / heard.length;
            if (overlap > 0.6) { startSession(); return; }
          }
          handleRef.current(txt);
        } catch (err) {
          setInterim('');
          push({ who: 'av', text: `Transcription failed: ${err.message}` });
        }
        if (micOnRef.current && !speakingRef.current) startSession();
      };
      mr.start(100); // collect data every 100 ms
      mediaRecRef.current = mr;
    };

    /* VAD poll — check RMS every 80 ms */
    const vadPoll = setInterval(() => {
      if (!micOnRef.current) { clearInterval(vadPoll); return; }
      if (speakingRef.current) return; // Aarav is speaking — don't listen
      anal.getFloatTimeDomainData(buf);
      const rms  = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
      const db   = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
      const loud = db > SILENCE_DB;

      if (loud) {
        // user is speaking — cancel any pending silence timer
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      } else {
        // silence — start timer if not already running
        if (!silenceTimerRef.current && mediaRecRef.current?.state === 'recording') {
          silenceTimerRef.current = setTimeout(() => {
            silenceTimerRef.current = null;
            try { mediaRecRef.current?.stop(); } catch { /* already stopped */ }
          }, SILENCE_MS);
        }
      }
    }, 80);

    startSession();
  };

  /* ── PRIMARY: Web Speech API ──────────────────────────────────────── */
  const startMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      // No Web Speech API at all — go straight to MediaRecorder
      startMediaRecorderMode();
      return;
    }

    retryCountRef.current = 0;
    setMicOn(true);
    setState('listening');

    const createRec = () => {
      const rec = new SR();
      rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = true;

      rec.onresult = (e) => {
        if (speakingRef.current) { setInterim(''); return; }
        let fin = '', mid = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) fin += t; else mid += t;
        }
        setInterim(mid);
        if (!fin.trim()) return;
        setInterim('');
        retryCountRef.current = 0;
        const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
        const heard  = norm(fin);
        const spoken = new Set(norm(lastSpokenRef.current));
        if (heard.length >= 3 && spoken.size > 0) {
          const overlap = heard.filter((w) => spoken.has(w)).length / heard.length;
          if (overlap > 0.6) return;
        }
        handleRef.current(fin);
      };

      rec.onend = () => {
        if (micOnRef.current && !speakingRef.current && recRef.current === rec) {
          setTimeout(() => {
            if (micOnRef.current && !speakingRef.current && recRef.current === rec) {
              try { rec.start(); } catch { /* already running or disposed */ }
            }
          }, 200);
        }
      };

      rec.onerror = (e) => {
        if (e.error === 'not-allowed') {
          setMicOn(false); setState('idle');
          push({ who: 'av', text: 'Microphone permission denied — allow it in the browser, or type commands.' });
        } else if (e.error === 'no-speech') {
          // Normal — silence timeout. onend will restart.
        } else if (e.error === 'aborted') {
          // Chrome fires 'aborted' when rec.stop() is called (e.g. during TTS).
          // The dead instance can't be restarted — swap in a fresh one so that
          // onend (or ttsSpeak's restart call) gets a usable recognizer.
          if (recRef.current === rec) recRef.current = createRec();
        } else if (e.error === 'network') {
          retryCountRef.current += 1;
          if (retryCountRef.current <= 1) {
            // One brief retry in case it's a transient blip
            setTimeout(() => {
              if (micOnRef.current && !speakingRef.current) {
                recRef.current = createRec();
                try { recRef.current.start(); } catch { /* disposed */ }
              }
            }, 800);
          } else {
            // Google servers are unreachable — auto-switch to MediaRecorder+Gemini
            setMicOn(false); setState('idle');
            recRef.current = null;
            retryCountRef.current = 0;
            push({ who: 'av', text: "Google's speech servers are unreachable — switching to Gemini transcription mode automatically." });
            // Automatically start fallback — no need for the user to click again
            startMediaRecorderMode();
          }
        } else {
          push({ who: 'av', text: `Mic error: ${e.error} — try clicking the mic button again.` });
          setMicOn(false); setState('idle');
        }
      };

      return rec;
    };

    recRef.current = createRec();
    try { recRef.current.start(); } catch { /* already started */ }
  };

  const stopMic = () => {
    setMicOn(false); setInterim('');
    setState('idle');
    setFallbackMode(false);
    stopTour();
    window.speechSynthesis?.cancel();
    speakingRef.current = false;
    try { recRef.current?.stop(); } catch { /* not running */ }
    stopMediaRecorder();
  };


  useEffect(() => () => {
    micOnRef.current = false;
    try { recRef.current?.stop(); } catch { /* not running */ }
    window.speechSynthesis?.cancel();
    stopMediaRecorder();
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
    // Primary: our own self-hosted bot (free — Chrome on this machine joins as
    // Aarav). Fallback: the AgentCall cloud bot, if it's configured & funded.
    try {
      const res = await api.startOwnBot(url);
      reply(`I'm joining as ${res.bot_name} in a Chrome window on this machine — admit me from the meeting lobby, then say "Aarav, give us a tour".`);
      return;
    } catch (e) {
      push({ who: 'av', text: `Own bot: ${e.message} — trying the cloud bot…` });
    }
    try {
      const res = await api.startMeeting(url);
      reply(`I'm joining the meeting as ${res.bot_name} — I'll appear on camera and share the app.`);
    } catch (e) {
      const msg = e.message || 'the backend did not respond';
      if (/AGENTCALL_API_KEY|AVATHAR_PUBLIC_URL|tunnel/i.test(msg)) {
        reply('Meeting mode needs setup. ' + msg);
      } else {
        reply("I couldn't join the meeting. " + msg);
      }
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
              <div className="ava-head__name">Aarav
                {fallbackMode && <span style={{ fontSize: 9, background: '#7c3aed', color: '#fff', borderRadius: 4, padding: '1px 5px', marginLeft: 6, verticalAlign: 'middle' }}>Gemini STT</span>}
              </div>
              <div className={`ava-head__state ava-head__state--${state}`}>
                {state === 'listening' ? (fallbackMode ? 'Listening (Gemini)…' : 'Listening…') : state === 'thinking' ? 'Thinking…' : state === 'speaking' ? 'Speaking' : 'Idle'}
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
