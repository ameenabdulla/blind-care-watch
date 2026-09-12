const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// In-memory state
let d2State = false;
let lastEspHeartbeat = 0;

// Fast API for ESP32 and Web App
app.get('/api/d2', (req, res) => {
  if (req.query.device === 'esp32') {
    lastEspHeartbeat = Date.now();
  }

  const isOnline = (Date.now() - lastEspHeartbeat) < 4000;

  res.json({
    d2: d2State,
    online: isOnline,
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
    <p>Zero-Lag Worldwide Switch</p>
  </div>

  <!-- ONLINE / OFFLINE BADGE -->
  <div class="status-badge offline" id="badgeBox">
    <div class="status-dot"></div>
    <span id="badgeText">ESP32: OFFLINE</span>
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

  let userTargetState = null;
  let lastActionTime = 0;

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

  // Smooth polling every 350ms with Anti-Jitter Shield
  async function syncState() {
    try {
      const res = await fetch('/api/d2');
      const data = await res.json();
      if (!data) return;

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

      // Live Online / Offline Badge
      if (data.online) {
        badgeBox.className = 'status-badge online';
        badgeText.innerText = 'ESP32: ONLINE';
        subStatus.innerText = 'Zero-lag hardware link active';
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
