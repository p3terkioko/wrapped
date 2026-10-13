// Seed the local dev database from .cache/pull.json (see pull-snapshot.js).
// Refuses to run against a non-local database.
//
//   npm run dev:seed
'use strict';

const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env.local') });
require('dotenv').config({ path: path.join(root, '.env') });
require('./lib/guard').assertLocalDatabase(process.env.DATABASE_URL);

const { prisma } = require('../src/db/client');
const { storePlaylist, storeArtists } = require('../src/services/sync');
const { env } = require('../src/config/env');

(async () => {
  const file = path.join(root, '.cache', 'pull.json');
  if (!fs.existsSync(file)) throw new Error('.cache/pull.json not found; run npm run dev:pull first');
  const pull = JSON.parse(fs.readFileSync(file, 'utf8'));
  await storePlaylist(prisma, env.SPOTIFY_PLAYLIST_ID, pull.items, { log: console.log });
  await storeArtists(prisma, pull.artists);
  for (const u of pull.users) {
    await prisma.contributor.upsert({ where: { id: u.id }, create: u, update: { displayName: u.displayName, avatarUrl: u.avatarUrl } });
  }
  const p = pull.playlist;
  await prisma.setting.upsert({
    where: { key: 'playlistMeta' },
    create: { key: 'playlistMeta', value: { id: p.id, name: p.name, description: p.description || '', url: p.external_urls?.spotify, image: p.images?.[0]?.url || null, owner: p.owner?.display_name || p.owner?.id, followers: p.followers?.total ?? null, snapshotId: p.snapshot_id || null } },
    update: { value: { id: p.id, name: p.name, description: p.description || '', url: p.external_urls?.spotify, image: p.images?.[0]?.url || null, owner: p.owner?.display_name || p.owner?.id, followers: p.followers?.total ?? null, snapshotId: p.snapshot_id || null } },
  });
  console.log(`seeded ${pull.items.length} items, ${pull.artists.length} artists, ${pull.users.length} contributors (pulled ${pull.pulledAt})`);
  await prisma.$disconnect();
})().catch(async err => { console.error(err); process.exit(1); });
