require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { scoreCall } = require('./scoring');
const { supabase } = require('./db');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const cities = JSON.parse(fs.readFileSync('./cities.json', 'utf8'));

const personas = [
  { name: 'Shuchi Mehra', assistantId: process.env.VAPI_ASSISTANT_ID },
  { name: 'Ankita Sharma', assistantId: process.env.VAPI_ASSISTANT_ID_ANKITA || process.env.VAPI_ASSISTANT_ID },
  { name: 'Neha Gupta', assistantId: process.env.VAPI_ASSISTANT_ID_NEHA || process.env.VAPI_ASSISTANT_ID },
  { name: 'Rashmi Jain', assistantId: process.env.VAPI_ASSISTANT_ID_RASHMI || process.env.VAPI_ASSISTANT_ID },
  { name: 'Ritu Verma', assistantId: process.env.VAPI_ASSISTANT_ID_RITU || process.env.VAPI_ASSISTANT_ID }
];

function getRandomLocation() {
  const cityNames = Object.keys(cities);
  const city = cityNames[Math.floor(Math.random() * cityNames.length)];
  const areas = cities[city];
  const area = areas[Math.floor(Math.random() * areas.length)];
  return { city, area };
}

function getRandomPersona() {
  return personas[Math.floor(Math.random() * personas.length)];
}

// ─── AUTH ─────────────────────────────────────────────────

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = password === user.password_hash || await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── CALL ─────────────────────────────────────────────────

app.post('/start-call', async (req, res) => {
  try {
    const { agentName, agentId } = req.body;
    const { city, area } = getRandomLocation();
    const persona = getRandomPersona();
    res.json({
      assistantId: persona.assistantId,
      publicKey: process.env.VAPI_PUBLIC_KEY,
      city, area,
      agentName: agentName || 'Unknown Agent',
      persona: persona.name,
      variableValues: { city, area }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to prepare call' });
  }
});

app.post('/register-call', async (req, res) => {
  try {
    const { callId, agentName, agentId, city, area, persona } = req.body;
    await supabase.from('calls').insert({
      id: callId,
      agent_id: agentId || null,
      agent_name: agentName || 'Unknown Agent',
      persona: persona || 'Shuchi Mehra',
      city, area,
      status: 'in-progress',
      started_at: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register call' });
  }
});

// ─── WEBHOOK ──────────────────────────────────────────────

app.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    if (event.message?.type === 'end-of-call-report') {
      const callId = event.message.call?.id;
      const transcript = event.message.transcript;
      if (!callId || !transcript) return res.sendStatus(200);

      const { data: existing } = await supabase
        .from('calls')
        .select('*')
        .eq('status', 'in-progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      console.log(`Scoring call ${callId}...`);
      const score = await scoreCall(
        transcript,
        existing?.persona || 'Shuchi Mehra',
        existing?.city || 'Unknown',
        existing?.area || 'Unknown'
      );

      await supabase.from('calls').upsert({
        id: callId,
        agent_id: existing?.agent_id || null,
        agent_name: existing?.agent_name || 'Unknown Agent',
        persona: existing?.persona || 'Shuchi Mehra',
        city: existing?.city || 'Unknown',
        area: existing?.area || 'Unknown',
        status: 'completed',
        started_at: existing?.started_at || new Date().toISOString(),
        ended_at: new Date().toISOString(),
        transcript, score
      });

      if (existing && existing.id !== callId) {
        await supabase.from('calls').delete().eq('id', existing.id);
      }

      console.log(`Call ${callId} scored: ${score.weighted_total}/100`);
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.sendStatus(200);
  }
});

// ─── CALLS ────────────────────────────────────────────────

app.get('/calls', async (req, res) => {
  try {
    const { agentId, role, filterAgentId, dateFrom, dateTo } = req.query;
    let query = supabase.from('calls').select('*').order('started_at', { ascending: false });

    if (role === 'agent') query = query.eq('agent_id', agentId);
    else if (filterAgentId) query = query.eq('agent_id', filterAgentId);

    if (dateFrom) query = query.gte('started_at', dateFrom);
    if (dateTo) query = query.lte('started_at', dateTo);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load calls' });
  }
});

app.get('/calls/:callId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('calls').select('*').eq('id', req.params.callId).single();
    if (error) return res.status(404).json({ error: 'Call not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load call' });
  }
});

// ─── NOTES ────────────────────────────────────────────────

app.post('/notes', async (req, res) => {
  try {
    const { callId, supervisorId, supervisorName, note } = req.body;
    const { data, error } = await supabase.from('supervisor_notes').insert({
      call_id: callId,
      supervisor_id: supervisorId,
      supervisor_name: supervisorName,
      note
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save note' });
  }
});

app.get('/notes/:callId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('supervisor_notes').select('*')
      .eq('call_id', req.params.callId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load notes' });
  }
});

// ─── AGENTS ───────────────────────────────────────────────

app.get('/agents', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users').select('id, name, email, role, created_at').eq('role', 'agent');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load agents' });
  }
});

app.post('/agents', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase.from('users').insert({
      name, email, password_hash: passwordHash, role: role || 'agent'
    }).select().single();
    if (error) throw error;
    res.json({ success: true, user: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// ─── LEADERBOARD ──────────────────────────────────────────

app.get('/leaderboard', async (req, res) => {
    try {
      const { dateFrom, dateTo } = req.query;
  
      let query = supabase
        .from('calls')
        .select('agent_id, agent_name, score, started_at')
        .eq('status', 'completed')
        .not('score', 'is', null)
        .order('started_at', { ascending: false });
  
      if (dateFrom) query = query.gte('started_at', dateFrom);
      if (dateTo) query = query.lte('started_at', dateTo);
  
      const { data, error } = await query;
      if (error) throw error;
  
      // Group by agent
      const agentMap = {};
      data.forEach(call => {
        if (!call.agent_id || !call.score) return;
  
        // Only include new-format scores (have parameters field)
        if (!call.score.parameters) return;
  
        // Skip short calls
        if (call.score.short_call) return;
  
        // Skip null weighted_total
        if (call.score.weighted_total === null) return;
  
        if (!agentMap[call.agent_id]) {
          agentMap[call.agent_id] = {
            agentId: call.agent_id,
            agentName: call.agent_name,
            calls: []
          };
        }
        agentMap[call.agent_id].calls.push({
          score: call.score.weighted_total,
          date: call.started_at
        });
      });
  
      // Calculate avg of last 4 calls per agent
      const leaderboard = Object.values(agentMap).map(agent => {
        const last4 = agent.calls.slice(0, 4);
        const avgScore = Math.round(
          last4.reduce((sum, c) => sum + c.score, 0) / last4.length
        );
        const bestScore = Math.max(...agent.calls.map(c => c.score));
  
        return {
          agentId: agent.agentId,
          agentName: agent.agentName,
          avgScore,
          sessions: agent.calls.length,
          last4Sessions: last4.length,
          bestScore
        };
      }).sort((a, b) => b.avgScore - a.avgScore);
  
      res.json(leaderboard);
    } catch (err) {
      res.status(500).json({ error: 'Failed to load leaderboard' });
    }
  });

// ─── AGENT SUMMARY ────────────────────────────────────────

app.get('/summary/:agentId', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    let query = supabase.from('calls').select('*')
      .eq('agent_id', req.params.agentId)
      .eq('status', 'completed')
      .not('score', 'is', null)
      .order('started_at', { ascending: true });

    if (dateFrom) query = query.gte('started_at', dateFrom);
    if (dateTo) query = query.lte('started_at', dateTo);

    const { data, error } = await query;
    if (error) throw error;

    if (!data.length) return res.json({ sessions: 0 });

    const scoredCalls = data.filter(c => !c.score.short_call && c.score.weighted_total !== null);
    if (!scoredCalls.length) return res.json({ sessions: 0 });

    const scores = scoredCalls.map(c => c.score.weighted_total);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const trend = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0;

    const paramAvgs = {
      cctv_safety: 0, highscope: 0, objection_handling: 0,
      visit_booking: 0, nutrition: 0, tone_empathy: 0
    };
    scoredCalls.forEach(c => {
        if (!c.score.parameters) return;
        Object.keys(paramAvgs).forEach(k => {
          paramAvgs[k] += c.score.scores?.[k]?.score || 0;
        });
      });
    Object.keys(paramAvgs).forEach(k => {
      paramAvgs[k] = Math.round((paramAvgs[k] / scoredCalls.length) * 10) / 10;
    });

    const weakest = Object.entries(paramAvgs).sort((a, b) => a[1] - b[1])[0][0];

    // Streak calculation
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const practiceDays = new Set(scoredCalls.map(c => {
      const d = new Date(c.started_at);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }));

    let streak = 0;
    let checkDay = new Date(today);
    while (practiceDays.has(checkDay.getTime())) {
      streak++;
      checkDay.setDate(checkDay.getDate() - 1);
    }

    res.json({
      sessions: scoredCalls.length,
      avgScore,
      bestScore: Math.max(...scores),
      trend,
      streak,
      paramAvgs,
      weakest,
      recentScores: scores.slice(-7)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Footprints PRT Training Bot running on port ${PORT}`);
});