import type { AudioFeatures, Beat, FlowType, MoodId, MoodProfile, Section, VibeType } from '../types';
import { MOODS } from '../types';
import type { EssentiaAnalysis } from './essentia-engine';

const HOP_SEC = 0.0232; // ~1024/44100

function mean(arr: Float32Array | number[]): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

function computeFeatures(channelData: Float32Array, sampleRate: number): AudioFeatures {
  const winSize = Math.floor(sampleRate * 0.0464);
  const hop = Math.floor(sampleRate * HOP_SEC);
  const frameCount = Math.floor((channelData.length - winSize) / hop);

  const energies = new Float32Array(frameCount);
  const spectralFlux = new Float32Array(frameCount);
  const spectralCentroid = new Float32Array(frameCount);
  const bassEnergy = new Float32Array(frameCount);

  let prevMag: number[] | null = null;

  for (let f = 0; f < frameCount; f++) {
    const off = f * hop;
    let rms = 0;
    const mags: number[] = [];
    let scNum = 0, scDen = 0, bass = 0;

    for (let i = 0; i < winSize; i++) {
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / winSize));
      const s = channelData[off + i] * w;
      rms += s * s;
      const bin = Math.floor((i / winSize) * 64);
      const mag = Math.abs(s);
      mags[bin] = (mags[bin] || 0) + mag;
      scNum += bin * mag;
      scDen += mag;
      if (bin < 8) bass += mag;
    }

    energies[f] = Math.sqrt(rms / winSize);
    spectralCentroid[f] = scDen > 0 ? scNum / scDen : 0;
    bassEnergy[f] = bass;

    let flux = 0;
    if (prevMag) {
      for (let b = 0; b < 64; b++) {
        const d = (mags[b] || 0) - (prevMag[b] || 0);
        if (d > 0) flux += d;
      }
    }
    spectralFlux[f] = flux;
    prevMag = mags;
  }

  return {
    energies,
    spectralFlux,
    spectralCentroid,
    bassEnergy,
    hopRate: 1 / HOP_SEC,
    frameCount,
  };
}

function detectBpm(
  flux: Float32Array,
  bassEnergy: Float32Array,
  energies: Float32Array,
  hopRate: number,
): number {
  const onset = new Float32Array(flux.length);
  for (let i = 1; i < flux.length; i++) {
    const bassFlux = Math.max(0, bassEnergy[i] - bassEnergy[i - 1]);
    onset[i] = flux[i] * 0.45 + bassFlux * 0.55;
  }

  const minBpm = 60;
  const maxBpm = 200;
  const minLag = Math.max(2, Math.floor((60 / maxBpm) * hopRate));
  const maxLag = Math.min(onset.length - 1, Math.ceil((60 / minBpm) * hopRate));

  const scores = new Map<number, number>();
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    const n = onset.length - lag;
    for (let i = 0; i < n; i++) corr += onset[i] * onset[i + lag];
    corr /= n;
    const bpm = (60 * hopRate) / lag;
    const rounded = Math.round(bpm);
    if (rounded < minBpm || rounded > maxBpm) continue;
    const prev = scores.get(rounded) ?? 0;
    scores.set(rounded, Math.max(prev, corr));
  }

  if (scores.size === 0) return 120;

  const candidates = new Set<number>();
  for (const bpm of scores.keys()) {
    candidates.add(bpm);
    if (bpm * 2 <= maxBpm) candidates.add(bpm * 2);
    if (bpm / 2 >= minBpm) candidates.add(Math.round(bpm / 2));
  }

  let bestBpm = 120;
  let bestScore = -1;
  for (const bpm of candidates) {
    if (bpm < minBpm || bpm > maxBpm) continue;
    const direct = scores.get(bpm) ?? 0;
    const half = scores.get(Math.round(bpm / 2)) ?? 0;
    const third = scores.get(Math.round(bpm * 2 / 3)) ?? 0;
    const score = direct + half * 0.55 + third * 0.35;
    const midBias = bpm >= 90 && bpm <= 150 ? 1.08 : 1;
    const weighted = score * midBias;
    if (weighted > bestScore) {
      bestScore = weighted;
      bestBpm = bpm;
    }
  }

  const iois = pickOnsetTimes(onset, hopRate);
  if (iois.length >= 4) {
    const hist = new Map<number, number>();
    for (let i = 1; i < Math.min(iois.length, 32); i++) {
      const ioi = iois[i] - iois[i - 1];
      if (ioi < 60 / maxBpm || ioi > 60 / minBpm) continue;
      const bpm = Math.round(60 / ioi);
      if (bpm >= minBpm && bpm <= maxBpm) {
        hist.set(bpm, (hist.get(bpm) ?? 0) + 1);
      }
    }
    let topBpm = 0;
    let topCount = 0;
    for (const [bpm, count] of hist) {
      if (count > topCount) { topCount = count; topBpm = bpm; }
    }
    if (topBpm > 0) {
      const acScore = scores.get(topBpm) ?? 0;
      const bestAc = scores.get(bestBpm) ?? 0;
      if (topCount >= 3 && acScore >= bestAc * 0.65) bestBpm = topBpm;
    }
  }

  return bestBpm;
}

function pickOnsetTimes(onset: Float32Array, hopRate: number): number[] {
  const thresh = mean(onset) * 1.25;
  const minGap = Math.floor(hopRate * 0.08);
  const times: number[] = [];
  let last = -minGap;
  for (let i = 2; i < onset.length - 2; i++) {
    if (
      onset[i] > thresh &&
      onset[i] > onset[i - 1] &&
      onset[i] >= onset[i + 1] &&
      i - last >= minGap
    ) {
      times.push(i / hopRate);
      last = i;
    }
  }
  return times;
}

function buildBeats(flux: Float32Array, energies: Float32Array, bpm: number, hopRate: number): Beat[] {
  const beatInt = 60 / bpm;
  const beats: Beat[] = [];
  const thresh = mean(flux) * 1.2;

  for (let t = 0; t < flux.length / hopRate; t += beatInt) {
    const frame = Math.floor(t * hopRate);
    let bestF = frame;
    let bestFlux = 0;
    const search = Math.floor(hopRate * 0.08);
    for (let f = Math.max(0, frame - search); f < Math.min(flux.length, frame + search); f++) {
      if (flux[f] > bestFlux) { bestFlux = flux[f]; bestF = f; }
    }
    beats.push({
      time: bestF / hopRate,
      energy: energies[bestF] || 0,
      strength: bestFlux > thresh ? 1 : 0.4,
    });
  }
  return beats;
}

function detectSections(features: AudioFeatures): Section[] {
  const { energies, spectralFlux, hopRate, frameCount } = features;
  const window = Math.max(8, Math.floor(frameCount / 16));
  const sections: Section[] = [];
  let start = 0;

  for (let i = window; i < frameCount; i += window) {
    const cur = energies.slice(i - window, i);
    const prev = energies.slice(Math.max(0, i - window * 2), i - window);
    const curE = mean(cur);
    const prevE = mean(prev);
    const novelty = Math.abs(curE - prevE) / Math.max(curE, prevE, 0.001);
    const fluxJump = mean(spectralFlux.slice(i - window, i)) - mean(spectralFlux.slice(Math.max(0, i - window * 2), i - window));

    if (novelty > 0.3 || fluxJump > mean(spectralFlux) * 0.5 || i >= frameCount - window) {
      sections.push({
        startFrame: start,
        endFrame: i,
        startTime: start / hopRate,
        endTime: i / hopRate,
        avgEnergy: mean(energies.slice(start, i)),
        novelty,
      });
      start = i;
    }
  }

  if (sections.length === 0) {
    sections.push({
      startFrame: 0,
      endFrame: frameCount,
      startTime: 0,
      endTime: frameCount / hopRate,
      avgEnergy: mean(energies),
      novelty: 0.5,
    });
  }

  const merged: Section[] = [];
  for (const s of sections) {
    const dur = s.endTime - s.startTime;
    if (merged.length > 0 && dur < 4) {
      const last = merged[merged.length - 1];
      last.endTime = s.endTime;
      last.endFrame = s.endFrame;
      last.avgEnergy = (last.avgEnergy + s.avgEnergy) / 2;
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

export function classifyMood(
  bpm: number,
  avgE: number,
  maxE: number,
  avgC: number,
  avgB: number,
  energies: Float32Array,
  essentia?: EssentiaAnalysis | null,
): MoodProfile {
  const tags: string[] = [];
  let key: MoodId = 'chill';
  let confidence = 0.6;

  if (bpm > 140) { key = 'energetic'; tags.push('快节奏', '高能量'); confidence = 0.85; }
  else if (bpm > 118) { key = 'urban'; tags.push('律动感强'); confidence = 0.75; }
  else if (bpm < 88) { key = 'melancholic'; tags.push('慢板', '沉浸'); confidence = 0.8; }
  else { key = 'peaceful'; tags.push('舒缓'); confidence = 0.7; }

  if (avgE > 0.08) {
    tags.push('饱满');
    if (key === 'peaceful' || key === 'melancholic') { key = 'intense'; confidence = 0.8; }
  }
  if (avgE < 0.03) { tags.push('轻柔'); key = 'dreamy'; confidence = 0.75; }
  if (avgC > 28) { tags.push('明亮'); }
  if (avgB > avgE * 400) { tags.push('低音重'); key = 'intense'; confidence = 0.82; }

  let variance = 0;
  for (let i = 0; i < energies.length; i++) variance += (energies[i] - avgE) ** 2;
  variance /= energies.length;
  if (variance > 0.001) tags.push('起伏大'); else tags.push('平稳');
  if (bpm > 100 && bpm < 128 && avgE < 0.06) { key = 'romantic'; tags.push('浪漫'); confidence = 0.78; }

  if (essentia) {
    const { tonal, dynamics } = essentia;
    tags.push(`${tonal.key} ${tonal.scale}`);
    if (tonal.scale === 'minor') {
      if (key === 'peaceful' || key === 'urban') { key = 'melancholic'; confidence = 0.82; }
      tags.push('小调');
    } else {
      tags.push('大调');
      if (dynamics.danceability > 1.2 && key === 'peaceful') { key = 'energetic'; confidence = 0.84; }
    }
    if (dynamics.danceability > 1.5) { tags.push('高律动'); if (key === 'peaceful') key = 'urban'; }
    if (dynamics.dynamicComplexity > 8) tags.push('动态强');
    confidence = Math.min(0.95, confidence + tonal.strength * 0.1 + essentia.rhythm.confidence * 0.05);
  }

  const base = MOODS[key];
  return { ...base, tags, confidence };
}

export function classifyFlow(beats: Beat[], essentia?: EssentiaAnalysis | null): FlowType {
  if (beats.length < 6) return 'steady';
  const diffs: number[] = [];
  for (let i = 1; i < Math.min(beats.length, 12); i++) {
    diffs.push(Math.abs(beats[i].energy - beats[i - 1].energy));
  }
  const avgDiff = mean(diffs);
  const intervals: number[] = [];
  for (let i = 1; i < Math.min(beats.length, 12); i++) {
    intervals.push(beats[i].time - beats[i - 1].time);
  }
  intervals.sort((a, b) => a - b);
  const iqr = intervals[Math.floor(intervals.length * 0.75)] - intervals[Math.floor(intervals.length * 0.25)];
  if (iqr > 0.08) return 'syncopated';
  if (essentia && essentia.dynamics.danceability > 1.4) return 'groovy';
  if (avgDiff > 0.04 || (essentia && essentia.dynamics.dynamicComplexity > 10)) return 'dynamic';
  if (avgDiff > 0.02) return 'groovy';
  return 'steady';
}

export function classifyVibe(
  centroid: Float32Array,
  energies: Float32Array,
  essentia?: EssentiaAnalysis | null,
): VibeType {
  const c = mean(centroid);
  const e = mean(energies);
  if (essentia) {
    if (essentia.dynamics.danceability > 1.6) return 'pulse';
    if (essentia.dynamics.loudness > 0.5 && essentia.dynamics.dynamicComplexity > 8) return 'fire';
    if (essentia.tonal.scale === 'minor' && e < 0.05) return 'haze';
  }
  if (c > 26 && e > 0.05) return 'glow';
  if (c < 14 && e < 0.04) return 'haze';
  if (e > 0.08) return 'fire';
  if (e > 0.05) return 'pulse';
  return 'mist';
}

export interface WorkerInput {
  channelData: Float32Array;
  sampleRate: number;
  duration: number;
}

export interface WorkerOutput {
  duration: number;
  sampleRate: number;
  channelData: Float32Array;
  bpm: number;
  beats: Beat[];
  sections: Section[];
  features: AudioFeatures;
  mood: MoodProfile;
  flow: FlowType;
  vibe: VibeType;
  avgEnergy: number;
  maxEnergy: number;
  engine: 'essentia' | 'local';
  key?: string;
  scale?: string;
  danceability?: number;
  rhythmConfidence?: number;
}

export function analyzeAudio(
  input: WorkerInput,
  essentia?: EssentiaAnalysis | null,
): WorkerOutput {
  const { channelData, sampleRate, duration } = input;
  const features = computeFeatures(channelData, sampleRate);

  const useEssentia = !!essentia;
  const bpm = useEssentia
    ? essentia.rhythm.bpm
    : detectBpm(features.spectralFlux, features.bassEnergy, features.energies, features.hopRate);

  const beats = useEssentia && essentia.rhythm.beats.length > 0
    ? essentia.rhythm.beats
    : buildBeats(features.spectralFlux, features.energies, bpm, features.hopRate);

  const sections = detectSections(features);

  const avgEnergy = mean(features.energies);
  const maxEnergy = Math.max(...features.energies);
  const mood = classifyMood(
    bpm, avgEnergy, maxEnergy,
    mean(features.spectralCentroid),
    mean(features.bassEnergy),
    features.energies,
    essentia,
  );
  const flow = classifyFlow(beats, essentia);
  const vibe = classifyVibe(features.spectralCentroid, features.energies, essentia);

  return {
    duration,
    sampleRate,
    channelData,
    bpm,
    beats,
    sections,
    features,
    mood,
    flow,
    vibe,
    avgEnergy,
    maxEnergy,
    engine: useEssentia ? 'essentia' : 'local',
    key: essentia?.tonal.key,
    scale: essentia?.tonal.scale,
    danceability: essentia?.dynamics.danceability,
    rhythmConfidence: essentia?.rhythm.confidence,
  };
}
