// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/base.ts

import {
  PixelStreamingConfig,
  IPixelStreamingAdapter,
  ConnectionStatus,
  MCPCommand,
} from '../types';
import { mergeConfig } from '../config';
import { createLogger } from '../utils/logger';

/**
 * 状态变化回调
 */
export type StatusChangeCallback = (status: ConnectionStatus) => void;

/**
 * 适配器基类
 */
export abstract class BaseAdapter implements IPixelStreamingAdapter {
  protected config: Required<PixelStreamingConfig>;
  protected logger: ReturnType<typeof createLogger>;
  protected responseCallbacks: ((response: string) => void)[] = [];
  protected statusCallbacks: StatusChangeCallback[] = [];

  constructor(config: PixelStreamingConfig) {
    this.config = mergeConfig(config);
    this.logger = createLogger(
      this.getAdapterName(),
      this.config.logLevel
    );
  }

  protected abstract getAdapterName(): string;
  abstract connect(): Promise<void>;
  abstract disconnect(): void;
  abstract reconnect(): Promise<void>;
  abstract isConnected(): boolean;
  abstract getConnectionStatus(): ConnectionStatus;
  abstract sendCommand(command: MCPCommand): boolean;

  onResponse(callback: (response: string) => void): () => void {
    this.responseCallbacks.push(callback);
    return () => {
      const index = this.responseCallbacks.indexOf(callback);
      if (index > -1) {
        this.responseCallbacks.splice(index, 1);
      }
    };
  }

  onStatusChange(callback: StatusChangeCallback): () => void {
    this.statusCallbacks.push(callback);
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusCallbacks.splice(index, 1);
      }
    };
  }

  protected emitResponse(response: string): void {
    for (const callback of this.responseCallbacks) {
      try {
        callback(response);
      } catch (error) {
        this.logger.error('Response callback failed', error);
      }
    }
  }

  protected emitStatusChange(status: ConnectionStatus): void {
    for (const callback of this.statusCallbacks) {
      try {
        callback(status);
      } catch (error) {
        this.logger.error('Status change callback failed', error);
      }
    }
  }
}
