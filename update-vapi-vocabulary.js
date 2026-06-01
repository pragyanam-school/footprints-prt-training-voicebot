require('dotenv').config();
const axios = require('axios');

const VAPI_API_KEY = process.env.VAPI_API_KEY;

const ASSISTANT_IDS = [
  process.env.VAPI_ASSISTANT_ID,
  process.env.VAPI_ASSISTANT_ID_ANKITA,
  process.env.VAPI_ASSISTANT_ID_NEHA,
  process.env.VAPI_ASSISTANT_ID_RASHMI,
  process.env.VAPI_ASSISTANT_ID_RITU
];

const UPDATED_TRANSCRIBER = {
  provider: 'deepgram',
  model: 'nova-2',
  language: 'en',
  keywords: ['HighScope:3', 'Footprints:2']
};

async function updateAssistant(id) {
  if (!id) return;
  const response = await axios.patch(
    `https://api.vapi.ai/assistant/${id}`,
    { transcriber: UPDATED_TRANSCRIBER },
    {
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}

async function main() {
  console.log('Updating all 5 assistants with HighScope vocabulary...\n');

  for (const id of ASSISTANT_IDS) {
    try {
      await updateAssistant(id);
      console.log(`✅ Updated: ${id}`);
    } catch (err) {
      console.error(`❌ Failed: ${id}`, err.response?.data || err.message);
    }
  }

  console.log('\nDone.');
}

main();