'use strict';

// Spotify → database. Stores each track once, replaces the playlist's entries
// in order, keeps artists and contributor names cached, and reports what is new.

const spotify = require('./spotify');

const ARTIST_TTL_DAYS = 30;

function trackRow(t) {
  const imgs = (t.album?.images || []).slice().sort((a, b) => (b.width || 0) - (a.width || 0));
  return {
    id: t.id,
    isrc: t.external_ids?.isrc || null,
    name: t.name,
    artistIds: (t.artists || []).map(a => a.id).filter(Boolean),
    artistNames: (t.artists || []).map(a => a.name),
    albumId: t.album?.id || null,
    albumName: t.album?.name || null,
    albumType: t.album?.album_type || null,
    imageUrl: imgs[0]?.url || null,
    imageMedium: (imgs.find(i => i.width && i.width <= 320 && i.width >= 200) || imgs[1] || imgs[0])?.url || null,
    imageSmall: imgs[imgs.length - 1]?.url || null,
    releaseDate: t.album?.release_date || null,
    releasePrecision: t.album?.release_date_precision || null,
    durationMs: t.duration_ms || 0,
    explicit: !!t.explicit,
    popularity: typeof t.popularity === 'number' ? t.popularity : null,
  };
}

// Write a normalised playlist (from Spotify or from a saved pull) into the DB.
async function storePlaylist(prisma, playlistId, items, { log = () => {} } = {}) {
  const usable = items.filter(i => i.track && i.track.id && i.track.type !== 'episode');
  const rows = new Map();
  for (const i of usable) rows.set(i.track.id, trackRow(i.track));

  const existing = new Set((await prisma.track.findMany({ select: { id: true } })).map(t => t.id));
  const fresh = [...rows.values()].filter(r => !existing.has(r.id));
  if (fresh.length) await prisma.track.createMany({ data: fresh, skipDuplicates: true });

  // Mutable fields on known tracks (popularity, artwork URLs), batched.
  const updates = [...rows.values()].filter(r => existing.has(r.id)).map(r =>
    prisma.track.update({ where: { id: r.id }, data: { popularity: r.popularity, imageUrl: r.imageUrl, imageMedium: r.imageMedium, imageSmall: r.imageSmall, name: r.name, artistNames: r.artistNames } }));
  for (let i = 0; i < updates.length; i += 200) await prisma.$transaction(updates.slice(i, i + 200));

  await prisma.$transaction([
    prisma.playlistEntry.deleteMany({ where: { playlistId } }),
    prisma.playlistEntry.createMany({
      data: usable.map((i, position) => ({ playlistId, position, trackId: i.track.id, addedAt: new Date(i.addedAt), addedBy: i.addedBy, isLocal: i.isLocal })),
    }),
  ]);
  log(`stored ${usable.length} entries, ${rows.size} unique tracks (${fresh.length} new)`);
  return { entries: usable.length, newTrackIds: fresh.map(r => r.id) };
}

// The artist picture closest to 320 px (shown at up to ~300 px), else the largest.
function artistPicture(images = []) {
  const imgs = images.slice().sort((a, b) => (b.width || 0) - (a.width || 0));
  return (imgs.find(i => i.width && i.width <= 400 && i.width >= 200) || imgs[0])?.url || null;
}

// Upsert artists given full Spotify artist objects.
async function storeArtists(prisma, artists) {
  const ops = artists.map(a => prisma.artist.upsert({
    where: { id: a.id },
    create: { id: a.id, name: a.name, genres: a.genres || [], genresAt: new Date(), popularity: a.popularity ?? null, followers: a.followers?.total ?? null, imageUrl: artistPicture(a.images) },
    update: { name: a.name, genres: a.genres || [], genresAt: new Date(), popularity: a.popularity ?? null, followers: a.followers?.total ?? null, imageUrl: artistPicture(a.images) },
  }));
  for (let i = 0; i < ops.length; i += 200) await prisma.$transaction(ops.slice(i, i + 200));
}

// Full sync from Spotify. Returns playlist metadata for the payload.
async function syncFromSpotify(prisma, { token, playlistId, log = () => {} }) {
  const playlist = await spotify.getPlaylist(playlistId, token);
  const { items, endpoint } = await spotify.getPlaylistItems(playlistId, token);
  log(`playlist items via /${endpoint}: ${items.length}`);
  const stored = await storePlaylist(prisma, playlistId, items, { log });

  // Artists: fetch any we don't have, or whose genres are older than the TTL.
  const needed = new Set(items.flatMap(i => (i.track?.artists || []).map(a => a.id)).filter(Boolean));
  const known = await prisma.artist.findMany({ select: { id: true, genresAt: true } });
  const fresh = new Set(known.filter(a => a.genresAt && Date.now() - a.genresAt.getTime() < ARTIST_TTL_DAYS * 864e5).map(a => a.id));
  const toFetch = [...needed].filter(id => !fresh.has(id));
  if (toFetch.length) {
    const { artists, mode } = await spotify.getArtists(toFetch, token);
    await storeArtists(prisma, artists);
    log(`artists refreshed: ${artists.length} (${mode})`);
  }

  // Contributors: names for new ids (Spotify profile while it still works).
  const adderIds = [...new Set(items.map(i => i.addedBy).filter(Boolean))];
  const knownC = new Set((await prisma.contributor.findMany({ select: { id: true } })).map(c => c.id));
  for (const id of adderIds.filter(id => !knownC.has(id))) {
    const p = id === playlist.owner?.id ? playlist.owner : await spotify.getUserProfile(id, token);
    await prisma.contributor.create({ data: { id, displayName: p?.display_name || null, avatarUrl: p?.images?.[0]?.url || null } });
    log(`new contributor ${id}: ${p?.display_name || '(no name from Spotify; set one in admin)'}`);
  }

  return {
    playlist: {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description || '',
      url: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`,
      image: playlist.images?.[0]?.url || null,
      owner: playlist.owner?.display_name || playlist.owner?.id || null,
      followers: playlist.followers?.total ?? null,
      snapshotId: playlist.snapshot_id || null,
    },
    newTrackIds: stored.newTrackIds,
    endpoint,
  };
}

module.exports = { syncFromSpotify, storePlaylist, storeArtists, trackRow };
