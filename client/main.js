import Vapi from '@vapi-ai/web';

let vapi = null;
let currentCallId = null;
let currentCity = null;
let currentArea = null;
let currentPersona = null;
let currentUser = null;
let selectedAgentId = null;
let dateFilter = 'month';

function formatDate(dateStr) {
  return new Date(dateStr + 'Z').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

// ─── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const stored = localStorage.getItem('fp_user');
  if (stored) {
    currentUser = JSON.parse(stored);
    showDashboard();
  } else {
    showLogin();
  }
});

// ─── AUTH ─────────────────────────────────────────────────
async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const errorEl = document.getElementById('loginError');
  if (!email || !password) { errorEl.textContent = 'Please enter email and password'; return; }

  const btn = document.getElementById('btnLogin');
  btn.disabled = true;
  btn.textContent = 'Signing in...';
  errorEl.textContent = '';

  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Login failed';
      btn.disabled = false;
      btn.textContent = 'Sign In';
      return;
    }
    currentUser = data;
    localStorage.setItem('fp_user', JSON.stringify(data));
    showDashboard();
  } catch (err) {
    errorEl.textContent = 'Something went wrong. Try again.';
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

function logout() {
  localStorage.removeItem('fp_user');
  currentUser = null;
  showLogin();
}

// ─── VIEWS ────────────────────────────────────────────────
function showLogin() {
  document.getElementById('loginView').style.display = 'flex';
  document.getElementById('dashboardView').style.display = 'none';
}

function showDashboard() {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('dashboardView').style.display = 'block';
  document.getElementById('userName').textContent = currentUser.name;
  document.getElementById('userRole').textContent = currentUser.role === 'supervisor' ? 'Supervisor' : 'Agent';

  if (currentUser.role === 'supervisor') {
    document.getElementById('supervisorSection').style.display = 'block';
    loadLeaderboard();
    loadAgents();
  }

  loadSummary(currentUser.id);
  loadCalls();
}

// ─── DATE FILTER ──────────────────────────────────────────
function getDateRange(filter) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let dateFrom, dateTo;

  if (filter === 'today') {
    dateFrom = today.toISOString();
    dateTo = new Date(today.getTime() + 86400000).toISOString();
  } else if (filter === 'yesterday') {
    dateFrom = new Date(today.getTime() - 86400000).toISOString();
    dateTo = today.toISOString();
  } else if (filter === '7days') {
    dateFrom = new Date(today.getTime() - 7 * 86400000).toISOString();
    dateTo = new Date(today.getTime() + 86400000).toISOString();
  } else if (filter === 'month') {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    dateTo = new Date(today.getTime() + 86400000).toISOString();
  } else if (filter === 'lastmonth') {
    dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    dateTo = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  } else if (filter === 'custom') {
    dateFrom = document.getElementById('customFrom')?.value ? new Date(document.getElementById('customFrom').value).toISOString() : null;
    dateTo = document.getElementById('customTo')?.value ? new Date(document.getElementById('customTo').value + 'T23:59:59').toISOString() : null;
  }
  return { dateFrom, dateTo };
}

function setDateFilter(filter) {
  dateFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('filter-' + filter)?.classList.add('active');
  document.getElementById('customDateRow').style.display = filter === 'custom' ? 'flex' : 'none';
  loadCalls();
  if (currentUser.role === 'supervisor') loadLeaderboard();
}

function applyCustomDate() {
  loadCalls();
  if (currentUser.role === 'supervisor') loadLeaderboard();
}

// ─── CALL ─────────────────────────────────────────────────
async function startCall() {
  const btn = document.getElementById('btnStart');
  btn.disabled = true;
  btn.textContent = 'Connecting...';

  try {
    const res = await fetch('/start-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentName: currentUser.name, agentId: currentUser.id })
    });
    const config = await res.json();
    currentCity = config.city;
    currentArea = config.area;
    currentPersona = config.persona;

    vapi = new Vapi(config.publicKey);

    vapi.on('call-start', async (call) => {
      currentCallId = call?.id || call?.call?.id || 'call-' + Date.now();
      console.log('call-start, id:', currentCallId);
      await fetch('/register-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: currentCallId,
          agentName: currentUser.name,
          agentId: currentUser.id,
          city: currentCity,
          area: currentArea,
          persona: currentPersona
        })
      });
      showCallActive();
    });

    vapi.on('call-end', () => {
      showCallEnded();
      setTimeout(() => { loadCalls(); loadSummary(currentUser.id); }, 10000);
    });

    vapi.on('error', (e) => {
      console.error('Vapi error:', e);
      alert('Call error: ' + (e?.message || 'Unknown error'));
      resetCallUI();
    });

    await vapi.start(config.assistantId, { variableValues: config.variableValues });
  } catch (err) {
    alert('Failed to start call: ' + err.message);
    resetCallUI();
  }
}

function endCall() { if (vapi) vapi.stop(); }

function showCallActive() {
  document.getElementById('btnStart').style.display = 'none';
  document.getElementById('btnEnd').style.display = 'inline-block';
  const status = document.getElementById('callStatus');
  status.className = 'call-status active';
  status.innerHTML = `<strong>🎯 ${currentPersona}</strong><br><span style="font-size:13px;color:#2e7d32">Call in progress. Handle the enquiry naturally.</span>`;
}

function showCallEnded() {
  document.getElementById('btnEnd').style.display = 'none';
  document.getElementById('btnStart').style.display = 'inline-block';
  document.getElementById('btnStart').disabled = false;
  document.getElementById('btnStart').textContent = 'Start Practice Call';
  const status = document.getElementById('callStatus');
  status.className = 'call-status ended';
  status.innerHTML = '<strong>Call ended.</strong> Your scorecard will appear below in about 30 seconds.';
  vapi = null;
}

function resetCallUI() {
  const btn = document.getElementById('btnStart');
  btn.disabled = false;
  btn.textContent = 'Start Practice Call';
  btn.style.display = 'inline-block';
  document.getElementById('btnEnd').style.display = 'none';
}

// ─── SUMMARY ──────────────────────────────────────────────
async function loadSummary(agentId) {
  const { dateFrom, dateTo } = getDateRange('month');
  const params = new URLSearchParams({ dateFrom, dateTo });
  const res = await fetch(`/summary/${agentId}?${params}`);
  const s = await res.json();

  if (!s.sessions) {
    document.getElementById('summaryCard').innerHTML = '<p style="color:#636e72;font-size:14px">No sessions yet this month.</p>';
    return;
  }

  const trendIcon = s.trend > 0 ? '↑' : s.trend < 0 ? '↓' : '→';
  const trendColor = s.trend > 0 ? '#2e7d32' : s.trend < 0 ? '#c62828' : '#636e72';
  const weakestLabel = {
    cctv_safety: 'CCTV & Safety', highscope: 'HighScope', objection_handling: 'Objection Handling',
    visit_booking: 'Visit Booking', nutrition: 'Nutrition', tone_empathy: 'Tone & Empathy'
  }[s.weakest];

  document.getElementById('summaryCard').innerHTML = `
    <div class="summary-grid">
      <div class="summary-stat">
        <div class="summary-number">${s.avgScore}</div>
        <div class="summary-label">Avg Score</div>
      </div>
      <div class="summary-stat">
        <div class="summary-number">${s.sessions}</div>
        <div class="summary-label">Sessions</div>
      </div>
      <div class="summary-stat">
        <div class="summary-number">${s.bestScore}</div>
        <div class="summary-label">Best Score</div>
      </div>
      <div class="summary-stat">
        <div class="summary-number" style="color:${trendColor}">${trendIcon} ${Math.abs(s.trend)}</div>
        <div class="summary-label">Trend</div>
      </div>
      <div class="summary-stat">
        <div class="summary-number">🔥 ${s.streak}</div>
        <div class="summary-label">Day Streak</div>
      </div>
    </div>
    <div style="margin-top:16px;font-size:13px;color:#636e72">
      Weakest area: <strong style="color:#e17055">${weakestLabel}</strong> (avg ${s.paramAvgs[s.weakest]}/5)
    </div>
  `;
}

// ─── LEADERBOARD ──────────────────────────────────────────
async function loadLeaderboard() {
  const { dateFrom, dateTo } = getDateRange(dateFilter);
  const params = new URLSearchParams();
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);

  const res = await fetch('/leaderboard?' + params);
  const board = await res.json();
  const container = document.getElementById('leaderboardList');

  if (!board.length) {
    container.innerHTML = '<p style="color:#636e72;font-size:14px">No completed sessions yet.</p>';
    return;
  }

  container.innerHTML = board.map((agent, i) => `
    <div class="leaderboard-row" onclick="filterByAgent('${agent.agentId}', '${agent.agentName}')">
      <div class="rank">${i + 1}</div>
      <div style="flex:1">
        <strong>${agent.agentName}</strong>
        <div style="font-size:12px;color:#636e72">${agent.sessions} total · Last ${agent.last4Sessions}: avg ${agent.avgScore}% · Best: ${agent.bestScore}%</div>
      </div>
      <div class="avg-score" style="color:${agent.avgScore >= 65 ? '#2e7d32' : agent.avgScore >= 45 ? '#e65100' : '#c62828'}">${agent.avgScore}</div>
    </div>
  `).join('');
}

// ─── AGENTS ───────────────────────────────────────────────
async function loadAgents() {
  const res = await fetch('/agents');
  const agents = await res.json();
  const container = document.getElementById('agentsList');
  if (!agents.length) {
    container.innerHTML = '<p style="color:#636e72;font-size:14px">No agents yet.</p>';
    return;
  }
  container.innerHTML = agents.map(agent => `
    <div class="agent-chip" onclick="filterByAgent('${agent.id}', '${agent.name}')">${agent.name}</div>
  `).join('');
}

function filterByAgent(agentId, agentName) {
  selectedAgentId = agentId;
  document.getElementById('sessionsTitle').textContent = agentName + "'s Sessions";
  document.getElementById('clearAgentFilter').style.display = 'inline-block';
  loadCalls();
  loadSummary(agentId);
}

function clearAgentFilter() {
  selectedAgentId = null;
  document.getElementById('sessionsTitle').textContent = 'Practice Sessions';
  document.getElementById('clearAgentFilter').style.display = 'none';
  loadCalls();
  loadSummary(currentUser.id);
}

async function addAgent() {
  const name = document.getElementById('newAgentName').value.trim();
  const email = document.getElementById('newAgentEmail').value.trim();
  const password = document.getElementById('newAgentPassword').value.trim();
  if (!name || !email || !password) { alert('Please fill all fields'); return; }

  const res = await fetch('/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role: 'agent' })
  });
  if (res.ok) {
    document.getElementById('newAgentName').value = '';
    document.getElementById('newAgentEmail').value = '';
    document.getElementById('newAgentPassword').value = '';
    loadAgents();
    alert('Agent added successfully');
  } else {
    alert('Failed to add agent');
  }
}

// ─── CALLS LIST ───────────────────────────────────────────
async function loadCalls() {
  const { dateFrom, dateTo } = getDateRange(dateFilter);
  const params = new URLSearchParams({
    agentId: currentUser.id,
    role: currentUser.role
  });
  if (selectedAgentId) params.set('filterAgentId', selectedAgentId);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);

  const res = await fetch('/calls?' + params);
  const calls = await res.json();
  const container = document.getElementById('callsList');

  if (!calls.length) {
    container.innerHTML = '<div class="empty">No sessions found for this period.</div>';
    return;
  }

  container.innerHTML = calls.map(call => {
    const date = formatDate(call.started_at);
    const score = call.score;
    return `
      <div class="call-row" onclick="openCall('${call.id}')">
        <div>
          <strong>${call.agent_name}</strong>
          <div class="meta">${call.persona} · ${date}</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          ${score ? (score.short_call ? '<span class="score-badge pending">Too Short</span>' : '<span style="font-size:18px;font-weight:700">' + score.weighted_total + '%</span>') : ''}
          ${getGradeBadge(score?.grade)}
        </div>
      </div>
    `;
  }).join('');
}

// ─── SCORECARD ────────────────────────────────────────────
async function openCall(callId) {
  const [callRes, notesRes] = await Promise.all([
    fetch('/calls/' + callId),
    fetch('/notes/' + callId)
  ]);
  const call = await callRes.json();
  const notes = await notesRes.json();
  const score = call.score;

  let body = `
    <h2 style="margin-bottom:4px">${call.agent_name}</h2>
    <p style="color:#636e72;font-size:13px;margin-bottom:20px">${call.persona} · ${formatDate(call.started_at)}</p>
  `;

  if (score?.short_call) {
    body += `<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px 16px;margin-bottom:16px;color:#856404">⚠️ This call was too short to score (${score.word_count} words). Please complete a full practice call.</div>`;
  }

  if (score) {
    const totalColor = score.weighted_total >= 65 ? '#2e7d32' : score.weighted_total >= 45 ? '#e65100' : '#c62828';
    body += `
      <div class="total-score">
        <div class="number" style="color:${totalColor}">${score.weighted_total}%</div>
        <div style="font-size:14px;color:#636e72;margin-top:4px">${score.totalScore}/${score.totalApplicableWeight} · ${score.grade}</div>
      </div>
  <div class="score-grid">
  ${score.parameters ? score.parameters.map(p => {
    if (!p.applicable) {
      return '<div class="score-item na"><div class="label">' + p.label + ' (' + p.weight + ')</div><div class="value" style="color:#b2bec3">N/A</div></div>';
    }
    const pct = Math.round((p.score / p.weight) * 100);
    const color = pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low';
    const goodLooks = p.what_good_looks_like ? '<div style="font-size:11px;color:#2e7d32;margin-top:4px;font-style:italic">' + p.what_good_looks_like + '</div>' : '';
    return '<div class="score-item"><div class="label">' + p.label + ' (' + p.weight + ')</div><div class="value ' + color + '">' + pct + '%</div><div style="font-size:11px;color:#636e72;margin-top:4px">' + p.score + '/' + p.weight + '</div>' + goodLooks + '</div>';
  }).join('') : ''}
</div>
      <div class="coaching-box"><h4>Top Strength</h4><p style="font-size:14px">${score.top_strength}</p></div>
      <div class="gap-box"><h4>Biggest Gap</h4><p style="font-size:14px">${score.top_gap}</p></div>
      <div class="coaching-box" style="margin-top:12px"><h4>Coaching Note</h4><p style="font-size:14px">${score.coaching_note}</p></div>
    `;
  } else {
    body += '<p style="color:#636e72">Score not yet available.</p>';
  }

  if (call.transcript) {
    body += `<h4 style="margin-top:20px;margin-bottom:8px">Call Transcript</h4><div class="transcript-box">${call.transcript}</div>`;
  }

  // Supervisor notes
  if (currentUser.role === 'supervisor') {
    body += `
      <div style="margin-top:24px">
        <h4 style="margin-bottom:12px">Supervisor Notes</h4>
        ${notes.map(n => `
          <div class="note-item">
            <div style="font-size:12px;color:#636e72;margin-bottom:4px">${n.supervisor_name} · ${formatDate(n.created_at)}</div>
            <div style="font-size:14px">${n.note}</div>
          </div>
        `).join('')}
        <textarea id="noteInput" placeholder="Add a coaching note for this agent..." style="width:100%;padding:10px;border:1px solid #dfe6e9;border-radius:8px;font-size:14px;margin-top:12px;height:80px;resize:vertical"></textarea>
        <button onclick="saveNote('${callId}')" style="margin-top:8px;background:#e17055;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:14px;cursor:pointer">Save Note</button>
      </div>
    `;
  } else if (notes.length) {
    body += `
      <div style="margin-top:24px">
        <h4 style="margin-bottom:12px">Supervisor Notes</h4>
        ${notes.map(n => `
          <div class="note-item">
            <div style="font-size:12px;color:#636e72;margin-bottom:4px">${formatDate(n.created_at)}</div>
            <div style="font-size:14px">${n.note}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modal').className = 'modal open';
}

async function saveNote(callId) {
  const note = document.getElementById('noteInput').value.trim();
  if (!note) return;
  const res = await fetch('/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callId,
      supervisorId: currentUser.id,
      supervisorName: currentUser.name,
      note
    })
  });
  if (res.ok) {
    openCall(callId);
  }
}

function closeModal() {
  document.getElementById('modal').className = 'modal';
}

function getScoreColor(score) {
  if (score >= 4) return 'high';
  if (score >= 3) return 'mid';
  return 'low';
}

function getGradeBadge(grade) {
  if (!grade) return '<span class="score-badge pending">Pending</span>';
  const g = grade.toLowerCase();
  if (g.includes('excellent')) return '<span class="score-badge excellent">Excellent</span>';
  if (g.includes('good')) return '<span class="score-badge good">Good</span>';
  if (g.includes('needs')) return '<span class="score-badge needs">Needs Improvement</span>';
  return '<span class="score-badge poor">Poor</span>';
}

window.login = login;
window.logout = logout;
window.startCall = startCall;
window.endCall = endCall;
window.openCall = openCall;
window.closeModal = closeModal;
window.addAgent = addAgent;
window.filterByAgent = filterByAgent;
window.clearAgentFilter = clearAgentFilter;
window.setDateFilter = setDateFilter;
window.applyCustomDate = applyCustomDate;
window.saveNote = saveNote;

setInterval(() => { if (currentUser) loadCalls(); }, 15000);