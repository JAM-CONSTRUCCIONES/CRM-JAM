declare module 'opus-media-recorder' {
  type WorkerOptions = {
    encoderWorkerFactory?: () => Worker;
    OggOpusEncoderWasmPath?: string;
    WebMOpusEncoderWasmPath?: string;
  };

  export default class OpusMediaRecorder extends EventTarget {
    constructor(stream: MediaStream, options?: MediaRecorderOptions, workerOptions?: WorkerOptions);
    readonly state: RecordingState;
    readonly stream: MediaStream;
    ondataavailable: ((event: BlobEvent) => void) | null;
    onstop: ((event: Event) => void) | null;
    start(timeslice?: number): void;
    stop(): void;
    pause(): void;
    resume(): void;
    requestData(): void;
    static isTypeSupported(type: string): boolean;
  }
}
