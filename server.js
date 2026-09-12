const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// In-memory real-time patient state
let patientState = {
  fall: false,
  sos: false,
  g_force: 1.02,
  pitch: 12.0,
  roll: 4.0,
  posture: "UPRIGHT",
  activity: "NORMAL",
  battery: 94,
  wifi_rssi: -54,
  status: "Patient Safe & Normal",
  buzzer_command: false,
  last_sync: new Date().toLocaleTimeString()
};

let incidentLog = [
  { event: "System initialized and monitoring started", time: new Date().toLocaleTimeString() }
];

// ---------------- REST API FOR ESP32 & DASHBOARD ----------------

// 1. Get live patient state
app.get('/api/status', (req, res) => {
  res.json({ state: patientState, logs: incidentLog.slice(0, 10) });
});

// 2. ESP32 sends telemetry
app.post('/api/telemetry', (req, res) => {
  const data = req.body;
  if (data.g_force !== undefined) patientState.g_force = parseFloat(data.g_force);
  if (data.pitch !== undefined) patientState.pitch = parseFloat(data.pitch);
  if (data.roll !== undefined) patientState.roll = parseFloat(data.roll);
  if (data.posture) patientState.posture = data.posture;
  if (data.activity) patientState.activity = data.activity;
  if (data.battery !== undefined) patientState.battery = parseInt(data.battery);
  if (data.wifi_rssi !== undefined) patientState.wifi_rssi = parseInt(data.wifi_rssi);
  patientState.last_sync = new Date().toLocaleTimeString();

  // If fall detected by ESP32
  if (data.fall === true && !patientState.fall) {
    patientState.fall = true;
    patientState.status = "CRITICAL FALL DETECTED!";
    incidentLog.unshift({ event: `🚨 Critical Fall (${data.g_force || 3.0}G)`, time: new Date().toLocaleTimeString() });
  }

  // If SOS pressed by ESP32
  if (data.sos === true && !patientState.sos) {
    patientState.sos = true;
    patientState.status = "SOS BUTTON PRESSED!";
    incidentLog.unshift({ event: "🚨 SOS Emergency Button Pressed", time: new Date().toLocaleTimeString() });
  }

  res.json({ success: true, buzzer_command: patientState.buzzer_command });
});

// 3. Caregiver triggers Watch Buzzer ("Find Patient")
app.post('/api/buzzer', (req, res) => {
  patientState.buzzer_command = true;
  incidentLog.unshift({ event: "🔊 Caregiver triggered watch buzzer", time: new Date().toLocaleTimeString() });
  res.json({ success: true });
});

// 4. ESP32 acknowledges buzzer beeped
app.post('/api/buzzer-ack', (req, res) => {
  patientState.buzzer_command = false;
  res.json({ success: true });
});

// 5. Caregiver dismisses emergency
app.post('/api/dismiss', (req, res) => {
  patientState.fall = false;
  patientState.sos = false;
  patientState.buzzer_command = false;
  patientState.status = "Patient Safe (Acknowledged by Caregiver)";
  incidentLog.unshift({ event: "✓ Emergency dismissed by caregiver", time: new Date().toLocaleTimeString() });
  res.json({ success: true });
});

// 6. Simulation trigger for demo
app.post('/api/simulate', (req, res) => {
  const { type } = req.body;
  if (type === 'fall') {
    patientState.fall = true;
    patientState.sos = false;
    patientState.g_force = 3.25;
    patientState.pitch = 84;
    patientState.posture = "LYING DOWN (FLAT)";
    patientState.activity = "UNRESPONSIVE";
    patientState.status = "CRITICAL FALL DETECTED (Simulated 3.2G)";
    incidentLog.unshift({ event: "🚨 Simulated Fall Impact (3.25G)", time: new Date().toLocaleTimeString() });
  } else if (type === 'sos') {
    patientState.sos = true;
    patientState.fall = false;
    patientState.status = "SOS BUTTON PRESSED (Simulated)";
    incidentLog.unshift({ event: "🚨 Simulated SOS Button Press", time: new Date().toLocaleTimeString() });
  }
  res.json({ success: true });
});

// ---------------- BEAUTIFUL BUILT-IN WEB DASHBOARD ----------------
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BLIND-CARE: Patient Full Monitoring System</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #080c15;
      --card-bg: #121929;
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #3b82f6;
      --safe: #10b981;
      --danger: #ef4444;
      --text-main: #f9fafb;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body { background: var(--bg-dark); color: var(--text-main); min-height: 100vh; display: flex; justify-content: center; padding: 16px; }
    .app-shell { width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 14px; padding-bottom: 24px; }
    .top-header { display: flex; justify-content: space-between; align-items: center; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 20px; padding: 14px 18px; }
    .brand-title h1 { font-size: 1.1rem; font-weight: 800; }
    .brand-title p { font-size: 0.72rem; color: var(--text-muted); }
    .live-tag { display: flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 20px; font-size: 0.72rem; font-weight: 700; color: var(--safe); }
    .live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--safe); animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }
    .patient-card { background: linear-gradient(135deg, rgba(30,41,59,0.7), rgba(18,25,41,0.9)); border: 1px solid var(--card-border); border-radius: 20px; padding: 16px; display: flex; gap: 14px; align-items: center; }
    .patient-avatar { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #38bdf8); display: flex; justify-content: center; align-items: center; font-size: 1.6rem; flex-shrink: 0; }
    .patient-info { flex: 1; }
    .patient-name-row { display: flex; justify-content: space-between; align-items: center; }
    .patient-name { font-size: 1.1rem; font-weight: 800; }
    .blood-badge { background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid rgba(239,68,68,0.4); font-size: 0.7rem; font-weight: 800; padding: 2px 8px; border-radius: 12px; }
    .patient-meta { font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; display: flex; gap: 10px; }
    .hero-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 20px; padding: 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .hero-card.safe { border-color: rgba(16,185,129,0.4); background: linear-gradient(180deg, rgba(16,185,129,0.12), rgba(18,25,41,0.8)); }
    .hero-card.danger { border-color: rgba(239,68,68,0.8); background: linear-gradient(180deg, rgba(239,68,68,0.25), rgba(18,25,41,0.9)); animation: alert-glow 1s infinite alternate; }
    @keyframes alert-glow { from { box-shadow: 0 0 15px rgba(239,68,68,0.3); } to { box-shadow: 0 0 40px rgba(239,68,68,0.7); } }
    .hero-icon { font-size: 3rem; }
    .hero-title { font-size: 1.3rem; font-weight: 800; }
    .hero-sub { font-size: 0.8rem; color: var(--text-muted); }
    .grid-title { font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .telemetry-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .detail-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
    .detail-header { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted); }
    .detail-val { font-size: 1.3rem; font-weight: 800; color: #fff; }
    .detail-sub { font-size: 0.72rem; color: var(--text-muted); }
    .meter-wrap { width: 100%; height: 8px; background: #1e293b; border-radius: 6px; overflow: hidden; margin-top: 4px; }
    .meter-fill { height: 100%; width: 25%; background: linear-gradient(90deg, #10b981, #f59e0b, #ef4444); transition: width 0.3s ease; }
    .actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .btn-action { padding: 12px; border-radius: 14px; border: none; font-size: 0.85rem; font-weight: 700; display: flex; justify-content: center; align-items: center; gap: 6px; cursor: pointer; text-decoration: none; }
    .btn-ambulance { background: linear-gradient(135deg, #b91c1c, #ef4444); color: #fff; }
    .btn-family { background: linear-gradient(135deg, #0369a1, #38bdf8); color: #fff; }
    .btn-buzzer { background: #1e293b; color: #cbd5e1; border: 1px solid var(--card-border); grid-column: span 2; }
    .log-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 18px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
    .log-item { display: flex; justify-content: space-between; padding: 6px 10px; background: rgba(255,255,255,0.03); border-radius: 10px; font-size: 0.75rem; }
    .test-box { background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .btn-test { padding: 8px; border-radius: 8px; border: none; font-size: 0.72rem; font-weight: 700; cursor: pointer; }

    /* FULL-SCREEN EMERGENCY CALL */
    .call-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(10,3,3,0.97); backdrop-filter: blur(20px); z-index: 99999; flex-direction: column; justify-content: space-between; align-items: center; padding: 40px 20px; animation: screen-flash 0.8s infinite alternate; }
    .call-overlay.active { display: flex; }
    @keyframes screen-flash { from { box-shadow: inset 0 0 40px rgba(239,68,68,0.4); } to { box-shadow: inset 0 0 100px rgba(239,68,68,0.9); } }
    .call-pulse { width: 100px; height: 100px; border-radius: 50%; background: rgba(239,68,68,0.2); border: 3px solid var(--danger); display: flex; justify-content: center; align-items: center; font-size: 3rem; animation: pulse 1s infinite; }
    .btn-dismiss { width: 100%; max-width: 340px; padding: 16px; border-radius: 16px; border: none; background: #1e293b; color: white; font-weight: 800; font-size: 1rem; cursor: pointer; }
  </style>
</head>
<body>

<div class="app-shell">
  <div class="top-header">
    <div class="brand-title">
      <h1>BLIND-CARE PATIENT MONITOR</h1>
      <p>Render Cloud Hosted • 24/7 Patient Shield</p>
    </div>
    <div class="live-tag">
      <div class="live-dot"></div> ONLINE
    </div>
  </div>

  <div class="patient-card">
    <div class="patient-avatar">👤</div>
    <div class="patient-info">
      <div class="patient-name-row">
        <h2 class="patient-name">Patient #01 (Blind Care)</h2>
        <span class="blood-badge">O+ VE</span>
      </div>
      <div class="patient-meta">
        <span>Age: 68 yrs</span> • <span>Room: Home</span> • <span id="syncText">Syncing...</span>
      </div>
    </div>
  </div>

  <div class="hero-card safe" id="heroCard">
    <div class="hero-icon" id="heroIcon">🛡️</div>
    <h2 class="hero-title" id="heroTitle">PATIENT IS SAFE & UPRIGHT</h2>
    <p class="hero-sub" id="heroSub">MPU-6050 accelerometer is actively monitoring motion, posture, and sudden shock.</p>
  </div>

  <div class="grid-title">Patient Vitals & Motion Telemetry</div>
  <div class="telemetry-grid">
    <div class="detail-card">
      <div class="detail-header"><span>Fall Status</span><span>💥</span></div>
      <div class="detail-val" id="valFall">SAFE (NO)</div>
      <div class="detail-sub">0 impacts detected</div>
    </div>
    <div class="detail-card">
      <div class="detail-header"><span>G-Force Impact</span><span>📈</span></div>
      <div class="detail-val" id="valG">1.02 G</div>
      <div class="detail-sub">Earth Gravity: 1G</div>
    </div>
    <div class="detail-card">
      <div class="detail-header"><span>Posture</span><span>📐</span></div>
      <div class="detail-val" id="valPosture">UPRIGHT</div>
      <div class="detail-sub" id="valTilt">Tilt Angle: 12°</div>
    </div>
    <div class="detail-card">
      <div class="detail-header"><span>Activity</span><span>🏃</span></div>
      <div class="detail-val" id="valActivity">STATIONARY</div>
      <div class="detail-sub">Resting / Gentle Motion</div>
    </div>
    <div class="detail-card">
      <div class="detail-header"><span>Watch Battery</span><span>🔋</span></div>
      <div class="detail-val" id="valBattery" style="color: var(--safe);">94%</div>
      <div class="detail-sub">Li-ion Normal</div>
    </div>
    <div class="detail-card">
      <div class="detail-header"><span>Wi-Fi Signal</span><span>📶</span></div>
      <div class="detail-val" id="valWifi">-54 dBm</div>
      <div class="detail-sub">Home Network</div>
    </div>
  </div>

  <div class="detail-card">
    <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 700;">
      <span>Live G-Force Meter:</span>
      <span id="meterText">1.02 G</span>
    </div>
    <div class="meter-wrap">
      <div class="meter-fill" id="meterFill" style="width: 25%;"></div>
    </div>
  </div>

  <div class="grid-title">Emergency Actions</div>
  <div class="actions-grid">
    <a href="tel:108" class="btn-action btn-ambulance">🚑 Call Ambulance (108)</a>
    <a href="tel:+919876543210" class="btn-action btn-family">📞 Call Family</a>
    <button class="btn-action btn-buzzer" onclick="ringBuzzer()">🔊 Ring Watch Buzzer ("Find Patient")</button>
  </div>

  <div class="log-card">
    <span style="font-size: 0.8rem; font-weight: 700;">Audit Incident Log</span>
    <div id="logBox" style="display: flex; flex-direction: column; gap: 6px; max-height: 120px; overflow-y: auto;"></div>
  </div>

  <div class="test-box">
    <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">Exhibition / Judge Demo:</span>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
      <button class="btn-test" style="background: rgba(239,68,68,0.2); color: var(--danger);" onclick="simulate('fall')">Simulate Fall (3.2G)</button>
      <button class="btn-test" style="background: rgba(245,158,11,0.2); color: #f59e0b;" onclick="simulate('sos')">Simulate SOS</button>
    </div>
  </div>
</div>

<!-- FULL SCREEN EMERGENCY CALL OVERLAY -->
<div class="call-overlay" id="overlay">
  <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center;">
    <div class="call-pulse">🚨</div>
    <h1 style="color: #ef4444; font-size: 1.8rem; font-weight: 900;" id="overTitle">EMERGENCY: FALL DETECTED!</h1>
    <p style="color: #fca5a5; font-size: 1rem;" id="overDesc">Patient #01 may be injured on the floor!</p>
  </div>
  <div style="width: 100%; max-width: 340px; display: flex; flex-direction: column; gap: 10px;">
    <a href="tel:108" class="btn-action btn-ambulance" style="padding: 16px; font-size: 1.05rem;">🚑 CALL 108 AMBULANCE</a>
    <button class="btn-dismiss" onclick="dismiss()">✓ Dismiss Alarm (Patient Safe)</button>
  </div>
</div>

<audio id="siren" loop preload="auto">
  <source src="https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg" type="audio/ogg">
</audio>

<script>
  let isRinging = false;

  async function poll() {
    try {
      const res = await fetch('/api/status');
      const { state, logs } = await res.json();
      if (!state) return;

      document.getElementById('syncText').innerText = 'Synced: ' + state.last_sync;
      document.getElementById('valG').innerText = state.g_force.toFixed(2) + ' G';
      document.getElementById('meterText').innerText = state.g_force.toFixed(2) + ' G';
      const pct = Math.min(100, Math.max(0, (state.g_force / 4.0) * 100));
      document.getElementById('meterFill').style.width = pct + '%';

      document.getElementById('valPosture').innerText = state.posture;
      document.getElementById('valTilt').innerText = 'Tilt: ' + Math.abs(Math.round(state.pitch)) + '°';
      document.getElementById('valActivity').innerText = state.activity;
      document.getElementById('valBattery').innerText = state.battery + '%';
      document.getElementById('valWifi').innerText = state.wifi_rssi + ' dBm';

      // Emergency Call Trigger
      const hero = document.getElementById('heroCard');
      const overlay = document.getElementById('overlay');
      const siren = document.getElementById('siren');

      if (state.fall || state.sos) {
        if (!isRinging) {
          isRinging = true;
          overlay.classList.add('active');
          document.getElementById('overTitle').innerText = state.sos ? '🚨 SOS EMERGENCY PRESSED!' : '🚨 CRITICAL: FALL DETECTED!';
          try { siren.play(); } catch(e){}
        }
        hero.className = 'hero-card danger';
        document.getElementById('heroIcon').innerText = '🚨';
        document.getElementById('heroTitle').innerText = state.sos ? 'EMERGENCY SOS ACTIVE!' : 'PATIENT HAS FALLEN!';
        document.getElementById('valFall').innerText = 'CRITICAL FALL!';
        document.getElementById('valFall').style.color = '#ef4444';
      } else {
        if (isRinging) {
          isRinging = false;
          overlay.classList.remove('active');
          siren.pause();
          siren.currentTime = 0;
        }
        hero.className = 'hero-card safe';
        document.getElementById('heroIcon').innerText = '🛡️';
        document.getElementById('heroTitle').innerText = 'PATIENT IS SAFE & UPRIGHT';
        document.getElementById('valFall').innerText = 'SAFE (NO)';
        document.getElementById('valFall').style.color = '#ffffff';
      }

      // Logs
      if (logs) {
        const box = document.getElementById('logBox');
        box.innerHTML = logs.map(l => '<div class="log-item"><span>' + l.event + '</span><span style="color:#94a3b8;">' + l.time + '</span></div>').join('');
      }
    } catch(e){}
  }

  async function dismiss() {
    await fetch('/api/dismiss', { method: 'POST' });
    poll();
  }

  async function ringBuzzer() {
    await fetch('/api/buzzer', { method: 'POST' });
    alert('🔊 Watch Buzzer command sent via Render cloud!');
    poll();
  }

  async function simulate(type) {
    await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
    poll();
  }

  setInterval(poll, 400);
  poll();
</script>
</body>
</html>`);
});

app.listen(port, () => {
  console.log(`Blind-Care Server running on port ${port}`);
});
