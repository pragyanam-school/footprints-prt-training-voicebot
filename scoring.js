require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── SCORING CONFIG ───────────────────────────────────────
// To change weights, rename parameters, or add/remove parameters:
// Edit ONLY this section. Nothing else needs to change.

const SCORING_PARAMETERS = [
  {
    key: 'cctv_safety',
    label: 'CCTV & Safety',
    weight: 15,
    rubric: [
      { score: 15, description: 'Proactively mentioned live CCTV feed with parent app access and explained the benefit clearly' },
      { score: 11, description: 'Mentioned CCTV but without explaining parent app access or the benefit' },
      { score: 6,  description: 'Mentioned safety only when asked, no specific mention of CCTV or live feed' },
      { score: 0,  description: 'Never mentioned safety, CCTV, or security in any form' }
    ],
    not_applicable_signals: []
  },
  {
    key: 'highscope',
    label: 'HighScope Curriculum',
    weight: 15,
    rubric: [
      { score: 15, description: 'Explained HighScope outcomes with research data — employment rates, graduation rates, or evidence that children have measurably better life outcomes' },
      { score: 11, description: 'Mentioned it is research-based or the only research-backed early years curriculum, with at least one outcome reference (brain development, graduation rates, employment rates, or similar)' },
      { score: 9,  description: 'Said 2-3 factually accurate lines about HighScope or what it means for child development — even without citing specific research data' },
      { score: 4,  description: 'Mentioned HighScope by name only, no explanation' },
      { score: 0,  description: 'Never mentioned HighScope or curriculum at all' }
    ],
    not_applicable_signals: []
  },
  {
    key: 'objection_handling',
    label: 'Objection Handling',
    weight: 15,
    rubric: [
      { score: 15, description: 'Addressed the parent primary concern with empathy, specific details, and a reassuring example' },
      { score: 11, description: 'Addressed the concern but without empathy or specific details' },
      { score: 6,  description: 'Partially addressed the concern, deflected or gave a generic answer' },
      { score: 0,  description: 'Ignored or completely deflected the parent main concern' }
    ],
    not_applicable_signals: ['no objection raised', 'parent had no concerns']
  },
  {
    key: 'visit_booking',
    label: 'Visit Booking',
    weight: 10,
    rubric: [
      { score: 10, description: 'Clearly invited the parent for a center visit with a specific day or time suggestion' },
      { score: 7,  description: 'Mentioned a visit but without a specific day or time' },
      { score: 3,  description: 'Mentioned visit only when parent asked, or very passively' },
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
      { score: 7,  description: 'Mentioned meals AND used quality language — words like nutritious, healthy, no junk food, fresh, or balanced meals' },
      { score: 3,  description: 'Mentioned food or meals but with no quality language, or only mentioned it when the parent asked' },
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
      { score: 11, description: 'Professional and polite but transactional, did not address emotional concerns' },
      { score: 6,  description: 'Somewhat robotic or rushed, missed emotional cues' },
      { score: 0,  description: 'Dismissive, impatient, or made the parent feel unheard' }
    ],
    not_applicable_signals: []
  },
  {
    key: 'responsiveness',
    label: 'Responsiveness & Active Listening',
    weight: 20,
    rubric: [
      { score: 20, description: 'Directly answered what the parent asked before adding other information. Conversation felt natural, parent felt heard, no monologuing' },
      { score: 15, description: 'Mostly answered parent questions but occasionally added unrequested information' },
      { score: 8,  description: 'Frequently gave information the parent did not ask for, missed specific questions' },
      { score: 0,  description: 'Completely ignored parent questions, delivered a monologue' }
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

const SHORT_CALL_WORD_THRESHOLD = 300;

// ─── END OF CONFIG ────────────────────────────────────────

function countWords(text) {
  return text.trim().split(/\s+/).length;
}

function buildScoringPrompt(transcript, personaName, city, area) {
  let paramSection = SCORING_PARAMETERS.map((p, i) => {
    const rubricLines = p.rubric.map(r => `  ${r.score} = ${r.description}`).join('\n');
    const naSignals = p.not_applicable_signals.length > 0
      ? `\n  Mark as NOT APPLICABLE if any of these are true: ${p.not_applicable_signals.join('; ')}`
      : '';
    return `${i + 1}. ${p.label} — score out of ${p.weight}${naSignals}\n${rubricLines}`;
  }).join('\n\n');

  const jsonScoreFields = SCORING_PARAMETERS.map(p =>
    `    "${p.key}": { "score": 0, "applicable": true, "evidence": "exact quote from transcript or NOT MENTIONED", "what_good_looks_like": "specific sentence the agent should have said" }`
  ).join(',\n');

  return (
    "You are a quality auditor for Footprints Preschool & Daycare, evaluating a sales agent's performance on a practice call.\n\n" +
    "The agent spoke with a simulated parent persona: " + personaName + ", calling from " + area + ", " + city + ".\n\n" +
    "Here is the full call transcript:\n" + transcript + "\n\n" +
    "Footprints three biggest differentiators that agents MUST mention:\n" +
    "1. Live CCTV feed accessible by parents on their phone\n" +
    "2. HighScope curriculum - the ONLY research-backed early years curriculum with data showing children have better employment rates, graduation rates, and life outcomes\n" +
    "3. Nutritious meals - no junk food, healthy snacks, in-house preparation\n\n" +
    "CRITICAL RULES FOR SCORING:\n" +
    "1. ONLY score based on what is actually in the transcript. Do not assume or invent.\n" +
    "2. For evidence field: copy an exact quote from the transcript. If not mentioned write NOT MENTIONED.\n" +
    "3. For what_good_looks_like field: write what the agent SHOULD have said. This is your coaching advice, not a description of what they said.\n" +
    "4. These two fields must NEVER contain the same content. evidence = what happened. what_good_looks_like = what should have happened.\n" +
    "5. If a parameter was not applicable mark applicable as false and score as null.\n" +
    "6. Note: Indian agents may pronounce HighScope as high scope or high school. If you see high school curriculum in transcript it likely means HighScope curriculum.\n" +
    "7. Be fair. Give partial credit for partial answers.\n\n" +
    "Score each applicable parameter directly out of its maximum weight:\n\n" +
    paramSection + "\n\n" +
    "Return ONLY this exact JSON, nothing else:\n" +
    "{\n" +
    '  "scores": {\n' +
    jsonScoreFields + "\n" +
    "  },\n" +
    '  "top_strength": "one specific thing the agent did well — include an exact quote from the transcript as evidence",\n' +
    '  "top_gap": "the single most important gap — reference the exact moment in transcript where it went wrong",\n' +
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
      evidence: s?.evidence || '',
      what_good_looks_like: s?.what_good_looks_like || ''
    };
  });

  const percentage = totalApplicableWeight > 0
    ? Math.round((totalScore / totalApplicableWeight) * 100)
    : 0;

  let grade = 'Poor';
  for (const threshold of GRADE_THRESHOLDS) {
    if (percentage >= threshold.min) { grade = threshold.grade; break; }
  }

  return { parameters, totalScore, totalApplicableWeight, percentage, grade };
}

async function scoreCall(transcript, personaName, city, area) {
  // Short call detection
  const wordCount = countWords(transcript);
  if (wordCount < SHORT_CALL_WORD_THRESHOLD) {
    return {
      short_call: true,
      word_count: wordCount,
      message: 'Call too short to assess properly',
      weighted_total: null,
      grade: null,
      parameters: null
    };
  }

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
    short_call: false,
    word_count: wordCount,
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