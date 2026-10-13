// Local development entry point — delegates entirely to src/app.js.
// .env.local is loaded first so local runs use the dev database; values there
// win over .env (dotenv never overrides a variable that is already set).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = require('../src/app');
const { env } = require('../src/config/env');
const { isLocalDatabase } = require('../scripts/lib/guard');

// Optional local scheduler (ENABLE_SCHEDULER=true). It writes to the database,
// so it only starts when that database is on this machine.
if (env.ENABLE_SCHEDULER) {
  if (!isLocalDatabase(env.DATABASE_URL) && process.env.ALLOW_PRODUCTION_DB !== 'yes-i-mean-production') {
    console.warn('Scheduler NOT started: DATABASE_URL is not local. Production refreshes run on Vercel Cron.');
  } else {
    const cron = require('node-cron');
    const { runRefresh } = require('../src/services/refresh');
    let running = false;
    cron.schedule('0 0 9 * * *', async () => {
      if (running) return;
      running = true;
      try { await runRefresh('scheduler'); } catch (err) { console.error('Scheduled refresh failed:', err.message); } finally { running = false; }
    }, { timezone: 'Africa/Nairobi' });
    console.log('Scheduler started — daily at 09:00 EAT (local database)');
  }
}

app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});
