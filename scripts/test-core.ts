/**
 * Core module integration tests (no browser required).
 * Run: npx tsx scripts/test-core.ts
 */
import { analyzeAudio } from '../src/audio/analyzer';
import { buildScenes, parseLyrics } from '../src/story/planner';
import { renderFrame } from '../src/render/renderer';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dir, '../test-fixtures/test-beat-120bpm.wav');

interface TestResult { name: string; pass: boolean; detail?: string }

const results: TestResult[] = [];

function assert(name: string, cond: boolean, detail = '') {
  results.push({ name, pass: cond, detail });
  console.log(cond ? `  ✅ ${name}` : `  ❌ ${name}${detail ? ': ' + detail : ''}`);
}

function parseWavMono(path: string): { data: Float32Array; sampleRate: number; duration: number } {
  const buf = readFileSync(path);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const sampleRate = view.getUint32(24, true);
  const bits = view.getUint16(34, true);
  const dataOff = 44;
  const numSamples = (buf.length - dataOff) / (bits / 8);
  const data = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    data[i] = view.getInt16(dataOff + i * 2, true) / 32768;
  }
  return { data, sampleRate, duration: numSamples / sampleRate };
}

console.log('\n🧪 曲影 AI · Core Module Tests\n');

// --- WAV fixture ---
let wav: ReturnType<typeof parseWavMono>;
try {
  wav = parseWavMono(FIXTURE);
  assert('fixture exists & parses', wav.data.length > 0, `${wav.duration.toFixed(1)}s @ ${wav.sampleRate}Hz`);
} catch (e) {
  assert('fixture exists & parses', false, String(e));
  printSummary();
  process.exit(1);
}

// --- Audio analyzer ---
const analysis = analyzeAudio({
  channelData: wav.data,
  sampleRate: wav.sampleRate,
  duration: wav.duration,
});

assert('engine field present', analysis.engine === 'local' || analysis.engine === 'essentia', analysis.engine);
assert('local fallback in node', analysis.engine === 'local');
assert('BPM in valid range', analysis.bpm >= 60 && analysis.bpm <= 200, `got ${analysis.bpm}`);
assert('beats generated', analysis.beats.length >= 4, `got ${analysis.beats.length}`);
assert('sections generated', analysis.sections.length >= 1, `got ${analysis.sections.length}`);
assert('mood classified', !!analysis.mood.name, analysis.mood.name);
assert('flow classified', !!analysis.flow, analysis.flow);
assert('vibe classified', !!analysis.vibe, analysis.vibe);
assert('energy features', analysis.features.energies.length > 0);
assert('spectral flux features', analysis.features.spectralFlux.length > 0);

// --- Essentia merge path ---
import type { EssentiaAnalysis } from '../src/audio/essentia-engine';
const mockEssentia: EssentiaAnalysis = {
  rhythm: { bpm: 120, beats: [{ time: 0, energy: 0.5, strength: 0.9 }, { time: 0.5, energy: 0.5, strength: 0.9 }], confidence: 0.9 },
  tonal: { key: 'C', scale: 'major', strength: 0.8 },
  dynamics: { danceability: 1.5, dynamicComplexity: 6, loudness: 0.4 },
};
const essentiaAnalysis = analyzeAudio({ channelData: wav.data, sampleRate: wav.sampleRate, duration: wav.duration }, mockEssentia);
assert('essentia engine tag', essentiaAnalysis.engine === 'essentia');
assert('essentia bpm override', essentiaAnalysis.bpm === 120);
assert('essentia key present', essentiaAnalysis.key === 'C' && essentiaAnalysis.scale === 'major');
assert('essentia danceability', essentiaAnalysis.danceability === 1.5);

const lines = parseLyrics('[00:01.00]第一句\n[00:05.00]第二句\n\n第三句');
assert('lyrics parse strips LRC', lines.length === 3 && lines[0] === '第一句');

// --- Storyboard planner ---
const scenes = buildScenes(analysis, ['镜头扫过街道', '心跳跟着节奏', '夜色温柔'], 'cinematic');
assert('scenes match sections', scenes.length === analysis.sections.length, `${scenes.length} scenes`);
assert('scenes have captions', scenes.every((s) => s.caption.length > 0));
assert('scenes have themes', scenes.every((s) => s.theme.length > 0));
assert('scenes have beats', scenes.some((s) => s.beats.length > 0));
assert('scene times contiguous', scenes[0].startTime === 0);
assert('scene end covers duration', Math.abs(scenes[scenes.length - 1].endTime - analysis.duration) < 1);

// --- Renderer ---
const canvas = { width: 1080, height: 1920 } as unknown as HTMLCanvasElement;
const ctx = {
  save() {}, restore() {},
  fillRect() {}, fill() {}, stroke() {}, beginPath() {}, closePath() {},
  arc() {}, moveTo() {}, lineTo() {}, fillText() {},
  translate() {}, scale() {},
  createLinearGradient() {
    return { addColorStop() {} };
  },
  createRadialGradient() {
    return { addColorStop() {} };
  },
  fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1,
  font: '', textAlign: 'center' as CanvasTextAlign,
  shadowColor: '', shadowBlur: 0,
  measureText(t: string) { return { width: t.length * 10 }; },
  fillText() {},
} as unknown as CanvasRenderingContext2D;

let renderOk = true;
for (const t of [0, 1, 3, 5]) {
  try {
    renderFrame(ctx, scenes, Math.min(t, analysis.duration - 0.01), 1080, 1920);
  } catch (e) {
    renderOk = false;
    break;
  }
}
assert('renderFrame at multiple timestamps', renderOk);

// --- Encoder timeout helper ---
import { getFfmpegEncodeTimeout } from '../src/export/encoder';
assert('encode timeout short song', getFfmpegEncodeTimeout(6) === 12_000);
assert('encode timeout medium song', getFfmpegEncodeTimeout(45) === 30_000);
assert('encode timeout long song', getFfmpegEncodeTimeout(120) === 90_000);

// --- Dist build artifacts ---
import { existsSync, readdirSync } from 'fs';
assert('dist/index.html exists', existsSync(join(__dir, '../dist/index.html')));
const assets = readdirSync(join(__dir, '../dist/assets')).filter((f) => f.startsWith('index-') && f.endsWith('.js'));
assert('dist has bundled js', assets.length > 0, assets.join(', '));

printSummary();

function printSummary() {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ${passed}/${results.length} passed`);
  if (failed.length) {
    console.log('  Failed:');
    failed.forEach((f) => console.log(`    - ${f.name}: ${f.detail}`));
    process.exit(1);
  }
  console.log('  ✅ All core tests passed\n');
}
