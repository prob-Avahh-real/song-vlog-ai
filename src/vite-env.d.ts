declare module 'essentia.js/dist/essentia.js-core.es.js' {
  export default class Essentia {
    constructor(wasm: unknown, isDebug?: boolean);
    arrayToVector(arr: Float32Array): unknown;
    vectorToArray(vec: unknown): Float32Array;
    RhythmExtractor2013(signal: unknown, maxTempo?: number, method?: string, minTempo?: number): {
      bpm: number; ticks: unknown; confidence: number;
    };
    KeyExtractor(audio: unknown, ...args: unknown[]): { key: string; scale: string; strength: number };
    Danceability(signal: unknown, maxTau?: number, minTau?: number, sampleRate?: number): { danceability: number };
    DynamicComplexity(signal: unknown, frameSize?: number, sampleRate?: number): { dynamicComplexity: number };
    Loudness(signal: unknown): { loudness: number };
    shutdown(): void;
    reinstantiate(): void;
  }
}

declare module 'essentia.js/dist/essentia-wasm.es.js' {
  export const EssentiaWASM: unknown;
}


interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface Window {
  SpeechRecognition: new () => SpeechRecognition;
  webkitSpeechRecognition: new () => SpeechRecognition;
}

interface DeviceOrientationEventConstructor {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

interface DeviceMotionEventConstructor {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

declare var DeviceOrientationEvent: DeviceOrientationEventConstructor & {
  new (type: string, eventInitDict?: DeviceOrientationEventInit): DeviceOrientationEvent;
};

declare var DeviceMotionEvent: DeviceMotionEventConstructor & {
  new (type: string, eventInitDict?: DeviceMotionEventInit): DeviceMotionEvent;
};
