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
    }
    .switch-wrap input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #1e293b;
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-radius: 50px;
      transition: background-color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 58px;
      width: 58px;
      left: 6px;
      bottom: 6px;
      background: #ffffff;
      border-radius: 50%;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
      will-change: transform;
      transform: translate3d(0, 0, 0);
    }
    input:checked + .slider {
      background: linear-gradient(135deg, #0284c7, #38bdf8);
      border-color: var(--neon-blue);
      box-shadow: 0 0 35px rgba(56, 189, 248, 0.5);
    }
    input:checked + .slider:before {
      transform: translate3d(66px, 0, 0);
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
    <span class="slider"></span>
  </label>

  <div class="status-text" id="statusLabel">
    PIN D2 is OFF 🌑
  </div>

  <div class="footer-note" id="subStatus">
    Checking device connection...
  </div>
</div>

<script>
  const toggle = document.getElementById('d2Switch');
  const label = document.getElementById('statusLabel');
  const badgeBox = document.getElementById('badgeBox');
  const badgeText = document.getElementById('badgeText');
  const subStatus = document.getElementById('subStatus');

  let isLockedByUser = false;
  let unlockTimer = null;

  // Instant zero-lag UI response when user touches switch
  function userToggled(checked) {
    // 1. Lock UI so background polling never stutters or resets the switch!
    isLockedByUser = true;
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => { isLockedByUser = false; }, 1500);

    // 2. Instant smooth UI update (0 milliseconds!)
    updateText(checked);

    // 3. Send to Render server immediately
    fetch('/api/d2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: checked })
    }).catch(err => console.error(err));
  }

  function updateText(isOn) {
    if (isOn) {
      label.innerText = 'PIN D2 is ON ⚡';
      label.classList.add('on');
    } else {
      label.innerText = 'PIN D2 is OFF 🌑';
      label.classList.remove('on');
    }
  }

  // Smooth polling every 350ms (only reconciles when user is not actively flipping)
  async function syncState() {
    try {
      const res = await fetch('/api/d2');
      const data = await res.json();
      if (!data) return;

      // Only update switch position from server if user is not currently touching it
      if (!isLockedByUser) {
        if (toggle.checked !== data.d2) {
          toggle.checked = data.d2;
          updateText(data.d2);
        }
      }

      // Live Online / Offline Badge
      if (data.online) {
        badgeBox.className = 'status-badge online';
        badgeText.innerText = 'ESP32: ONLINE';
        subStatus.innerText = 'Zero-lag cloud connection active';
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
