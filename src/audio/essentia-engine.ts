import type { Beat } from '../types';

export interface EssentiaRhythm {
  bpm: number;
  beats: Beat[];
  confidence: number;
}

export interface EssentiaTonal {
  key: string;
  scale: string;
  strength: number;
}

export interface EssentiaDynamics {
  danceability: number;
  dynamicComplexity: number;
  loudness: number;
}

export interface EssentiaAnalysis {
  rhythm: EssentiaRhythm;
  tonal: EssentiaTonal;
  dynamics: EssentiaDynamics;
}

type EssentiaCore = {
  arrayToVector: (arr: Float32Array) => unknown;
  vectorToArray: (vec: unknown) => Float32Array;
  RhythmExtractor2013: (
    signal: unknown,
    maxTempo?: number,
    method?: string,
    minTempo?: number,
  ) => { bpm: number; ticks: unknown; confidence: number };
  KeyExtractor: (
    audio: unknown,
    averageDetuningCorrection?: boolean,
    frameSize?: number,
    hopSize?: number,
    hpcpSize?: number,
    maxFrequency?: number,
    maximumSpectralPeaks?: number,
    minFrequency?: number,
    pcpThreshold?: number,
    profileType?: string,
    sampleRate?: number,
  ) => { key: string; scale: string; strength: number };
  Danceability: (
    signal: unknown,
    maxTau?: number,
    minTau?: number,
    sampleRate?: number,
  ) => { danceability: number };
  DynamicComplexity: (
    signal: unknown,
    frameSize?: number,
    sampleRate?: number,
  ) => { dynamicComplexity: number };
  Loudness: (signal: unknown) => { loudness: number };
  shutdown: () => void;
  reinstantiate: () => void;
};

let engine: EssentiaCore | null = null;
let initPromise: Promise<boolean> | null = null;

export async function initEssentiaEngine(): Promise<boolean> {
  if (engine) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const [coreMod, wasmMod] = await Promise.all([
        import('essentia.js/dist/essentia.js-core.es.js'),
        import('essentia.js/dist/essentia-wasm.es.js'),
      ]);
      const Essentia = coreMod.default as new (wasm: unknown) => EssentiaCore;
      const EssentiaWASM = wasmMod.EssentiaWASM;
      engine = new Essentia(EssentiaWASM);
      return true;
    } catch (err) {
      console.warn('[Essentia] init failed, using local analyzer', err);
      engine = null;
      return false;
    }
  })();

  return initPromise;
}

export function isEssentiaReady(): boolean {
  return engine !== null;
}

export function analyzeWithEssentia(
  channelData: Float32Array,
  sampleRate: number,
): EssentiaAnalysis | null {
  if (!engine) return null;

  try {
    engine.reinstantiate();
    const signal = engine.arrayToVector(channelData);

    const rhythm = engine.RhythmExtractor2013(signal, 200, 'multifeature', 60);
    const tickArr = engine.vectorToArray(rhythm.ticks);
    const conf = rhythm.confidence ?? 0.5;
    const beats: Beat[] = [];
    for (let i = 0; i < tickArr.length; i++) {
      beats.push({ time: tickArr[i], energy: 0.5, strength: conf });
    }

    const tonal = engine.KeyExtractor(
      signal, true, 4096, 4096, 12,
      3500, 60, 25, 0.2, 'edma', sampleRate,
    );

    const dance = engine.Danceability(signal, 8800, 310, sampleRate);
    const dyn = engine.DynamicComplexity(signal, 0.2, sampleRate);
    const loud = engine.Loudness(signal);

    engine.shutdown();

    return {
      rhythm: {
        bpm: Math.round(rhythm.bpm),
        beats,
        confidence: conf,
      },
      tonal: {
        key: tonal.key || 'C',
        scale: tonal.scale || 'major',
        strength: tonal.strength ?? 0,
      },
      dynamics: {
        danceability: dance.danceability ?? 0,
        dynamicComplexity: dyn.dynamicComplexity ?? 0,
        loudness: loud.loudness ?? 0,
      },
    };
  } catch (err) {
    console.warn('[Essentia] analysis failed', err);
    try { engine.shutdown(); engine.reinstantiate(); } catch { /* */ }
    return null;
  }
}
