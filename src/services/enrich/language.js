'use strict';

// Line-level language classifier for lyrics: Swahili (incl. Sheng), English,
// mixed, or other. Only the counts leave this module; the text never does.
//
// Method (stated on screen): each line is split into words; words are matched
// against lists of common Swahili/Sheng and English words, plus a Swahili verb
// pattern (subject + tense prefix, e.g. "ni-na-ku-penda"). A line is "mixed"
// when it has at least one Swahili and one English word (code-switching).
// Lines with neither (Lingala, French, Pidgin, Zulu...) count as "other".
// Pure vocables ("oh", "yeah", "na na") are skipped.

const words = s => new Set(s.split(/\s+/).filter(Boolean));

const SWAHILI = words(`
ni ya wa kwa za la cha vya hii hiyo huyo yule hapa pale kule sasa leo kesho jana tu pia bado sana kama lakini au kwamba
ndio ndiyo sio hapana hakuna kuna iko nina una ana tuna mna wana sina huna hana mimi wewe yeye sisi nyinyi wao
yangu yako yake yetu yenu yao wangu wako wake changu chako chake langu lako lake mpenzi mapenzi penzi moyo roho maisha
nakupenda napenda nataka sitaki unataka siwezi naweza kila wote yote zote siku usiku mchana asubuhi jioni mtu watu mtoto
nyumba pesa sawa uko niko tuko mko nini nani wapi lini vipi gani kwani hata tena kweli kwenda kuja njoo nenda twende enda
ona sema cheza imba ngoma mziki muziki rafiki bwana dada mungu asante karibu pole haraka polepole mbali juu chini ndani nje
safi huyu hao hizi hizo wale ile hiki hicho ama labda kwanza mwisho tena peke yangu mrembo malaika mpenzi wangu nakuomba
nakuambia nikupe nipe nikuone nikupende unanipenda unajua najua sijui mbona kwenu kwetu nyumbani shida furaha amani
uzuri mzuri mbaya kubwa ndogo kidogo mingi mengi wengi baadaye mapema saa wiki mwaka mwezi
doh mbogi manze msee wasee buda mathe dame fiti poa noma freshi ngori wacha achana mresh mtaa mtaani sheng
chuo mabeshte beshte maze vile ivo hivi hivyo yenye wenye mwenye kitu vitu jambo mambo
`);

const ENGLISH = words(`
the and you your you're i'm i me my mine we our us they them their he she his her it it's is are was were be been
have has had do don't does did can can't will won't would should could to of in on at for with from about like just
so but if when what where why how all this that these those there here now never always love baby girl boy know want
need feel gonna wanna gotta got get go come take make say said tell see look time life heart night way one only more
too every nothing something everything right wrong good bad better back down up out into over still again away let
around tonight forever world dream dreams hold mind body soul eyes hands little lady man fire dance free high
`);

// Other languages that would otherwise slip into Swahili via short shared words.
const OTHER = words(`
ngai bolingo motema nalingi olingi ozali nazali lobi mwasi mobali mpo ndenge likambo makambo te
je il elle nous vous les des une est pas mon ma moi toi avec pour dans qui que c'est j'ai
dey wey abeg oya wahala sabi omo dem jare shey
el los las una por para con que mi te amor corazón
`);

const VOCABLES = new Set(['oh', 'ooh', 'oooh', 'yeah', 'yeh', 'ye', 'eh', 'ehh', 'ah', 'ahh', 'aah', 'na', 'la', 'da', 'mm', 'mmm', 'hey', 'uh', 'woah', 'whoa', 'ayy', 'ay', 'yo', 'ooo', 'ha', 'hmm', 'huh']);

// Short Swahili words that also occur in English lyrics ("see ya") count half.
const WEAK = new Set(['ya', 'wa', 'si', 'ni', 'ama', 'dame', 'maze', 'vile']);

const SW_VERB = /^(ni|u|a|tu|m|mu|wa|ha|si|hu)(na|li|ta|me|ki|nge|ja)[a-z]{3,}[aeiou]$/;

function tokenize(line) {
  return line.toLowerCase().normalize('NFC').split(/[^\p{L}']+/u).map(w => w.replace(/^'+|'+$/g, '')).filter(Boolean);
}

function classifyLine(line) {
  const toks = tokenize(line);
  const content = toks.filter(t => !VOCABLES.has(t));
  if (content.length === 0) return null; // vocables only
  let sw = 0, strong = 0, en = 0, ot = 0;
  for (const t of content) {
    if (OTHER.has(t)) ot += 1;
    else if (SWAHILI.has(t)) { const weak = WEAK.has(t); sw += weak ? 0.5 : 1; if (!weak) strong += 1; }
    else if (ENGLISH.has(t)) en += 1;
    else if (t.length >= 6 && SW_VERB.test(t)) { sw += 1; strong += 1; }
  }
  if (sw === 0 && en === 0) return content.length >= 2 || ot ? 'other' : null;
  if (ot > sw && ot > en) return 'other';
  if (strong >= 1 && en >= 1) return 'mixed';
  return sw > en ? 'swahili' : 'english';
}

// Returns only numbers: { lines: { swahili, english, mixed, other }, words }.
function analyseLyrics(text) {
  const counts = { swahili: 0, english: 0, mixed: 0, other: 0 };
  let wordCount = 0;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/\[[^\]]*\]/g, '').trim(); // drop [Chorus]-style markers
    if (!line) continue;
    wordCount += tokenize(line).length;
    const c = classifyLine(line);
    if (c) counts[c] += 1;
  }
  return { lines: counts, words: wordCount };
}

module.exports = { analyseLyrics, classifyLine };
