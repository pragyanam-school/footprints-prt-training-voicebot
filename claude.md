# Footprints PRT Training Voicebot

## Project Overview
Voice-based sales training bot for Footprints Preschool & Daycare. 
Agents practice sales calls with AI-simulated parent personas. 
After each call, Claude scores the agent and generates coaching feedback.

## Live URL
https://footprints-prt-training-voicebot.onrender.com

## GitHub
https://github.com/pragyanam-school/footprints-prt-training-voicebot

## Tech Stack
- **Backend:** Node.js / Express (server.js)
- **Voice:** Vapi.ai (5 parent personas)
- **AI Scoring:** Claude Sonnet (claude-sonnet-4-5-20250929)
- **TTS:** ElevenLabs (voice ID: QTKSa2Iyv0yoxvXY2V8a)
- **STT:** Deepgram Nova-2 with HighScope custom vocabulary
- **Database:** Supabase (calls, users, supervisor_notes tables)
- **Frontend:** Vanilla JS bundled with esbuild
- **Deployment:** Render.com (auto-deploys from GitHub main branch)

## Project Structure
server.js          - Express backend, all API routes
scoring.js         - Claude scoring logic (config-driven)
db.js              - Supabase client
client/main.js     - Frontend JS source (EDIT THIS)
public/bundle.js   - Built frontend (auto-generated, DO NOT EDIT)
public/index.html  - HTML shell
setup-personas.js  - Creates Vapi assistants via API
update-vapi-vocabulary.js - Updates Vapi transcriber settings
rescore.js         - Rescores all existing calls with new scoring
cities.json        - Indian cities and areas for random assignment

## IMPORTANT: Frontend Build Process
Always edit `client/main.js`, never `public/bundle.js`.
After any frontend change run:
```bash
./node_modules/.bin/esbuild client/main.js --bundle --outfile=public/bundle.js --platform=browser
```
Then commit both files to GitHub. Render does NOT run build commands.

## Deployment Process
1. Make changes locally
2. Build bundle if frontend changed
3. `git add . && git commit -m "message" && git push`
4. Render auto-deploys within 2-3 minutes

## 5 Parent Personas (Vapi Assistants)
1. Shuchi Mehra - Working single mother (VAPI_ASSISTANT_ID)
2. Ankita Sharma - Relocating parent (VAPI_ASSISTANT_ID_ANKITA)
3. Neha Gupta - Safety first mother (VAPI_ASSISTANT_ID_NEHA)
4. Rashmi Jain - Comparison shopper (VAPI_ASSISTANT_ID_RASHMI)
5. Ritu Verma - First time anxious mother (VAPI_ASSISTANT_ID_RITU)

## Scoring Parameters (scoring.js SCORING_PARAMETERS array)
All weights configurable in scoring.js config section only.
Current weights:
- CCTV & Safety: 15
- HighScope Curriculum: 15
- Objection Handling: 15
- Visit Booking: 10 (can be N/A if parent already visited)
- Nutrition & Meals: 10
- Tone & Empathy: 15
- Responsiveness & Active Listening: 20 (new, always applicable)
Total: 100

## Scoring Rules
- Uses Claude Sonnet for scoring (not Haiku)
- Short calls under 300 words return short_call: true, no score
- Score displayed as percentage (e.g. 73% · 62/85 · Good)
- Leaderboard uses avg of last 4 new-format calls only
- New-format calls have score.parameters field
- Old-format calls do not have score.parameters (legacy)

## User Roles
- agent: sees own calls only, can start practice calls
- supervisor: sees all agents, leaderboard, can add notes, can also do practice calls

## Database Tables (Supabase)
- users: id, name, email, password_hash, role, created_at
- calls: id, agent_id, agent_name, persona, city, area, status, started_at, ended_at, transcript, score (JSONB), created_at
- supervisor_notes: id, call_id, supervisor_id, supervisor_name, note, created_at

## Known Issues / Pending Work
- Password reset feature not yet built
- Short call badge in UI needs testing
- rescore.js needs to be run to update old calls with new scoring format
- Leaderboard avg of last 4 sessions implemented in server.js but UI label not updated yet in client/main.js

## Environment Variables Required
VAPI_API_KEY, VAPI_PUBLIC_KEY, VAPI_ASSISTANT_ID, VAPI_ASSISTANT_ID_ANKITA,
VAPI_ASSISTANT_ID_NEHA, VAPI_ASSISTANT_ID_RASHMI, VAPI_ASSISTANT_ID_RITU,
ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY,
ELEVENLABS_VOICE_ID, PORT=3000