// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/utils/sse-client.ts

import { MCPCommand, MCPResponse } from '../types';
import { Logger, createLogger } from './logger';
import { TIMEOUTS, RECONNECT, calculateReconnectDelay } from '../constants';

/**
 * Connection confirmation data
 */
interface ConnectionConfirmation {
  clientId: string;
}

/**
 * Callback for handling MCP commands
 */
export type MCPCommandCallback = (command: MCPCommand) => void;

/**
 * Callbacks for SSE client events
 */
export interface SSEClientCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
  onCommandReceived?: (command: MCPCommand) => void;
}

/**
 * SSEClient - Manages SSE connection to MCP Bridge
 *
 * Features:
 * - Connects to SSE endpoint at `${url}/events`
 * - Handles connection confirmation with clientId
 * - Handles heartbeat ping/pong
 * - Receives MCP commands and forwards to callback
 * - Sends responses to MCP Bridge via POST `/response`
 * - Supports reconnection with exponential backoff
 */
export class SSEClient {
  private readonly url: string;
  private readonly logger: Logger;
  private readonly callbacks: SSEClientCallbacks;
  private readonly reconnect: boolean;
  private readonly reconnectMaxAttempts: number;
  private readonly reconnectBaseDelay: number;
  private readonly reconnectMaxDelay: number;

  private eventSource: EventSource | null = null;
  private clientId: string | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;  // 主动心跳发送定时器
  private intentionallyClosed = false;
  private pendingConnect: { resolve: () => void; reject: (err: Error) => void } | null = null;
  private maxReconnectsReached = false;  // 标记是否已达到最大重连次数

  constructor(url: string, callbacks: SSEClientCallbacks = {}) {
    this.url = url.replace(/\/$/, ''); // Remove trailing slash
    this.callbacks = callbacks;
    this.reconnect = true;
    this.reconnectMaxAttempts = RECONNECT.MAX_ATTEMPTS;
    this.reconnectBaseDelay = RECONNECT.BASE_DELAY;
    this.reconnectMaxDelay = RECONNECT.MAX_DELAY;
    this.logger = createLogger('SSEClient', 'info');
  }

  /**
   * Connect to the SSE endpoint
   */
  connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.eventSource) {
        this.logger.warn('Already connected or connecting');
        resolve();
        return;
      }

      this.intentionallyClosed = false;
      const eventsUrl = `${this.url}/events`;
      this.logger.info(`Connecting to SSE endpoint: ${eventsUrl}`);

      // Store resolve/reject for use in handleConnected
      this.pendingConnect = { resolve, reject };

      try {
        this.eventSource = new EventSource(eventsUrl);

        // Connection opened
        this.eventSource.onopen = () => {
          this.logger.debug('EventSource connection opened');
          this.resetHeartbeatTimeout();
        };

        // Handle generic errors
        this.eventSource.onerror = (event: Event) => {
          this.logger.error('EventSource error', event);

          if (!this.connected && !this.clientId && this.pendingConnect) {
            // Connection failed during initial connect
            this.pendingConnect.reject(new Error('Failed to connect to SSE endpoint'));
            this.pendingConnect = null;
          }

          this.handleDisconnect();
        };

        // Handle all messages - MCP Bridge sends messages without event type
        // The message type is determined by the "type" field in the JSON data
        this.eventSource.onmessage = (event: MessageEvent) => {
          this.handleMessage(event, resolve);
        };

      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error('Failed to create EventSource', err);
        this.pendingConnect = null;
        reject(err);
      }
    });
  }

  /**
   * Disconnect from the SSE endpoint
   */
  disconnect(): void {
    this.logger.info('Disconnecting...');
    this.intentionallyClosed = true;
    this.cleanup();
    this.callbacks.onDisconnected?.();
  }

  /**
   * Check if connected to SSE endpoint
   */
  isConnected(): boolean {
    return this.connected && this.eventSource !== null;
  }

  /**
   * Get the client ID assigned by MCP Bridge
   */
  getClientId(): string | null {
    return this.clientId;
  }

  /**
   * Send response to MCP Bridge
   */
  async sendResponse(response: MCPResponse): Promise<void> {
    if (!this.clientId) {
      throw new Error('Not connected: no client ID');
    }

    const responseUrl = `${this.url}/response`;
    this.logger.info('Sending response to MCP Bridge', { commandId: response.commandId, result: response.result });

    try {
      const httpResponse = await fetch(responseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': this.clientId,
        },
        body: JSON.stringify(response),
      });

      if (!httpResponse.ok) {
        throw new Error(`HTTP ${httpResponse.status}: ${httpResponse.statusText}`);
      }

      this.logger.info('Response sent successfully to MCP Bridge', { commandId: response.commandId });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to send response', err);
      this.callbacks.onError?.(err.message);
      throw err;
    }
  }

  /**
   * Handle all incoming SSE messages
   * MCP Bridge sends messages without event type, using "type" field in JSON
   */
  private handleMessage(event: MessageEvent, resolve: () => void): void {
    try {
      const data = JSON.parse(event.data);

      // Determine message type from the "type" field
      const messageType = data.type;

      switch (messageType) {
        case 'connected':
          this.handleConnected(data, event, resolve);
          break;
        case 'ping':
          this.handlePing();
          break;
        default:
          // If no type or unknown type, treat as MCP command
          // MCP commands don't have a "type" field, they have "commandId"
          if (data.commandId) {
            this.handleMCPCommand(event);
          } else {
            this.logger.debug('Received unknown message type', data);
          }
          break;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to parse SSE message', err);
    }
  }

  /**
   * Handle connection confirmation message
   */
  private handleConnected(data: ConnectionConfirmation & { message?: string }, _event: MessageEvent, resolve: () => void): void {
    this.clientId = data.clientId;
    this.connected = true;
    this.reconnectAttempts = 0;
    this.maxReconnectsReached = false;  // 连接成功后重置最大重连标记
    this.pendingConnect = null;

    this.logger.info(`Connected with clientId: ${this.clientId}${data.message ? ` - ${data.message}` : ''}`);
    this.resetHeartbeatTimeout();
    this.startHeartbeat();  // 启动主动心跳
    this.callbacks.onConnected?.();
    resolve();
  }

  /**
   * Handle heartbeat ping
   */
  private handlePing(): void {
    this.logger.debug('Received ping, resetting heartbeat timeout');
    this.resetHeartbeatTimeout();
  }

  /**
   * Start sending heartbeat to server
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(async () => {
      if (!this.clientId || !this.connected) {
        return;
      }

      try {
        const heartbeatUrl = `${this.url}/heartbeat`;
        const response = await fetch(heartbeatUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ clientId: this.clientId }),
        });

        if (response.ok) {
          this.logger.debug('Heartbeat sent successfully');
        } else {
          this.logger.warn('Heartbeat failed:', response.status);
        }
      } catch (error) {
        this.logger.warn('Failed to send heartbeat:', error);
      }
    }, TIMEOUTS.SSE_HEARTBEAT_INTERVAL);
  }

  /**
   * Stop sending heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Handle MCP command message
   */
  private handleMCPCommand(event: MessageEvent): void {
    try {
      const command = JSON.parse(event.data) as MCPCommand;
      this.logger.debug('Received MCP command', { commandId: command.commandId });

      if (this.callbacks.onCommandReceived) {
        try {
          this.callbacks.onCommandReceived(command);
        } catch (callbackError) {
          const err = callbackError instanceof Error ? callbackError : new Error(String(callbackError));
          this.logger.error('Error in command callback', err);
          this.callbacks.onError?.(err.message);
        }
      }
    } catch (parseError) {
      const err = parseError instanceof Error ? parseError : new Error(String(parseError));
      this.logger.error('Failed to parse MCP command', err);
      this.callbacks.onError?.(err.message);
    }
  }

  /**
   * Handle disconnection and attempt reconnection
   */
  private handleDisconnect(): void {
    const wasConnected = this.connected;
    this.connected = false;

    this.clearHeartbeatTimeout();

    if (wasConnected) {
      this.logger.info('Disconnected from SSE endpoint');
      this.callbacks.onDisconnected?.();
    }

    // Attempt reconnection if not intentionally closed AND not exceeded max attempts
    if (this.reconnect && !this.intentionallyClosed && !this.maxReconnectsReached) {
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.reconnectMaxAttempts) {
      this.logger.error(`Max reconnection attempts (${this.reconnectMaxAttempts}) reached`);
      this.maxReconnectsReached = true;  // 标记已达到最大重连次数
      this.callbacks.onError?.('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.calculateReconnectDelay();

    this.logger.info(
      `Attempting reconnection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.reconnectMaxAttempts})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.cleanupEventSource();
      this.connect().catch((error) => {
        this.logger.error('Reconnection failed', error);
        // Error handling will trigger another reconnection attempt via onerror
      });
    }, delay);
  }

  /**
   * Calculate reconnection delay with exponential backoff and jitter
   */
  private calculateReconnectDelay(): number {
    return calculateReconnectDelay(
      this.reconnectAttempts,
      this.reconnectBaseDelay,
      this.reconnectMaxDelay
    );
  }

  /**
   * Reset heartbeat timeout
   */
  private resetHeartbeatTimeout(): void {
    this.clearHeartbeatTimeout();

    this.heartbeatTimeout = setTimeout(() => {
      this.logger.warn('Heartbeat timeout - connection may be stale');
      this.handleDisconnect();
    }, TIMEOUTS.SSE_HEARTBEAT);
  }

  /**
   * Clear heartbeat timeout
   */
  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Cleanup EventSource only (keep state for reconnection)
   */
  private cleanupEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Full cleanup of all resources
   */
  private cleanup(): void {
    this.clearHeartbeatTimeout();
    this.stopHeartbeat();  // 停止心跳发送

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.cleanupEventSource();
    this.connected = false;
    this.clientId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectsReached = false;  // 重置最大重连标记
  }
}
