'use strict';
// Tempo and key of a 30-second MP3 preview, analysed in memory.
const { Essentia, EssentiaWASM } = require('essentia.js');
const { MPEGDecoder } = require('mpg123-decoder');

const PITCH = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
let essentia = null;

async function analysePreview(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('preview ' + res.status);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const dec = new MPEGDecoder(); await dec.ready;
  const { channelData, sampleRate } = dec.decode(bytes); dec.free();
  if (sampleRate !== 44100) throw new Error('unexpected sample rate ' + sampleRate);
  const [l, r] = channelData;
  const mono = r ? l.map((v, i) => (v + r[i]) / 2) : l;
  essentia = essentia || new Essentia(EssentiaWASM);
  const vec = essentia.arrayToVector(mono);
  const rhythm = essentia.RhythmExtractor2013(vec, 208, 'multifeature', 40);
  const key = essentia.KeyExtractor(vec, true, 4096, 4096, 12, 3500, 60, 25, 0.2, 'bgate', 44100, 0.0001, 440, 'cosine', 'hann');
  vec.delete && vec.delete();
  return { tempo: Math.round(rhythm.bpm * 10) / 10, tempoConfidence: rhythm.confidence, key: PITCH[key.key] ?? null, mode: key.scale === 'major' ? 1 : 0, keyStrength: key.strength };
}

module.exports = { analysePreview };
