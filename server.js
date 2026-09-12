const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// In-memory D2 state
let d2State = false;

// API for ESP32 to get current D2 state
app.get('/api/d2', (req, res) => {
  res.json({ d2: d2State });
});

// API to toggle D2 state (from web slide switch)
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

// Single-page slide switch UI
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ESP32 D2 Controller</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card: #131b2e;
      --neon-blue: #38bdf8;
      --text: #f3f4f6;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
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
      border-radius: 32px;
      padding: 48px 36px;
      width: 100%;
      max-width: 380px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 32px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }
    .header h1 {
      font-size: 1.4rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .header p {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 4px;
    }

    /* THE SLIDE SWITCH */
    .switch-wrap {
      position: relative;
      width: 130px;
      height: 70px;
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
      border-radius: 40px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 54px;
      width: 54px;
      left: 6px;
      bottom: 6px;
      background: #ffffff;
      border-radius: 50%;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 15px rgba(0,0,0,0.4);
    }
    input:checked + .slider {
      background: linear-gradient(135deg, #0284c7, #38bdf8);
      border-color: var(--neon-blue);
      box-shadow: 0 0 35px rgba(56, 189, 248, 0.6);
    }
    input:checked + .slider:before {
      transform: translateX(60px);
      background: #ffffff;
    }

    /* Status Text */
    .status-text {
      font-size: 1.25rem;
      font-weight: 800;
      transition: color 0.3s ease;
      color: #94a3b8;
    }
    .status-text.on {
      color: var(--neon-blue);
      text-shadow: 0 0 20px rgba(56, 189, 248, 0.6);
    }

    .badge {
      font-size: 0.75rem;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dot {
      width: 8px; height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 10px #10b981;
    }
  </style>
</head>
<body>

<div class="card">
  <div class="header">
    <h1>ESP32 D2 CONTROLLER</h1>
    <p>Worldwide Cloud Switch (Render)</p>
  </div>

  <!-- SLIDE SWITCH -->
  <label class="switch-wrap">
    <input type="checkbox" id="d2Switch" onchange="toggleD2(this.checked)">
    <span class="slider"></span>
  </label>

  <div class="status-text" id="statusLabel">
    PIN D2 is OFF 🌑
  </div>

  <div class="badge">
    <div class="dot"></div>
    <span>Live Cloud Connected (Render)</span>
  </div>
</div>

<script>
  const toggle = document.getElementById('d2Switch');
  const label = document.getElementById('statusLabel');

  async function toggleD2(checked) {
    updateUI(checked);
    try {
      await fetch('/api/d2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: checked })
      });
    } catch(e) {
      console.error(e);
    }
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

  // Poll state every 400ms for live sync
  async function syncState() {
    try {
      const res = await fetch('/api/d2');
      const data = await res.json();
      if (data && data.d2 !== toggle.checked) {
        updateUI(data.d2);
      }
    } catch(e){}
  }

  setInterval(syncState, 400);
  syncState();
</script>

</body>
</html>`);
});

app.listen(port, () => {
  console.log(`D2 Switch Server running on port ${port}`);
});
