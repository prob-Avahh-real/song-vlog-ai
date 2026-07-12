import type { SongAnalysis } from '../types';
import type { WorkerOutput } from './analyzer';

export function runAudioAnalysis(
  channelData: Float32Array,
  sampleRate: number,
  duration: number,
  onProgress?: (msg: string) => void,
): Promise<SongAnalysis> {
  return new Promise((resolve, reject) => {
    onProgress?.('启动音频分析 Worker…');
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e: MessageEvent<WorkerOutput>) => {
      worker.terminate();
      resolve(e.data as SongAnalysis);
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    worker.postMessage(
      { channelData, sampleRate, duration },
      [channelData.buffer],
    );
  });
}
