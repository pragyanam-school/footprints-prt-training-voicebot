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
    weight: 20,
    rubric: [
      { score: 20, description: 'Proactively mentioned live CCTV feed with parent app access and explained the benefit clearly' },
      { score: 14, description: 'Mentioned CCTV but without explaining parent app access or the benefit to the parent' },
      { score: 8,  description: 'Mentioned safety only when asked, no specific mention of CCTV or live feed' },
      { score: 0,  description: 'Never mentioned safety, CCTV, or security in any form' }
    ]
  },
  {
    key: 'highscope',
    label: 'HighScope Curriculum',
    weight: 20,
    rubric: [
      { score: 20, description: 'Explained HighScope in outcome language — what it means for the child\'s development, with a practical example' },
      { score: 14, description: 'Mentioned HighScope by name and gave some explanation but no practical outcome' },
      { score: 8,  description: 'Mentioned curriculum vaguely without naming HighScope or explaining it' },
      { score: 0,  description: 'Never mentioned curriculum or HighScope at all' }
    ]
  },
  {
    key: 'objection_handling',
    label: 'Objection Handling',
    weight: 20,
    rubric: [
      { score: 20, description: 'Addressed the parent\'s primary concern with empathy, specific details, and a reassuring example' },
      { score: 14, description: 'Addressed the concern but without empathy or specific details' },
      { score: 8,  description: 'Partially addressed the concern, deflected or gave a generic answer' },
      { score: 0,  description: 'Ignored or completely deflected the parent\'s main concern' }
    ]
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
    ]
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
    ]
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
  const totalWeight = SCORING_PARAMETERS.reduce((sum, p) => sum + p.weight, 0);

  let paramSection = SCORING_PARAMETERS.map((p, i) => {
    const rubricLines = p.rubric.map(r => `  ${r.score} = ${r.description}`).join('\n');
    return `${i + 1}. ${p.label} — score out of ${p.weight}\n${rubricLines}`;
  }).join('\n\n');

  const jsonScoreFields = SCORING_PARAMETERS.map(p =>
    `    "${p.key}": 0`
  ).join(',\n');

  return (
    "You are a quality auditor for Footprints Preschool & Daycare, evaluating a sales agent's performance on a practice call.\n\n" +
    "The agent spoke with a simulated parent persona: " + personaName + ", calling from " + area + ", " + city + ".\n\n" +
    "Here is the full call transcript:\n" + transcript + "\n\n" +
    "Footprints three biggest differentiators that agents MUST mention:\n" +
    "1. Live CCTV feed accessible by parents on their phone\n" +
    "2. HighScope curriculum - US-based, research-backed, focuses on child-led learning (NOT high school curriculum)\n" +
    "3. Nutritious meals - no junk food, healthy snacks, in-house preparation\n\n" +
    "Score the agent on each parameter directly out of its maximum weight. Use decimals if needed.\n\n" +
    paramSection + "\n\n" +
    "Return ONLY this JSON, nothing else:\n" +
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

function calculateTotal(scores) {
  return SCORING_PARAMETERS.reduce((sum, p) => sum + (scores[p.key] || 0), 0);
}

function calculateGrade(total) {
  for (const threshold of GRADE_THRESHOLDS) {
    if (total >= threshold.min) return threshold.grade;
  }
  return 'Poor';
}

async function scoreCall(transcript, personaName, city, area) {
  const prompt = buildScoringPrompt(transcript, personaName, city, area);

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text.trim();
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  // Calculate total and grade ourselves — never trust LLM math
  const weighted_total = Math.round(calculateTotal(parsed.scores) * 10) / 10;
  const grade = calculateGrade(weighted_total);

  parsed.weighted_total = weighted_total;
  parsed.grade = grade;
  parsed.parameters = SCORING_PARAMETERS.map(p => ({
    key: p.key,
    label: p.label,
    weight: p.weight,
    score: parsed.scores[p.key] || 0
  }));

  return parsed;
}

// Export config so dashboard can use parameter labels and weights
module.exports = { scoreCall, SCORING_PARAMETERS };