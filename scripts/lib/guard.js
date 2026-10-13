// Safety rail for local scripts: they may only write to a database on this
// machine unless the operator explicitly opts in for a production run.
'use strict';

function isLocalDatabase(url = '') {
  try {
    const u = new URL(url.replace(/^prisma\+postgres:/, 'http:').replace(/^postgres(ql)?:/, 'http:'));
    return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(u.hostname);
  } catch {
    return false;
  }
}

function assertLocalDatabase(url) {
  if (isLocalDatabase(url)) return;
  if (process.env.ALLOW_PRODUCTION_DB === 'yes-i-mean-production') {
    console.warn('!! Running against a NON-LOCAL database because ALLOW_PRODUCTION_DB is set.');
    return;
  }
  console.error('Refusing to run: DATABASE_URL does not point at localhost.');
  console.error('This script writes data. For a deliberate production run set ALLOW_PRODUCTION_DB=yes-i-mean-production.');
  process.exit(1);
}

module.exports = { isLocalDatabase, assertLocalDatabase };
