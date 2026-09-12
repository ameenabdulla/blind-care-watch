const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// In-memory state
let d2State = false;
let lastEspHeartbeat = 0;
let isFallAlert = false;
let isSosAlert = false;
let fallDetails = null;
let resetRequested = false;
let lastTelemetry = {
  g_force: 1.0,
  pitch: 0,
  roll: 0,
  posture: "UPRIGHT",
  activity: "NORMAL",
  battery: 98,
  timestamp: Date.now()
};

// Fast API for ESP32 and Web App (backward compatible)
app.get('/api/d2', (req, res) => {
  if (req.query.device === 'esp32') {
    lastEspHeartbeat = Date.now();
  }

  const isOnline = (Date.now() - lastEspHeartbeat) < 4000;

  res.json({
    d2: d2State,
    online: isOnline,
    fall: isFallAlert,
    sos: isSosAlert,
    last_seen: lastEspHeartbeat ? Math.round((Date.now() - lastEspHeartbeat) / 1000) : null
  });
});

// Fast API to toggle D2 state
app.post('/api/d2', (req, res) => {
  const { state } = req.body;
  if (typeof state === 'boolean') {
    d2State = state;
    console.log(`[D2 PIN] Switched to: ${d2State ? 'ON' : 'OFF'}`);
    res.json({ success: true, d2: d2State });
  } else {
    res.status(400).json({ error: "State must be boolean" });
  }
});

// Telemetry endpoint called by ESP32 every 350ms
app.post('/api/telemetry', (req, res) => {
  lastEspHeartbeat = Date.now();
  const data = req.body || {};

  if (data.fall) {
    if (!isFallAlert) {
      console.log('🚨 [ALERT] CRITICAL PATIENT FALL DETECTED by ESP32!');
      isFallAlert = true;
      fallDetails = {
        time: new Date().toLocaleTimeString(),
        g_force: data.g_force || 2.5,
        pitch: data.pitch || 0,
        roll: data.roll || 0,
        posture: data.posture || "LYING DOWN (FLAT)"
      };
    }
  }

  if (data.sos) {
    isSosAlert = true;
    console.log('🚨 [ALERT] SOS TRIGGERED by ESP32!');
  }

  if (data.g_force !== undefined) {
    lastTelemetry = {
      g_force: data.g_force,
      pitch: data.pitch,
      roll: data.roll,
      posture: data.posture || "UPRIGHT",
      activity: data.activity || "NORMAL",
      battery: data.battery || 98,
      timestamp: Date.now()
    };
  }

  const sendReset = resetRequested;
  if (resetRequested) resetRequested = false;

  res.json({
    d2: d2State,
    reset_alarm: sendReset
  });
});

// Reset Fall Alarm
app.post('/api/reset-alarm', (req, res) => {
  isFallAlert = false;
  isSosAlert = false;
  fallDetails = null;
  resetRequested = true;
  console.log('✅ [ALERT] Alarm reset by user on Web App!');
  res.json({ success: true });
});

// Comprehensive status endpoint for web app
app.get('/api/status', (req, res) => {
  const isOnline = (Date.now() - lastEspHeartbeat) < 4000;
  res.json({
    d2: d2State,
    online: isOnline,
    fall: isFallAlert,
    sos: isSosAlert,
    fall_details: fallDetails,
    telemetry: lastTelemetry,
    last_seen: lastEspHeartbeat ? Math.round((Date.now() - lastEspHeartbeat) / 1000) : null
  });
});

// Single-page slide switch UI with Ultra-Smooth 120FPS Animation & Zero-Lag Lock
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>ESP32 D2 Controller</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #070a12;
      --card: #0f172a;
      --neon-blue: #38bdf8;
      --neon-green: #22c55e;
      --neon-red: #ef4444;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; -webkit-tap-highlight-color: transparent; }
    body {
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .card {
      background: var(--card);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 36px;
      padding: 44px 32px;
      width: 100%;
      max-width: 360px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 30px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
      user-select: none;
    }
    .header h1 {
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .header p {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 4px;
    }

    /* ONLINE / OFFLINE STATUS BADGE */
    .status-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 16px;
      border-radius: 30px;
      font-size: 0.8rem;
      font-weight: 800;
      letter-spacing: 0.03em;
      transition: all 0.25s ease;
    }
    .status-badge.online {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.35);
      color: var(--neon-green);
    }
    .status-badge.offline {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.35);
      color: var(--neon-red);
    }
    .status-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      transition: all 0.25s ease;
    }
    .status-badge.online .status-dot {
      background: var(--neon-green);
      box-shadow: 0 0 12px var(--neon-green);
      animation: pulse-dot 1.5s infinite;
    }
    .status-badge.offline .status-dot {
      background: var(--neon-red);
    }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    /* ULTRA SMOOTH 120FPS SLIDE SWITCH */
    .switch-wrap {
      position: relative;
      width: 140px;
      height: 74px;
      cursor: pointer;
      display: inline-block;
      touch-action: manipulation;
    }
    .switch-wrap input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
      pointer-events: none;
    }
    
    /* Base track (dark slate) */
    .slider-track {
      position: absolute;
      inset: 0;
      background: #1e293b;
      border: 2px solid rgba(255, 255, 255, 0.12);
      border-radius: 50px;
      overflow: hidden;
      transition: border-color 0.25s ease, box-shadow 0.25s ease;
    }

    /* Smooth glow overlay (100% GPU composited opacity fade, 0% stutter) */
    .slider-glow {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, #0284c7, #38bdf8);
      opacity: 0;
      transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: opacity;
    }

    /* The White Mechanical Knob */
    .slider-knob {
      position: absolute;
      top: 6px;
      left: 6px;
      width: 58px;
      height: 58px;
      background: #ffffff;
      border-radius: 50%;
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.2);
      transform: translate3d(0, 0, 0);
      transition: transform 0.25s cubic-bezier(0.25, 1, 0.5, 1), width 0.18s ease;
      will-change: transform;
      z-index: 2;
    }

    /* Active / Checked States */
    input:checked ~ .slider-track {
      border-color: rgba(56, 189, 248, 0.6);
      box-shadow: 0 0 35px rgba(56, 189, 248, 0.45);
    }
    input:checked ~ .slider-track .slider-glow {
      opacity: 1;
    }
    input:checked ~ .slider-knob {
      transform: translate3d(66px, 0, 0);
    }
    .switch-wrap:active .slider-knob {
      width: 63px;
    }

    /* Status Text */
    .status-text {
      font-size: 1.25rem;
      font-weight: 800;
      transition: color 0.2s ease, text-shadow 0.2s ease;
      color: #94a3b8;
    }
    .status-text.on {
      color: var(--neon-blue);
      text-shadow: 0 0 20px rgba(56, 189, 248, 0.6);
    }

    /* FALL EMERGENCY WARNING BANNER */
    .fall-banner {
      display: none;
      width: 100%;
      background: rgba(239, 68, 68, 0.16);
      border: 2px solid #ef4444;
      border-radius: 26px;
      padding: 22px 18px;
      text-align: center;
      animation: pulse-red 1s infinite alternate ease-in-out;
      box-shadow: 0 0 35px rgba(239, 68, 68, 0.4);
    }
    .fall-banner.active {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    @keyframes pulse-red {
      from { box-shadow: 0 0 20px rgba(239, 68, 68, 0.3); transform: scale(1); }
      to { box-shadow: 0 0 45px rgba(239, 68, 68, 0.7); transform: scale(1.02); }
    }
    .fall-title {
      font-size: 1.12rem;
      font-weight: 800;
      color: #f87171;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .fall-desc {
      font-size: 0.82rem;
      color: #fecaca;
      line-height: 1.4;
    }
    .fall-meta {
      font-size: 0.75rem;
      font-weight: 700;
      color: #ffffff;
      background: rgba(0,0,0,0.3);
      padding: 6px 14px;
      border-radius: 20px;
    }
    .btn-reset {
      background: #22c55e;
      color: #ffffff;
      border: none;
      padding: 10px 22px;
      border-radius: 20px;
      font-size: 0.82rem;
      font-weight: 800;
      letter-spacing: 0.02em;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
      transition: transform 0.15s ease, background 0.15s ease;
    }
    .btn-reset:active {
      transform: scale(0.95);
      background: #16a34a;
    }

    /* Live Telemetry Info Strip */
    .telemetry-strip {
      width: 100%;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 20px;
      padding: 10px 14px;
      display: flex;
      justify-content: space-around;
      font-size: 0.73rem;
      color: var(--text-muted);
    }
    .telemetry-strip span b {
      color: #f8fafc;
    }

    .footer-note {
      font-size: 0.72rem;
      color: #64748b;
    }
  </style>
</head>
<body>

<div class="card">
  <div class="header">
    <h1>ESP32 D2 CONTROLLER</h1>
    <p>Zero-Lag Switch & Patient Fall Watch</p>
  </div>

  <!-- ONLINE / OFFLINE BADGE -->
  <div class="status-badge offline" id="badgeBox">
    <div class="status-dot"></div>
    <span id="badgeText">ESP32: OFFLINE</span>
  </div>

  <!-- CRITICAL FALL EMERGENCY WARNING (Auto-pops on fall) -->
  <div class="fall-banner" id="fallBanner">
    <div class="fall-title">🚨 CRITICAL FALL ALERT!</div>
    <div class="fall-desc" id="fallDesc">Patient Fall Detected by Accelerometer!</div>
    <div class="fall-meta" id="fallMeta">Impact: -- | Posture: --</div>
    <button class="btn-reset" onclick="dismissAlarm()">✅ DISMISS ALARM / I AM OK</button>
  </div>

  <!-- ULTRA SMOOTH SLIDE SWITCH -->
  <label class="switch-wrap">
    <input type="checkbox" id="d2Switch" onchange="userToggled(this.checked)">
    <div class="slider-track">
      <div class="slider-glow"></div>
    </div>
    <div class="slider-knob"></div>
  </label>

  <div class="status-text" id="statusLabel">
    PIN D2 is OFF 🌑
  </div>

  <!-- LIVE TELEMETRY SENSOR STRIP -->
  <div class="telemetry-strip" id="telemStrip">
    <span>Motion: <b id="tMotion">1.00G</b></span>
    <span>Posture: <b id="tPosture">UPRIGHT</b></span>
    <span>Tilt: <b id="tTilt">0°</b></span>
  </div>

  <div class="footer-note" id="subStatus">
    Checking connection...
  </div>
</div>

<script>
  const toggle = document.getElementById('d2Switch');
  const label = document.getElementById('statusLabel');
  const badgeBox = document.getElementById('badgeBox');
  const badgeText = document.getElementById('badgeText');
  const subStatus = document.getElementById('subStatus');
  const fallBanner = document.getElementById('fallBanner');
  const fallDesc = document.getElementById('fallDesc');
  const fallMeta = document.getElementById('fallMeta');
  const tMotion = document.getElementById('tMotion');
  const tPosture = document.getElementById('tPosture');
  const tTilt = document.getElementById('tTilt');

  let userTargetState = null;
  let lastActionTime = 0;
  let isAlertPlaying = false;
  let sirenAudio = null;
  let sirenTimer = null;

  // Web Audio Synthesized Emergency Siren
  function startSiren() {
    if (isAlertPlaying) return;
    isAlertPlaying = true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      sirenAudio = new AudioCtx();
      const osc = sirenAudio.createOscillator();
      const gain = sirenAudio.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, sirenAudio.currentTime);
      gain.gain.setValueAtTime(0.12, sirenAudio.currentTime);
      osc.connect(gain);
      gain.connect(sirenAudio.destination);
      osc.start();

      let high = true;
      sirenTimer = setInterval(() => {
        if (!sirenAudio) return;
        osc.frequency.setValueAtTime(high ? 1150 : 750, sirenAudio.currentTime);
        high = !high;
      }, 250);
    } catch(e){}

    if (navigator.vibrate) {
      try { navigator.vibrate([300, 150, 300, 150, 500]); } catch(e){}
    }
  }

  function stopSiren() {
    isAlertPlaying = false;
    if (sirenTimer) { clearInterval(sirenTimer); sirenTimer = null; }
    if (sirenAudio) {
      try { sirenAudio.close(); } catch(e){}
      sirenAudio = null;
    }
  }

  // Dismiss Alarm Action
  function dismissAlarm() {
    stopSiren();
    fallBanner.classList.remove('active');
    fetch('/api/reset-alarm', { method: 'POST' }).catch(console.error);
  }

  // Instant zero-lag UI response when user touches switch
  function userToggled(checked) {
    userTargetState = checked;
    lastActionTime = Date.now();

    // Instant smooth UI update (0ms lag!)
    updateUI(checked);

    // Subtle haptic click on mobile
    if (navigator.vibrate) {
      try { navigator.vibrate(25); } catch(e){}
    }

    // Send to Render server immediately
    fetch('/api/d2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: checked })
    }).then(r => r.json()).then(data => {
      if (data && typeof data.d2 === 'boolean' && userTargetState === data.d2) {
        setTimeout(() => {
          if (userTargetState === data.d2) userTargetState = null;
        }, 500);
      }
    }).catch(err => console.error(err));
  }

  function updateUI(isOn) {
    toggle.checked = isOn;
    if (isOn) {
      label.innerText = 'PIN D2 is ON ⚡';
      label.classList.add('on');
    } else {
      label.innerText = 'PIN D2 is OFF 🌑';
      label.classList.remove('on');
    }
  }

  // Smooth polling every 350ms with Anti-Jitter Shield & Fall Detection
  async function syncState() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (!data) return;

      // 1. Fall & Emergency Alert Handling
      if (data.fall || data.sos) {
        fallBanner.classList.add('active');
        if (data.sos) {
          fallDesc.innerText = 'SOS Button Pressed on Watch!';
        } else {
          fallDesc.innerText = 'Patient Fall Detected by Accelerometer!';
        }
        if (data.fall_details) {
          fallMeta.innerText = 'Impact: ' + Number(data.fall_details.g_force).toFixed(2) + 'G | Time: ' + data.fall_details.time;
        }
        startSiren();
      } else {
        if (!isAlertPlaying) {
          fallBanner.classList.remove('active');
        }
      }

      // 2. Live Telemetry
      if (data.telemetry) {
        tMotion.innerText = Number(data.telemetry.g_force).toFixed(2) + 'G';
        tPosture.innerText = data.telemetry.posture || 'UPRIGHT';
        const tilt = Math.max(Math.abs(data.telemetry.pitch || 0), Math.abs(data.telemetry.roll || 0));
        tTilt.innerText = Math.round(tilt) + '°';
      }

      // 3. Switch State Reconciliation (with Anti-Jitter Shield)
      const timeSinceAction = Date.now() - lastActionTime;
      const isUnderShield = userTargetState !== null && timeSinceAction < 3000;

      if (isUnderShield) {
        // Reject stale state that conflicts with user's toggle
        if (data.d2 === userTargetState) {
          userTargetState = null; // Server caught up!
          if (toggle.checked !== data.d2) updateUI(data.d2);
        }
      } else {
        // Normal background sync
        if (toggle.checked !== data.d2) {
          updateUI(data.d2);
        }
      }

      // 4. Live Online / Offline Badge
      if (data.online) {
        badgeBox.className = 'status-badge online';
        badgeText.innerText = 'ESP32: ONLINE';
        subStatus.innerText = 'Zero-lag hardware link & fall monitor active';
      } else {
        badgeBox.className = 'status-badge offline';
        badgeText.innerText = 'ESP32: OFFLINE';
        subStatus.innerText = data.last_seen 
          ? 'Device disconnected (Last seen ' + data.last_seen + 's ago)' 
          : 'Waiting for ESP32 connection...';
      }

    } catch(e){}
  }

  setInterval(syncState, 350);
  syncState();
</script>

</body>
</html>`);
});

app.listen(port, () => {
  console.log(`Zero-Lag D2 Switch Server running on port ${port}`);
});
