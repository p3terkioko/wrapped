'use strict';

// Genre families. Spotify tags artists, not songs, and tags many Kenyan
// artists with noisy labels (Sauti Sol and Mutoriah as "rumba congolaise"),
// so the film never counts a song once per tag. Each song gets ONE primary
// family by this rule:
//   1. If any of its artists carry a regional African tag, the regional family
//      with the most tags wins (ties: East, West, Southern, Central).
//   2. Otherwise, pan-African tags (afro soul, afro r&b, afropop) make it
//      Afro-fusion.
//   3. Otherwise the global style with the most tags wins (ties by the order
//      in GLOBAL below).
// Admins can correct an artist's genres (Artist.overrides.genres) and remap a
// genre to another family (Setting "genreFamilies": { genre: family }).

const REGIONAL = ['East African', 'West African', 'Southern African', 'Central African'];
const PAN = 'Afro-fusion';
const GLOBAL = ['Hip-hop & rap', 'R&B & soul', 'Gospel', 'Reggae & Caribbean', 'Pop', 'Electronic & dance', 'Rock & metal', 'Jazz & classics', 'Country & folk', 'Latin', 'Other'];
const FAMILIES = [...REGIONAL, PAN, ...GLOBAL];

const MAP = {
  'East African': ['gengetone', 'bongo flava', 'bongo piano', 'singeli', 'ethiopian jazz', 'benga', 'taarab', 'arbantone', 'kapuka', 'genge', 'kenyan pop', 'kenyan hip hop', 'kenyan r&b', 'kenyan drill', 'ugandan pop', 'tanzanian pop', 'ethiopian pop', 'kidandali', 'zilizopendwa', 'ohangla'],
  'West African': ['afrobeats', 'afrobeat', 'alté', 'afro adura', 'azonto', 'hiplife', 'ghanaian hip hop', 'asakaa', 'highlife', 'nigerian drill', 'afroswing', 'latin afrobeats', 'coupé décalé', 'nigerian pop', 'ghanaian pop', 'fuji', 'juju'],
  'Southern African': ['amapiano', 'afropiano', 'private school piano', '3 step', 'gqom', 'afro house', 'afro tech', 'bacardi', 'maskandi', 'tribal house', 'kizomba', 'kwaito', 'south african house', 'zimdancehall', 'sungura'],
  'Central African': ['rumba congolaise', 'ndombolo', 'bikutsi', 'soukous', 'makossa', 'congolese gospel'],
  [PAN]: ['afro soul', 'afro r&b', 'afropop', 'afro-fusion', 'afro pop'],
  'Hip-hop & rap': ['rap', 'hip hop', 'west coast hip hop', 'east coast hip hop', 'old school hip hop', 'g-funk', 'drill', 'uk drill', 'gangster rap', 'christian hip hop', 'country hip hop', 'jazz rap', 'grime', 'uk grime', 'spoken word', 'trap'],
  'R&B & soul': ['r&b', 'uk r&b', 'neo soul', 'alternative r&b', 'pop soul', 'soul', 'retro soul', 'philly soul', 'motown', 'quiet storm', 'indie soul', 'indie r&b', 'french r&b', 'trap soul'],
  'Gospel': ['gospel', 'afrogospel', 'christian', 'christian pop', 'christian lo-fi', 'christian r&b', 'christian edm', 'christian reggae', 'worship'],
  'Reggae & Caribbean': ['dancehall', 'reggae', 'roots reggae', 'ragga', 'lovers rock', 'riddim', 'shatta', 'nz reggae', 'soca', 'calypso', 'kompa', 'zouk', 'champeta'],
  'Pop': ['pop', 'soft pop', 'french pop', 'folk pop', 'art pop', 'synthpop', 'k-pop', 'punjabi pop', 'baroque pop', 'pop urbaine', 'britpop'],
  'Electronic & dance': ['edm', 'deep house', 'tropical house', 'french house', 'house', 'electronic', 'electro', 'disco house', 'organic house', 'jazz house', 'uk funky', 'disco', 'lo-fi', 'lo-fi beats', 'jazz beats'],
  'Rock & metal': ['classic rock', 'rock', 'psychedelic rock', 'acid rock', 'post-grunge', 'glam metal', 'hard rock', 'rock and roll', 'soft rock', 'yacht rock', 'emo', 'pop punk', 'new wave', 'death metal', 'black metal', 'metal', 'thrash metal', 'groove metal', 'nu metal', 'heavy metal', 'speed metal', 'alternative metal'],
  'Jazz & classics': ['soul jazz', 'vocal jazz', 'jazz', 'afro-cuban jazz', 'latin jazz', 'big band', 'adult standards', 'swing music', 'cha cha cha', 'lounge', 'musicals', 'score', 'new age', 'celtic', 'flamenco', 'traditional music', 'native american music'],
  'Country & folk': ['country', 'classic country', 'indie folk', 'singer-songwriter', 'southern gothic'],
  'Latin': ['reggaeton', 'trap latino', 'latin', 'urbano latino', 'banda', 'norteño', 'sierreño', 'sad sierreño', 'corrido', 'ranchera', 'grupera', 'música mexicana'],
  'Other': ['christmas'],
};

const BASE = {};
for (const [family, genres] of Object.entries(MAP)) for (const g of genres) BASE[g] = family;

// Keyword fallback for tags not in the table (Spotify adds new ones).
const KEYWORDS = [
  [/kenyan|tanzanian|ugandan|ethiopian|rwandan|benga|taarab|swahili/, 'East African'],
  [/nigerian|ghanaian|naija|afrobeat|ivorian|senegal|mbalax/, 'West African'],
  [/south african|amapiano|gqom|kwaito|zimbabw|angolan|mozambi|zambian|botswana|malawi/, 'Southern African'],
  [/congolese|rumba|cameroon/, 'Central African'],
  [/^afro/, PAN],
  [/hip hop|rap|drill|grime|trap/, 'Hip-hop & rap'],
  [/r&b|soul/, 'R&B & soul'],
  [/gospel|christian|worship|praise/, 'Gospel'],
  [/reggae|dancehall|ragga|riddim|soca|zouk|caribbean/, 'Reggae & Caribbean'],
  [/house|edm|electro|techno|disco|lo-fi|trance|dubstep|drum and bass/, 'Electronic & dance'],
  [/rock|metal|punk|grunge|emo|indie/, 'Rock & metal'],
  [/jazz|swing|big band|classical|orchestra/, 'Jazz & classics'],
  [/country|folk|bluegrass|americana/, 'Country & folk'],
  [/latin|reggaeton|mexican|banda|corrido|salsa|bachata|cumbia/, 'Latin'],
  [/pop/, 'Pop'],
];

function familyOf(genre, overrides = {}) {
  const g = String(genre).toLowerCase().trim();
  if (overrides[g] && FAMILIES.includes(overrides[g])) return overrides[g];
  if (BASE[g]) return BASE[g];
  for (const [re, fam] of KEYWORDS) if (re.test(g)) return fam;
  return 'Other';
}

// Primary family for one song, from the union of its artists' genres.
// Returns null when no artist has any genre (uncovered).
function primaryFamily(genres, overrides = {}) {
  if (!genres || !genres.length) return null;
  const votes = {};
  for (const g of genres) {
    const fam = familyOf(g, overrides);
    votes[fam] = (votes[fam] || 0) + 1;
  }
  const best = order => {
    let top = null;
    for (const fam of order) if (votes[fam] && (!top || votes[fam] > votes[top])) top = fam;
    return top;
  };
  return best(REGIONAL) || (votes[PAN] ? PAN : null) || best(GLOBAL);
}

// The genres an artist effectively has, after admin corrections.
function artistGenres(artist) {
  const o = artist?.overrides;
  if (o && Array.isArray(o.genres)) return o.genres.map(g => String(g).toLowerCase().trim()).filter(Boolean);
  return artist?.genres || [];
}

module.exports = { FAMILIES, REGIONAL, PAN, GLOBAL, familyOf, primaryFamily, artistGenres };
