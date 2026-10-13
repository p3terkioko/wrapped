// Run a command with .env.local loaded first, so local work talks to the dev
// database instead of whatever .env points at. Refuses to run if the resulting
// DATABASE_URL is not on localhost.
//
//   node scripts/with-dev-env.js prisma db push
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const local = path.join(root, '.env.local');
if (!fs.existsSync(local)) {
  console.error('.env.local is missing. Copy .env.local.example to .env.local first.');
  process.exit(1);
}
require('dotenv').config({ path: local });

const { assertLocalDatabase } = require('./lib/guard');
assertLocalDatabase(process.env.DATABASE_URL);

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) { console.error('usage: node scripts/with-dev-env.js <command> [...args]'); process.exit(1); }
const bin = cmd === 'prisma' ? path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma') : cmd;
const res = spawnSync(bin, args, { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
process.exit(res.status ?? 1);
