"""
Self-hosted meeting bot — our own AgentCall.

How the technology works (same principle as agentcall.dev / recall.ai):
  * A real Chromium (via Playwright) joins the meeting AS A GUEST PARTICIPANT.
  * Its "webcam" is a <canvas> rendering a live animated Aarav avatar
    (getUserMedia is overridden before the meeting page loads).
  * Its "microphone" is a WebAudio MediaStreamDestination; replies are
    synthesised with Microsoft Edge neural TTS (free) and played into it —
    participants hear Aarav, and the avatar's mouth moves with the audio.
  * It HEARS the meeting by hooking RTCPeerConnection and tapping every
    remote audio track. A VAD segments speech into utterances, which are
    transcribed with Groq Whisper (already used elsewhere in this app).
  * The app screenshare is a second tab at /?present=1 — the same
    present-state mechanism the AgentCall integration used.

Costs nothing. Trade-offs vs a hosted service: the bot runs in a visible
Chrome window on this machine, someone must admit it from the lobby, and
Teams/Meet occasionally change their join-screen UI (selectors below are
best-effort with fallbacks).
"""

import asyncio
import base64
import os
import tempfile

from config import settings

BOT_APP_URL = os.environ.get("OWNBOT_APP_URL", "http://localhost:5180")
PRESENT_TITLE = "Aarav Presents"
TTS_VOICE = os.environ.get("OWNBOT_TTS_VOICE", "en-IN-PrabhatNeural")

# ── the media override — injected into every page BEFORE it loads ──
INIT_SCRIPT = r"""
(() => {
  if (window.__aaravBotInit) return; window.__aaravBotInit = true;
  window.__aaravInbox = [];        // finished utterances (base64 webm) for Python
  window.__aaravStatus = 'boot';
  window.__aaravSpeaking = false;

  /* ── avatar canvas = the bot's webcam ── */
  const W = 640, H = 480;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  let mouth = 0, blink = 0, nextBlink = Date.now() + 3000;

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#131033'); g.addColorStop(1, '#0b0920');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2 - 10, r = 130;
    const hg = ctx.createRadialGradient(cx - 45, cy - 55, 20, cx, cy, r + 30);
    hg.addColorStop(0, '#9d7bff'); hg.addColorStop(0.55, '#6a3df0'); hg.addColorStop(1, '#3c1e9e');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    if (Date.now() > nextBlink) { blink = 6; nextBlink = Date.now() + 2500 + Math.random() * 3000; }
    const eh = Math.max(2, 22 - blink * 4); if (blink > 0) blink -= 1;
    ctx.fillStyle = '#0b0920';
    ctx.beginPath(); ctx.ellipse(cx - 45, cy - 15, 14, eh, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 45, cy - 15, 14, eh, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(cx - 40, cy - 22, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 50, cy - 22, 4, 0, Math.PI * 2); ctx.fill();
    const mh = 8 + mouth * 34;
    ctx.fillStyle = '#0b0920';
    if (ctx.roundRect) {
      ctx.beginPath(); ctx.roundRect(cx - 30, cy + 48 - mh / 2, 60, mh, 10); ctx.fill();
    } else {
      ctx.fillRect(cx - 30, cy + 48 - mh / 2, 60, mh);
    }
    ctx.fillStyle = 'rgba(238,240,255,.85)';
    ctx.font = '700 26px Poppins, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Aarav · Talent Nurturing', cx, H - 34);
  }
  setInterval(draw, 33);
  const videoStream = canvas.captureStream(30);

  /* ── outgoing voice = the bot's microphone ── */
  const actx = new (window.AudioContext || window.webkitAudioContext)();
  const dest = actx.createMediaStreamDestination();
  const analyser = actx.createAnalyser(); analyser.fftSize = 256;
  analyser.connect(dest);
  const lvlBuf = new Uint8Array(analyser.frequencyBinCount);
  setInterval(() => {
    if (!window.__aaravSpeaking) { mouth = Math.max(0, mouth - 0.15); return; }
    analyser.getByteFrequencyData(lvlBuf);
    const avg = lvlBuf.reduce((a, b) => a + b, 0) / lvlBuf.length / 255;
    mouth = Math.min(1, avg * 3);
  }, 50);

  window.__aaravSpeak = (b64) => new Promise((resolve) => {
    try {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      actx.decodeAudioData(bytes.buffer.slice(0), (buf) => {
        const src = actx.createBufferSource();
        src.buffer = buf;
        src.connect(analyser);
        window.__aaravSpeaking = true;
        src.onended = () => { window.__aaravSpeaking = false; resolve(true); };
        if (actx.state === 'suspended') actx.resume();
        src.start();
      }, () => { window.__aaravSpeaking = false; resolve(false); });
    } catch (e) { window.__aaravSpeaking = false; resolve(false); }
  });

  /* ── fake devices ── */
  const realGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => {
    const tracks = [];
    if (c && c.video) tracks.push(videoStream.getVideoTracks()[0]);
    if (c && c.audio) tracks.push(dest.stream.getAudioTracks()[0]);
    if (!tracks.length) return realGUM(c);
    return new MediaStream(tracks);
  };
  const realEnum = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
  navigator.mediaDevices.enumerateDevices = async () => {
    const list = await realEnum().catch(() => []);
    if (list.some(d => d.kind === 'videoinput' && d.label)) return list;
    return [
      { deviceId: 'aarav-cam', kind: 'videoinput', label: 'Aarav Avatar Camera', groupId: 'aarav', toJSON(){return this;} },
      { deviceId: 'aarav-mic', kind: 'audioinput', label: 'Aarav Voice', groupId: 'aarav', toJSON(){return this;} },
      { deviceId: 'default', kind: 'audiooutput', label: 'Speakers', groupId: 'aarav', toJSON(){return this;} },
    ];
  };

  /* ── hear the meeting: tap remote WebRTC audio; VAD-segmented recording ── */
  const recCtx = new (window.AudioContext || window.webkitAudioContext)();
  const mix = recCtx.createGain();
  const recDest = recCtx.createMediaStreamDestination();
  const vadAnal = recCtx.createAnalyser(); vadAnal.fftSize = 512;
  mix.connect(recDest); mix.connect(vadAnal);
  const vadBuf = new Float32Array(vadAnal.fftSize);
  let tapped = 0;

  function tapTrack(track) {
    try {
      const ms = new MediaStream([track]);
      // Chrome quirk: a remote track only feeds WebAudio once it's attached to
      // a playing media element. Keep a muted one alive per track.
      const keepAlive = new Audio();
      keepAlive.srcObject = ms;
      keepAlive.muted = true;
      keepAlive.play().catch(() => {});
      const src = recCtx.createMediaStreamSource(ms);
      src.connect(mix);
      tapped += 1;
      window.__aaravStatus = 'hearing ' + tapped + ' audio track(s)';
    } catch (e) { /* track not ready */ }
  }
  const RealPC = window.RTCPeerConnection;
  if (RealPC) {
    window.RTCPeerConnection = function (...args) {
      const pc = new RealPC(...args);
      pc.addEventListener('track', (e) => { if (e.track.kind === 'audio') tapTrack(e.track); });
      return pc;
    };
    window.RTCPeerConnection.prototype = RealPC.prototype;
    Object.setPrototypeOf(window.RTCPeerConnection, RealPC);
  }

  let mr = null, chunks = [], silenceStart = 0, voiced = false;
  const SILENCE_DB = -48, HOLD_MS = 1100, MIN_BYTES = 4500;
  function level() {
    vadAnal.getFloatTimeDomainData(vadBuf);
    let s = 0; for (let i = 0; i < vadBuf.length; i++) s += vadBuf[i] * vadBuf[i];
    const rms = Math.sqrt(s / vadBuf.length);
    return rms > 0 ? 20 * Math.log10(rms) : -100;
  }
  function startRec() {
    chunks = [];
    try {
      mr = new MediaRecorder(recDest.stream, { mimeType: 'audio/webm;codecs=opus' });
    } catch (e) { mr = new MediaRecorder(recDest.stream); }
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      // drop clips recorded while Aarav himself was talking (echo guard)
      if (blob.size >= MIN_BYTES && !window.__aaravSpeaking) {
        const fr = new FileReader();
        fr.onload = () => window.__aaravInbox.push(String(fr.result).split(',')[1]);
        fr.readAsDataURL(blob);
      }
    };
    mr.start(200);
  }
  setInterval(() => {
    if (recCtx.state === 'suspended') recCtx.resume();
    const db = level();
    if (db > SILENCE_DB && !window.__aaravSpeaking) {
      silenceStart = 0;
      if (!voiced) { voiced = true; startRec(); }
    } else if (voiced) {
      if (!silenceStart) silenceStart = Date.now();
      else if (Date.now() - silenceStart > HOLD_MS) {
        voiced = false; silenceStart = 0;
        try { if (mr && mr.state !== 'inactive') mr.stop(); } catch (e) {}
      }
    }
  }, 90);
})();
"""


async def tts_mp3(text: str) -> bytes:
    """Free neural TTS via Microsoft Edge voices."""
    import edge_tts

    audio = b""
    communicate = edge_tts.Communicate(text, TTS_VOICE, rate="+8%")
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
    return audio


def transcribe_webm(audio_bytes: bytes) -> str:
    """Groq Whisper on a complete webm utterance (same path the in-app mic uses)."""
    if not settings.groq_api_key or not audio_bytes:
        return ""
    from groq import Groq

    client = Groq(api_key=settings.groq_api_key)
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(audio_bytes)
        path = tmp.name
    try:
        with open(path, "rb") as f:
            out = client.audio.transcriptions.create(
                model="whisper-large-v3", file=f, language="en",
            )
        return (out.text or "").strip()
    except Exception as e:
        print(f"[OWNBOT] transcription failed: {str(e)[:150]}")
        return ""
    finally:
        os.unlink(path)


class MeetBot:
    """One meeting bot instance (the app runs at most one at a time)."""

    def __init__(self, meet_url: str, bot_name: str, on_transcript):
        self.meet_url = meet_url
        self.bot_name = bot_name
        self.on_transcript = on_transcript      # async callback(text)
        self.status = "starting"
        self.js_status = ""                     # live probe from inside the page
        self.transcript: list[str] = []
        self._pw = None
        self._browser = None
        self._page = None
        self._present_page = None
        self._speak_lock = asyncio.Lock()
        self._stopping = False

    # ── lifecycle ──────────────────────────────────────────────

    async def start(self):
        from playwright.async_api import async_playwright

        self._pw = await async_playwright().start()
        self._browser = await self._pw.chromium.launch(
            headless=False,   # visible on purpose: you can watch/rescue the bot
            args=[
                "--use-fake-ui-for-media-stream",            # auto-allow cam/mic
                "--autoplay-policy=no-user-gesture-required",
                f"--auto-select-tab-capture-source-by-title={PRESENT_TITLE}",
                f"--auto-select-desktop-capture-source={PRESENT_TITLE}",
                "--disable-blink-features=AutomationControlled",
                "--lang=en-US",
            ],
        )
        context = await self._browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
            ),
        )
        await context.grant_permissions(["camera", "microphone"])
        await context.add_init_script(INIT_SCRIPT)

        # tab 1 — the app in presentation mode (what we screenshare)
        self._present_page = await context.new_page()
        try:
            await self._present_page.goto(f"{BOT_APP_URL}/?present=1", timeout=20000)
            # pin the tab title so the auto-select capture flags can find it
            await self._present_page.evaluate(
                f"setInterval(() => document.title = '{PRESENT_TITLE}', 500)"
            )
        except Exception as e:
            print(f"[OWNBOT] present tab failed (app not running?): {str(e)[:120]}")

        # tab 2 — the meeting itself
        self._page = await context.new_page()
        self.status = "opening meeting page"
        await self._page.goto(self.meet_url, timeout=45000)
        await self._join_flow()

        asyncio.create_task(self._listen_loop())

    async def stop(self):
        self._stopping = True
        self.status = "stopped"
        for closer in (self._browser, self._pw):
            try:
                if closer is self._pw:
                    await closer.stop()
                elif closer:
                    await closer.close()
            except Exception:
                pass

    # ── join flows (best-effort selectors, multiple fallbacks) ──

    async def _click_first(self, selectors: list[str], timeout=4000) -> bool:
        for sel in selectors:
            try:
                await self._page.locator(sel).first.click(timeout=timeout)
                return True
            except Exception:
                continue
        return False

    async def _fill_first(self, selectors: list[str], value: str, timeout=4000) -> bool:
        for sel in selectors:
            try:
                await self._page.locator(sel).first.fill(value, timeout=timeout)
                return True
            except Exception:
                continue
        return False

    async def _join_flow(self):
        url = self.meet_url.lower()
        page = self._page
        try:
            if "teams" in url:
                self.status = "joining Teams"
                # "Continue on this browser" interstitial
                await self._click_first([
                    'button:has-text("Continue on this browser")',
                    'a:has-text("Continue on this browser")',
                    'button:has-text("Join on the web instead")',
                ], timeout=12000)
                await page.wait_for_timeout(4000)
                await self._fill_first([
                    'input[data-tid="prejoin-display-name-input"]',
                    'input[placeholder*="name" i]',
                    'input[type="text"]',
                ], self.bot_name, timeout=15000)
                await self._click_first([
                    'button[data-tid="prejoin-join-button"]',
                    'button:has-text("Join now")',
                ], timeout=10000)
            elif "meet.google" in url:
                self.status = "joining Google Meet"
                await self._click_first(['button:has-text("Got it")'], timeout=5000)
                await self._fill_first([
                    'input[aria-label="Your name"]',
                    'input[placeholder*="name" i]',
                ], self.bot_name, timeout=15000)
                await self._click_first([
                    'button:has-text("Ask to join")',
                    'button:has-text("Join now")',
                ], timeout=10000)
            elif "zoom" in url:
                self.status = "joining Zoom (web)"
                await self._click_first([
                    'a:has-text("Join from your browser")',
                    'a:has-text("join from your browser")',
                ], timeout=15000)
                await self._fill_first(['input#input-for-name', 'input[type="text"]'],
                                       self.bot_name, timeout=15000)
                await self._click_first(['button:has-text("Join")'], timeout=10000)
            else:
                self.status = "unknown platform — joined page, manual join may be needed"
                return
            self.status = "waiting in lobby — ADMIT the bot from the meeting"
        except Exception as e:
            # The Chrome window is visible — the user can always finish joining by hand.
            self.status = f"join flow needs help (finish in the bot's Chrome window): {str(e)[:100]}"

    async def try_screenshare(self):
        """Best-effort: click the platform's share button; Chrome auto-picks the
        'Aarav Presents' tab thanks to the launch flags."""
        ok = await self._click_first([
            'button[aria-label*="Present now" i]',
            'button[aria-label*="Share screen" i]',
            'button[data-tid="share-button"]',
            'button[aria-label*="Share content" i]',
        ], timeout=6000)
        if ok:
            await self._page.wait_for_timeout(1000)
            # Teams opens a submenu after the share button
            await self._click_first([
                'button:has-text("Screen, window, or tab")',
                'button:has-text("Browser tab")',
            ], timeout=3000)
        return ok

    # ── talking & listening ────────────────────────────────────

    async def speak(self, text: str):
        if not text or self._stopping:
            return
        async with self._speak_lock:      # one utterance at a time
            try:
                mp3 = await tts_mp3(text)
                b64 = base64.b64encode(mp3).decode()
                ok = await self._page.evaluate("b64 => window.__aaravSpeak(b64)", b64)
                if not ok:
                    print("[OWNBOT] speak: audio decode failed in page")
            except Exception as e:
                print(f"[OWNBOT] speak failed: {str(e)[:150]}")

    async def _listen_loop(self):
        """Poll finished utterances out of the page, transcribe, hand to the brain."""
        while not self._stopping:
            await asyncio.sleep(0.8)
            try:
                chunks = await self._page.evaluate("window.__aaravInbox.splice(0)")
                self.js_status = await self._page.evaluate("window.__aaravStatus")
                if self.js_status and "hearing" in self.js_status:
                    self.status = f"in meeting — {self.js_status}"
            except Exception:
                continue  # page navigating (lobby → meeting)
            for b64 in chunks or []:
                audio = base64.b64decode(b64)
                text = await asyncio.to_thread(transcribe_webm, audio)
                if not text:
                    continue
                self.transcript.append(text)
                del self.transcript[:-50]
                print(f"[OWNBOT] heard: {text[:120]}")
                try:
                    await self.on_transcript(text)
                except Exception as e:
                    print(f"[OWNBOT] transcript handler error: {str(e)[:150]}")
