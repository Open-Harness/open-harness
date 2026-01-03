import type { Runtime } from "../runtime/runtime.js";

export interface Transport {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface WebSocketTransportOptions {
  port: number;
  path?: string;
}

export declare class WebSocketTransport implements Transport {
  constructor(runtime: Runtime, options: WebSocketTransportOptions);
  start(): Promise<void>;
  stop(): Promise<void>;
}
