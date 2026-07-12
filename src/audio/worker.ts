import { analyzeAudio, type WorkerInput, type WorkerOutput } from './analyzer';
import { analyzeWithEssentia, initEssentiaEngine } from './essentia-engine';

let essentiaReady = false;

async function ensureEssentia(): Promise<boolean> {
  if (essentiaReady) return true;
  essentiaReady = await initEssentiaEngine();
  return essentiaReady;
}

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const input = e.data;
  let essentia = null;

  const ready = await ensureEssentia();
  if (ready) {
    essentia = analyzeWithEssentia(input.channelData, input.sampleRate);
  }

  const result = analyzeAudio(input, essentia);
  const transfer = [result.channelData.buffer];
  (self as unknown as Worker).postMessage(result, transfer);
};

export type { WorkerInput, WorkerOutput };
