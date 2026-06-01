require('dotenv').config();
const { supabase } = require('./db');
const { scoreCall } = require('./scoring');

async function rescoreAll() {
  console.log('Fetching all completed calls...');

  const { data: calls, error } = await supabase
    .from('calls')
    .select('*')
    .eq('status', 'completed')
    .not('transcript', 'is', null);

  if (error) {
    console.error('Failed to fetch calls:', error.message);
    return;
  }

  console.log(`Found ${calls.length} calls to rescore.\n`);

  let success = 0;
  let failed = 0;

  for (const call of calls) {
    try {
      console.log(`Scoring call ${call.id} (${call.agent_name} - ${call.persona})...`);

      const score = await scoreCall(
        call.transcript,
        call.persona || 'Shuchi Mehra',
        call.city || 'Unknown',
        call.area || 'Unknown'
      );

      await supabase
        .from('calls')
        .update({ score })
        .eq('id', call.id);

      console.log(`✅ ${call.agent_name} — ${score.weighted_total}% (${score.grade})`);
      success++;

      // Wait 2 seconds between calls to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      console.error(`❌ Failed: ${call.id} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${success} rescored, ${failed} failed.`);
}

rescoreAll();