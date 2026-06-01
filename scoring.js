require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── SCORING CONFIG ───────────────────────────────────────
const SCORING_PARAMETERS = [
  {
    key: 'cctv_safety',
    label: 'CCTV & Safety',
    weight: 20,
    rubric: [
      { score: 20, description: 'Proactively mentioned live CCTV feed with parent app access and explained the benefit clearly' },
      { score: 14, description: 'Mentioned CCTV but without explaining parent app access or the benefit' },
      { score: 8,  description: 'Mentioned safety only when asked, no specific mention of CCTV or live feed' },
      { score: 0,  description: 'Never mentioned safety, CCTV, or security in any form' }
    ],
    not_applicable_signals: []
  },
  {
    key: 'highscope',
    label: 'HighScope Curriculum',
    weight: 20,
    rubric: [
      { score: 20, description: 'Explained HighScope outcomes with research data — employment rates, graduation rates, or similar evidence that children who go through this curriculum have measurably better life outcomes' },
      { score: 15, description: 'Mentioned it is research-based or the only research-backed early years curriculum, with at least one outcome reference' },
      { score: 10, description: 'Said 2-3 relevant lines about what HighScope means for child development' },
      { score: 5,  description: 'Mentioned HighScope by name only, no explanation' },
      { score: 0,  description: 'Never mentioned HighScope or curriculum at all' }
    ],
    not_applicable_signals: []
  },
  {
    key: 'objection_handling',
    label: 'Objection Handling',
    weight: 20,
    rubric: [
      { score: 20, description: 'Addressed the parent primary concern with empathy, specific details, and a reassuring example' },
      { score: 14, description: 'Addressed the concern but without empathy or specific details' },
      { score: 8,  description: 'Partially addressed the concern, deflected or gave a generic answer' },
      { score: 0,  description: 'Ignored or completely deflected the parent main concern' }
    ],
    not_applicable_signals: ['no objection raised', 'parent had no concerns']
  },
  {
    key: 'visit_booking',
    label: 'Visit Booking',
    weight: 15,
    rubric: [
      { score: 15, description: 'Clearly invited the parent for a center visit with a specific day or time suggestion' },
      { score: 10, description: 'Mentioned a visit but without a specific day or time' },
      { score: 5,  description: 'Mentioned visit only when parent asked, or very passively' },
      { score: 0,  description: 'Never mentioned a center visit' }
    ],
    not_applicable_signals: [
      'parent already visited',
      'parent has already come to center',
      'I visited your center',
      'we came last week',
      'after our visit',
      'when I visited',
      'parent already admitted'
    ]
  },
  {
    key: 'nutrition',
    label: 'Nutrition & Meals',
    weight: 10,
    rubric: [
      { score: 10, description: 'Proactively described meal quality, no-junk-food policy, and in-house preparation' },
      { score: 7,  description: 'Mentioned meals but only basic details, not the quality or policy' },
      { score: 3,  description: 'Mentioned food only when asked' },
      { score: 0,  description: 'Never mentioned meals or nutrition' }
    ],
    not_applicable_signals: []
  },
  {
    key: 'tone_empathy',
    label: 'Tone & Empathy',
    weight: 15,
    rubric: [
      { score: 15, description: 'Warm, patient, genuinely addressed emotional concerns, made the parent feel heard' },
      { score: 10, description: 'Professional and polite but transactional, did not address emotional concerns' },
      { score: 5,  description: 'Somewhat robotic or rushed, missed emotional cues' },
      { score: 0,  description: 'Dismissive, impatient, or made the parent feel unheard' }
    ],
    not_applicable_signals: []
  }
];

const GRADE_THRESHOLDS = [
  { min: 85, grade: 'Excellent' },
  { min: 65, grade: 'Good' },
  { min: 45, grade: 'Needs Improvement' },
  { min: 0,  grade: 'Poor' }
];

// ─── END OF CONFIG ────────────────────────────────────────

function buildScoringPrompt(transcript, personaName, city, area) {
  let paramSection = SCORING_PARAMETERS.map((p, i) => {
    const rubricLines = p.rubric.map(r => `  ${r.score} = ${r.description}`).join('\n');
    const naSignals = p.not_applicable_signals.length > 0
      ? `\n  Mark as NOT APPLICABLE if: ${p.not_applicable_signals.join('; ')}`
      : '';
    return `${i + 1}. ${p.label} — score out of ${p.weight}${naSignals}\n${rubricLines}`;
  }).join('\n\n');

  const jsonScoreFields = SCORING_PARAMETERS.map(p =>
    `    "${p.key}": { "score": 0, "applicable": true, "what_good_looks_like": "specific example of what the agent should have said", "evidence": "quote or reference from transcript supporting this score" }`
  ).join(',\n');

  return (
    "You are a quality auditor for Footprints Preschool & Daycare, evaluating a sales agent's performance on a practice call.\n\n" +
    "The agent spoke with a simulated parent persona: " + personaName + ", calling from " + area + ", " + city + ".\n\n" +
    "Here is the full call transcript:\n" + transcript + "\n\n" +
    "Footprints three biggest differentiators that agents MUST mention:\n" +
    "1. Live CCTV feed accessible by parents on their phone\n" +
    "2. HighScope curriculum - the ONLY research-backed early years curriculum with data showing children have better employment rates, graduation rates, and life outcomes\n" +
    "3. Nutritious meals - no junk food, healthy snacks, in-house preparation\n\n" +
    "IMPORTANT RULES:\n" +
    "1. Only score parameters that were actually relevant to this call.\n" +
    "2. If a parameter was not applicable (e.g. parent already visited so Visit Booking is irrelevant), set applicable to false and score to null.\n" +
    "3. For each parameter, provide what_good_looks_like — a specific example sentence the agent should have said.\n" +
    "4. For each parameter, provide evidence — a direct quote or reference from the transcript supporting your score. If not mentioned, say 'Not mentioned in transcript'.\n" +
    "5. Be fair but accurate. If the agent mentioned something briefly, give partial credit.\n\n" +
    "Score each applicable parameter directly out of its maximum weight:\n\n" +
    paramSection + "\n\n" +
    "Return ONLY this exact JSON, nothing else:\n" +
    "{\n" +
    '  "scores": {\n' +
    jsonScoreFields + "\n" +
    "  },\n" +
    '  "top_strength": "one specific thing the agent did well with a direct transcript quote as evidence",\n' +
    '  "top_gap": "the single most important thing the agent missed or mishandled with a direct transcript reference",\n' +
    '  "coaching_note": "2-3 sentences of specific actionable advice for this agent to improve next time"\n' +
    "}"
  );
}

function calculateResults(scores) {
  let totalScore = 0;
  let totalApplicableWeight = 0;

  const parameters = SCORING_PARAMETERS.map(p => {
    const s = scores[p.key];
    const applicable = s?.applicable !== false;
    const score = applicable ? (s?.score || 0) : null;

    if (applicable) {
      totalScore += score;
      totalApplicableWeight += p.weight;
    }

    return {
      key: p.key,
      label: p.label,
      weight: p.weight,
      score,
      applicable,
      what_good_looks_like: s?.what_good_looks_like || '',
      evidence: s?.evidence || ''
    };
  });

  const percentage = totalApplicableWeight > 0
    ? Math.round((totalScore / totalApplicableWeight) * 100)
    : 0;

  let grade;
  for (const threshold of GRADE_THRESHOLDS) {
    if (percentage >= threshold.min) { grade = threshold.grade; break; }
  }

  return { parameters, totalScore, totalApplicableWeight, percentage, grade };
}

async function scoreCall(transcript, personaName, city, area) {
  const prompt = buildScoringPrompt(transcript, personaName, city, area);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text.trim();
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const { parameters, totalScore, totalApplicableWeight, percentage, grade } = calculateResults(parsed.scores);

  return {
    scores: parsed.scores,
    parameters,
    totalScore,
    totalApplicableWeight,
    weighted_total: percentage,
    grade,
    top_strength: parsed.top_strength,
    top_gap: parsed.top_gap,
    coaching_note: parsed.coaching_note
  };
}

module.exports = { scoreCall, SCORING_PARAMETERS };