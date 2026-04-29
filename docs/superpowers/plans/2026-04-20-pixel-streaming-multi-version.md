# 多版本像素流服务实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现支持 UE 4.26 - UE 5.7 全版本的多版本像素流服务，使用适配器模式统一接口

**Architecture:** 采用适配器模式（Adapter Pattern），通过统一的 IPixelStreamingAdapter 接口封装不同版本 UE 的像素流实现。ModernAdapter 使用 npm 库，LegacyAdapter 使用传统脚本，SimulateAdapter 用于测试

**Tech Stack:** TypeScript, Vue 3, @epicgames-ps/lib-pixelstreamingfrontend-ue5.X 库, SSE, WebRTC

---

## 文件结构映射

```
E:/Git/claude/chat/
├── src/
│   └── components/
│       └── qwenpaw-chat/
│           └── src/
│               └── pixelstreaming/          # 新建目录
│                   ├── index.ts
│                   ├── types.ts
│                   ├── config.ts
│                   ├── version-detect.ts
│                   ├── service.ts
│                   ├── adapters/
│                   │   ├── index.ts
│                   │   ├── base.ts
│                   │   ├── modern.ts
│                   │   ├── legacy.ts
│                   │   └── simulate.ts
│                   └── utils/
│                       ├── logger.ts
│                       └── sse-client.ts
├── public/
│   └── libs/                                # 新建目录，存放 legacy 脚本
│       ├── webRtcPlayer.js                  # 从 ps_server 复制
│       └── app.js                           # 从 ps_server 复制
└── package.json                             # 修改，添加 npm 依赖
```

---

## Task 1: 创建类型定义文件

**Files:**
- Create: `E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/types.ts`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters
mkdir -p E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/utils
mkdir -p E:/Git/claude/chat/public/libs
```

- [ ] **Step 2: 编写 types.ts**

```typescript
// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/types.ts

/**
 * UE 版本枚举
 */
export type UEVersion = '4.26' | '4.27' | '5.0' | '5.1' | '5.2' | '5.3' | '5.4' | '5.5' | '5.6' | '5.7';

/**
 * 协议版本到 UE 版本的映射
 */
export const PROTOCOL_VERSION_MAP: Record<string, UEVersion> = {
  '1.0': '4.26',
  '1.1': '4.27',
  '2.0': '5.0',
  '2.1': '5.1',
  '3.0': '5.2',
  '3.1': '5.3',
  '3.2': '5.4',
  '3.3': '5.5',
  '3.4': '5.6',
  '3.5': '5.7',
};

/**
 * 鼠标交互配置
 */
export interface MouseInteractionConfig {
  HoveringMouse?: boolean;         // 悬停鼠标模式，默认 false
  FakeMouseWithTouches?: boolean;  // 触摸模拟鼠标，默认 false
  HideBrowserCursor?: boolean;     // 隐藏浏览器光标，默认 false
}

/**
 * 像素流配置
 */
export interface PixelStreamingConfig {
  // 连接配置
  signallingUrl: string;           // 信令服务器地址，如 ws://localhost:8888
  mcpBridgeUrl: string;            // MCP Bridge HTTP 地址，如 http://localhost:8080
  videoContainer: HTMLElement;     // 视频容器元素
  
  // UE 版本（可选，不设置则自动检测）
  ueVersion?: UEVersion;
  
  // 连接超时配置
  connectionTimeout?: number;      // 连接超时（毫秒），默认 30000
  commandTimeout?: number;         // 命令超时（毫秒），默认 30000
  
  // 视频配置
  autoPlayVideo?: boolean;         // 自动播放视频，默认 true
  initialSettings?: {
    AutoConnect?: boolean;         // 自动连接，默认 false
    AutoPlayVideo?: boolean;       // 自动播放，默认 true
    StartVideoMuted?: boolean;     // 静音开始，默认 true
    UseMic?: boolean;              // 使用麦克风，默认 false
    UseCamera?: boolean;           // 使用摄像头，默认 false
  };
  
  // 鼠标交互配置
  mouseInteraction?: MouseInteractionConfig;
  
  // 调试配置
  debugMode?: boolean;             // 调试模式，默认 false
  logLevel?: 'debug' | 'info' | 'warn' | 'error';  // 日志级别
  
  // 模拟模式（用于测试）
  simulateMode?: boolean;          // 模拟模式，默认 false
}

/**
 * MCP 命令格式
 */
export interface MCPCommand {
  commandId: string;
  category: string;
  action_name: string;
  action_data: Record<string, unknown>;
}

/**
 * MCP 响应格式
 */
export interface MCPResponse {
  commandId: string;
  result?: unknown;
  error?: string;
}

/**
 * 连接状态
 */
export interface ConnectionStatus {
  pixelStreaming: boolean;
  sse: boolean;
}

/**
 * 事件回调
 */
export interface PixelStreamingCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onVideoReady?: () => void;
  onError?: (error: string) => void;
  onCommandReceived?: (command: MCPCommand) => void;
  onResponseSent?: (response: MCPResponse) => void;
  onVersionDetected?: (version: UEVersion) => void;
}

/**
 * 适配器接口
 */
export interface IPixelStreamingAdapter {
  // 生命周期
  connect(): Promise<void>;
  disconnect(): void;
  reconnect(): void;
  
  // 状态
  isConnected(): boolean;
  getConnectionStatus(): ConnectionStatus;
  
  // 命令发送
  sendCommand(command: MCPCommand): boolean;
  
  // 事件监听
  onResponse(callback: (response: string) => void): void;
}
```

- [ ] **Step 3: 验证文件创建成功**

```bash
ls -la E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/types.ts
```

---

## Task 2: 创建日志工具

**Files:**
- Create: `E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/utils/logger.ts`

- [ ] **Step 1: 编写 logger.ts**

```typescript
// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/utils/logger.ts

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private context: string;
  private level: LogLevel;

  constructor(context: string, level: LogLevel = 'info') {
    this.context = context;
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}`;
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), data ?? '');
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), data ?? '');
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), data ?? '');
    }
  }

  error(message: string, error?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), error ?? '');
    }
  }
}

export function createLogger(context: string, level: LogLevel = 'info'): Logger {
  return new Logger(context, level);
}
```

---

## Task 3: 创建 SSE 客户端

**Files:**
- Create: `E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/utils/sse-client.ts`

- [ ] **Step 1: 编写 sse-client.ts**

```typescript
// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/utils/sse-client.ts

import { MCPCommand, MCPResponse } from '../types';
import { Logger, createLogger } from './logger';

export interface SSEClientCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
  onCommandReceived?: (command: MCPCommand) => void;
}

export class SSEClient {
  private url: string;
  private eventSource: EventSource | null = null;
  private callbacks: SSEClientCallbacks;
  private logger: Logger;
  private clientId: string | null = null;
  private heartbeatInterval: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(url: string, callbacks: SSEClientCallbacks = {}) {
    this.url = url;
    this.callbacks = callbacks;
    this.logger = createLogger('SSEClient');
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sseUrl = `${this.url}/events`;
      this.logger.info(`Connecting to SSE: ${sseUrl}`);

      this.eventSource = new EventSource(sseUrl);

      this.eventSource.onopen = () => {
        this.logger.info('SSE connected');
        this.reconnectAttempts = 0;
        this.callbacks.onConnected?.();
        this.startHeartbeat();
        resolve();
      };

      this.eventSource.onerror = (event) => {
        this.logger.error('SSE connection error', event);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          this.logger.info(`Reconnecting... (attempt ${this.reconnectAttempts})`);
          setTimeout(() => this.reconnect(), 1000 * this.reconnectAttempts);
        } else {
          this.callbacks.onError?.('SSE connection failed after max attempts');
          reject(new Error('SSE connection failed'));
        }
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (err) {
          this.logger.error('Failed to parse SSE message', err);
        }
      };
    });
  }

  private handleMessage(data: unknown): void {
    const msg = data as { type?: string; clientId?: string };

    // 连接确认消息
    if (msg.type === 'connected') {
      this.clientId = msg.clientId || null;
      this.logger.info(`SSE connection confirmed, clientId: ${this.clientId}`);
      return;
    }

    // 心跳 ping
    if (msg.type === 'ping') {
      this.sendHeartbeatPong();
      return;
    }

    // 命令消息
    const command = data as MCPCommand;
    if (command.commandId && command.category && command.action_name) {
      this.logger.info('Received command from MCP Bridge:', command);
      this.callbacks.onCommandReceived?.(command);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      // 心跳由外部处理
    }, 30000);
  }

  private async sendHeartbeatPong(): Promise<void> {
    if (!this.clientId) {
      this.logger.debug('No clientId, skipping heartbeat');
      return;
    }

    try {
      const response = await fetch(`${this.url}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pong',
          clientId: this.clientId,
          timestamp: Date.now(),
        }),
      });

      if (response.ok) {
        this.logger.debug(`Heartbeat pong sent for client ${this.clientId}`);
      }
    } catch (err) {
      this.logger.error('Failed to send heartbeat pong:', err);
    }
  }

  async sendResponse(response: MCPResponse): Promise<void> {
    try {
      const res = await fetch(`${this.url}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      });

      if (res.ok) {
        this.logger.debug('Response sent to MCP Bridge:', response);
      } else {
        this.logger.error(`Failed to send response: ${res.status}`);
      }
    } catch (err) {
      this.logger.error('Error sending response to MCP Bridge:', err);
    }
  }

  disconnect(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.clientId = null;
    this.callbacks.onDisconnected?.();
    this.logger.info('SSE disconnected');
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  getClientId(): string | null {
    return this.clientId;
  }
}
```

---

## Task 4: 创建配置默认值文件

**Files:**
- Create: `E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/config.ts`

- [ ] **Step 1: 编写 config.ts**

```typescript
// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/config.ts

import { PixelStreamingConfig } from './types';

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: Required<PixelStreamingConfig> = {
  signallingUrl: '',
  mcpBridgeUrl: '',
  videoContainer: document.body,
  ueVersion: undefined,
  connectionTimeout: 30000,
  commandTimeout: 30000,
  autoPlayVideo: true,
  initialSettings: {
    AutoConnect: false,
    AutoPlayVideo: true,
    StartVideoMuted: true,
    UseMic: false,
    UseCamera: false,
  },
  mouseInteraction: {
    HoveringMouse: false,
    FakeMouseWithTouches: false,
    HideBrowserCursor: false,
  },
  debugMode: false,
  logLevel: 'info',
  simulateMode: false,
};

/**
 * 合并用户配置与默认配置
 */
export function mergeConfig(userConfig: PixelStreamingConfig): Required<PixelStreamingConfig> {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    initialSettings: {
      ...DEFAULT_CONFIG.initialSettings,
      ...userConfig.initialSettings,
    },
    mouseInteraction: {
      ...DEFAULT_CONFIG.mouseInteraction,
      ...userConfig.mouseInteraction,
    },
  };
}

/**
 * 获取指定 UE 版本的 npm 包名
 */
export function getNpmPackageForVersion(version: string): string {
  const majorVersion = version.split('.')[0];
  if (majorVersion === '5' && parseInt(version.split('.')[1]) >= 2) {
    return `@epicgames-ps/lib-pixelstreamingfrontend-ue${version}`;
  }
  // 默认使用 ue5.4
  return '@epicgames-ps/lib-pixelstreamingfrontend-ue5.4';
}
```

---

## Task 5: 创建适配器基类

**Files:**
- Create: `E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/base.ts`

- [ ] **Step 1: 编写 base.ts**

```typescript
// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/base.ts

import {
  PixelStreamingConfig,
  IPixelStreamingAdapter,
  ConnectionStatus,
  MCPCommand,
  Logger,
} from '../types';
import { createLogger } from '../utils/logger';

/**
 * 适配器基类
 */
export abstract class BaseAdapter implements IPixelStreamingAdapter {
  protected config: Required<PixelStreamingConfig>;
  protected logger: Logger;
  protected responseCallbacks: ((response: string) => void)[] = [];

  constructor(config: PixelStreamingConfig) {
    // 简单实现，实际会从 config.ts 导入 mergeConfig
    this.config = config as Required<PixelStreamingConfig>;
    this.logger = createLogger(
      this.getAdapterName(),
      this.config.logLevel
    );
  }

  /**
   * 获取适配器名称（子类实现）
   */
  protected abstract getAdapterName(): string;

  /**
   * 连接实现（子类实现）
   */
  abstract connect(): Promise<void>;

  /**
   * 断开连接实现（子类实现）
   */
  abstract disconnect(): void;

  /**
   * 重连实现（子类实现）
   */
  abstract reconnect(): void;

  /**
   * 是否已连接（子类实现）
   */
  abstract isConnected(): boolean;

  /**
   * 获取连接状态（子类实现）
   */
  abstract getConnectionStatus(): ConnectionStatus;

  /**
   * 发送命令实现（子类实现）
   */
  abstract sendCommand(command: MCPCommand): boolean;

  /**
   * 注册响应回调
   */
  onResponse(callback: (response: string) => void): void {
    this.responseCallbacks.push(callback);
  }

  /**
   * 触发响应回调
   */
  protected emitResponse(response: string): void {
    for (const callback of this.responseCallbacks) {
      callback(response);
    }
  }
}
```

---

## Task 6: 创建 Modern 适配器（UE 5.2-5.7）

**Files:**
- Create: `E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/modern.ts`

- [ ] **Step 1: 编写 modern.ts**

```typescript
// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/modern.ts

import { PixelStreaming, Config } from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.4';
import { BaseAdapter } from './base';
import { PixelStreamingConfig, ConnectionStatus, MCPCommand } from '../types';

/**
 * Modern 适配器（UE 5.2-5.7）
 * 使用 @epicgames-ps/lib-pixelstreamingfrontend 库
 */
export class ModernAdapter extends BaseAdapter {
  private pixelStreaming: PixelStreaming | null = null;
  private connected = false;

  constructor(config: PixelStreamingConfig) {
    super(config);
  }

  protected getAdapterName(): string {
    return 'ModernAdapter';
  }

  async connect(): Promise<void> {
    this.logger.info('Connecting with ModernAdapter (UE 5.2+)');

    try {
      const config = new Config({
        initialSettings: {
          AutoConnect: this.config.initialSettings.AutoConnect,
          AutoPlayVideo: this.config.initialSettings.AutoPlayVideo,
          StartVideoMuted: this.config.initialSettings.StartVideoMuted,
          UseMic: this.config.initialSettings.UseMic,
          UseCamera: this.config.initialSettings.UseCamera,
        },
      });

      this.pixelStreaming = new PixelStreaming(config, {
        videoElementParent: this.config.videoContainer,
      });

      // 设置信令服务器地址
      this.pixelStreaming.setSignallingUrlBuilder(() => this.config.signallingUrl);

      // 监听连接事件
      this.pixelStreaming.addEventListener('dataChannelOpen', () => {
        this.connected = true;
        this.logger.info('DataChannel opened');
      });

      this.pixelStreaming.addEventListener('dataChannelClose', () => {
        this.connected = false;
        this.logger.info('DataChannel closed');
      });

      this.pixelStreaming.addEventListener('videoInitialized', () => {
        this.logger.info('Video initialized');
      });

      // 监听 UE 响应
      this.pixelStreaming.addResponseEventListener('mcp-response-handler', (response: string) => {
        this.logger.debug('Received response from UE5:', response);
        this.emitResponse(response);
      });

      // 连接
      this.pixelStreaming.connect();
      this.connected = true;
      this.logger.info('ModernAdapter connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect with ModernAdapter', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.pixelStreaming) {
      this.pixelStreaming.disconnect();
      this.pixelStreaming = null;
    }
    this.connected = false;
    this.logger.info('ModernAdapter disconnected');
  }

  reconnect(): void {
    this.disconnect();
    this.connect();
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionStatus(): ConnectionStatus {
    return {
      pixelStreaming: this.connected,
      sse: false, // SSE 由 service 层管理
    };
  }

  sendCommand(command: MCPCommand): boolean {
    if (!this.pixelStreaming || !this.connected) {
      this.logger.warn('Cannot send command: not connected');
      return false;
    }

    const ue5Command = {
      commandId: command.commandId,
      category: command.category,
      action_name: command.action_name,
      action_data: command.action_data,
    };

    this.logger.info('Sending command to UE5:', ue5Command);
    return this.pixelStreaming.emitUIInteraction(ue5Command);
  }
}
```

---

## Task 7: 创建 Legacy 适配器（UE 4.26-5.1）

**Files:**
- Create: `E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/legacy.ts`

- [ ] **Step 1: 编写 legacy.ts**

```typescript
// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/legacy.ts

import { BaseAdapter } from './base';
import { PixelStreamingConfig, ConnectionStatus, MCPCommand } from '../types';

/**
 * Legacy 适配器（UE 4.26-5.1）
 * 使用 webRtcPlayer.js 和 app.js
 */
export class LegacyAdapter extends BaseAdapter {
  private webrtcPlayer: any = null;
  private connected = false;
  private ws: WebSocket | null = null;

  constructor(config: PixelStreamingConfig) {
    super(config);
  }

  protected getAdapterName(): string {
    return 'LegacyAdapter';
  }

  async connect(): Promise<void> {
    this.logger.info('Connecting with LegacyAdapter (UE 4.26-5.1)');

    // 动态加载 webRtcPlayer.js
    await this.loadScript('/libs/webRtcPlayer.js');

    try {
      // 使用传统 WebRTC 方式连接
      await this.connectWebRTC();
      this.connected = true;
      this.logger.info('LegacyAdapter connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect with LegacyAdapter', error);
      throw error;
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  private connectWebRTC(): Promise<void> {
    return new Promise((resolve, reject) => {
      const signalingUrl = this.config.signallingUrl.replace('ws', 'http');
      
      this.ws = new WebSocket(this.config.signallingUrl);

      this.ws.onopen = () => {
        this.logger.info('WebSocket connected');
        
        // 发送配置请求
        this.ws?.send(JSON.stringify({
          type: 'request',
          request: 'configure',
          settings: {
            fps: 60,
            // 鼠标交互设置
            HoveringMouse: this.config.mouseInteraction.HoveringMouse,
            FakeMouseWithTouches: this.config.mouseInteraction.FakeMouseWithTouches,
            HideBrowserCursor: this.config.mouseInteraction.HideBrowserCursor,
          },
        }));
      };

      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event.data);
      };

      this.ws.onerror = (error) => {
        this.logger.error('WebSocket error', error);
        reject(error);
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.logger.info('WebSocket closed');
      };

      // 模拟连接成功（实际需要等待 ICE 连接建立）
      setTimeout(() => resolve(), 1000);
    });
  }

  private handleWebSocketMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      // 处理各种消息类型
      if (message.type === 'response') {
        // 处理响应
      } else if (message.type === 'iceCandidate') {
        // 处理 ICE candidate
      }
      
      this.emitResponse(data);
    } catch (error) {
      this.logger.error('Failed to parse WebSocket message', error);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.logger.info('LegacyAdapter disconnected');
  }

  reconnect(): void {
    this.disconnect();
    this.connect();
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionStatus(): ConnectionStatus {
    return {
      pixelStreaming: this.connected,
      sse: false,
    };
  }

  sendCommand(command: MCPCommand): boolean {
    if (!this.ws || !this.connected) {
      this.logger.warn('Cannot send command: not connected');
      return false;
    }

    const ueCommand = {
      commandId: command.commandId,
      category: command.category,
      action_name: command.action_name,
      action_data: command.action_data,
    };

    this.logger.info('Sending command to UE (legacy):', ueCommand);
    
    this.ws.send(JSON.stringify({
      type: 'uiInteraction',
      ...ueCommand,
    }));
    
    return true;
  }
}
```

---

## Task 8: 创建 Simulate 适配器（测试用）

**Files:**
- Create: `E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/simulate.ts`

- [ ] **Step 1: 编写 simulate.ts**

```typescript
// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/simulate.ts

import { BaseAdapter } from './base';
import { PixelStreamingConfig, ConnectionStatus, MCPCommand } from '../types';

/**
 * Simulate 适配器（测试用）
 * 返回模拟响应，不实际连接
 */
export class SimulateAdapter extends BaseAdapter {
  private connected = false;
  private commandQueue: MCPCommand[] = [];

  constructor(config: PixelStreamingConfig) {
    super(config);
  }

  protected getAdapterName(): string {
    return 'SimulateAdapter';
  }

  async connect(): Promise<void> {
    this.logger.info('Connecting with SimulateAdapter (test mode)');
    
    // 模拟连接延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    this.connected = true;
    this.logger.info('SimulateAdapter connected successfully');
  }

  disconnect(): void {
    this.connected = false;
    this.commandQueue = [];
    this.logger.info('SimulateAdapter disconnected');
  }

  reconnect(): void {
    this.disconnect();
    this.connect();
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionStatus(): ConnectionStatus {
    return {
      pixelStreaming: this.connected,
      sse: this.connected,
    };
  }

  sendCommand(command: MCPCommand): boolean {
    if (!this.connected) {
      this.logger.warn('Cannot send command: not connected');
      return false;
    }

    this.logger.info('Simulating command:', command);
    
    // 记录命令到队列
    this.commandQueue.push(command);
    
    // 模拟延迟后返回响应
    setTimeout(() => {
      const response = JSON.stringify({
        commandId: command.commandId,
        result: {
          simulated: true,
          action: command.action_name,
          data: command.action_data,
        },
      });
      this.emitResponse(response);
      this.logger.debug('Simulated response sent');
    }, 100);
    
    return true;
  }
}
```

---

## Task 9: 创建适配器工厂

**Files:**
- Create: `E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/index.ts`

- [ ] **Step 1: 编写 adapters/index.ts**

```typescript
// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/index.ts

import { PixelStreamingConfig, UEVersion, IPixelStreamingAdapter } from '../types';
import { BaseAdapter } from './base';
import { ModernAdapter } from './modern';
import { LegacyAdapter } from './legacy';
import { SimulateAdapter } from './simulate';

/**
 * 适配器工厂
 */
export class AdapterFactory {
  /**
   * 根据配置创建适配器
   */
  static create(config: PixelStreamingConfig): IPixelStreamingAdapter {
    // 模拟模式
    if (config.simulateMode) {
      return new SimulateAdapter(config);
    }

    // 如果手动指定了版本
    if (config.ueVersion) {
      return this.createForVersion(config.ueVersion, config);
    }

    // 默认使用 Modern 适配器（UE 5.2+）
    return new ModernAdapter(config);
  }

  /**
   * 根据 UE 版本创建适配器
   */
  static createForVersion(version: UEVersion, config: PixelStreamingConfig): IPixelStreamingAdapter {
    const versionNum = parseFloat(version);
    
    // UE 5.2+ 使用 Modern 适配器
    if (versionNum >= 5.2) {
      return new ModernAdapter(config);
    }
    
    // UE 4.26-5.1 使用 Legacy 适配器
    return new LegacyAdapter(config);
  }

  /**
   * 判断是否可以使用 Modern 适配器
   */
  static canUseModernAdapter(version: UEVersion): boolean {
    const versionNum = parseFloat(version);
    return versionNum >= 5.2;
  }

  /**
   * 获取适配器类型名称
   */
  static getAdapterType(version: UEVersion | undefined, simulateMode: boolean): string {
    if (simulateMode) return 'SimulateAdapter';
    if (!version) return 'ModernAdapter (default)';
    
    return this.canUseModernAdapter(version) ? 'ModernAdapter' : 'LegacyAdapter';
  }
}
```

---

## Task 10: 创建版本检测模块

**Files:**
- Create: `E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/version-detect.ts`

- [ ] **Step 1: 编写 version-detect.ts**

```typescript
// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/version-detect.ts

import { UEVersion, PROTOCOL_VERSION_MAP } from './types';
import { createLogger } from './utils/logger';

const logger = createLogger('VersionDetector');

/**
 * 检测结果
 */
export interface DetectionResult {
  version: UEVersion;
  protocolVersion: string;
  method: 'websocket' | 'config' | 'fallback';
}

/**
 * 检测 UE 版本
 */
export async function detectUEVersion(signallingUrl: string): Promise<DetectionResult> {
  logger.info(`Detecting UE version from: ${signallingUrl}`);

  try {
    // 方法 1: 通过 WebSocket 握手检测
    const wsResult = await detectViaWebSocket(signallingUrl);
    if (wsResult) {
      logger.info(`Version detected via WebSocket: ${wsResult.version}`);
      return wsResult;
    }
  } catch (error) {
    logger.warn('WebSocket detection failed', error);
  }

  // 方法 2: 通过 HTTP 配置请求检测
  try {
    const httpResult = await detectViaHTTP(signallingUrl);
    if (httpResult) {
      logger.info(`Version detected via HTTP: ${httpResult.version}`);
      return httpResult;
    }
  } catch (error) {
    logger.warn('HTTP detection failed', error);
  }

  // 默认回退
  logger.warn('Version detection failed, using default');
  return {
    version: '5.4', // 默认使用 5.4
    protocolVersion: '3.2',
    method: 'fallback',
  };
}

/**
 * 通过 WebSocket 握手检测版本
 */
async function detectViaWebSocket(signallingUrl: string): Promise<DetectionResult | null> {
  return new Promise((resolve) => {
    const ws = new WebSocket(signallingUrl);

    const timeout = setTimeout(() => {
      ws.close();
      resolve(null);
    }, 5000);

    ws.onopen = () => {
      // 发送配置请求
      ws.send(JSON.stringify({
        type: 'request',
        request: 'configure',
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 查找协议版本
        const protocolVersion = data.protocolVersion || data.protocol_version || data.version;
        
        if (protocolVersion) {
          clearTimeout(timeout);
          ws.close();
          
          const version = mapProtocolToUE(protocolVersion);
          resolve({
            version,
            protocolVersion,
            method: 'websocket',
          });
          return;
        }
      } catch (error) {
        logger.error('Failed to parse WebSocket message', error);
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
  });
}

/**
 * 通过 HTTP 请求检测版本
 */
async function detectViaHTTP(signallingUrl: string): Promise<DetectionResult | null> {
  try {
    const httpUrl = signallingUrl.replace('ws:', 'http:').replace('wss:', 'https:');
    const url = new URL('/config', httpUrl);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      const protocolVersion = data.protocolVersion || data.protocol_version || data.version;
      
      if (protocolVersion) {
        const version = mapProtocolToUE(protocolVersion);
        return {
          version,
          protocolVersion,
          method: 'config',
        };
      }
    }
  } catch (error) {
    logger.debug('HTTP config request failed', error);
  }

  return null;
}

/**
 * 映射协议版本到 UE 版本
 */
function mapProtocolToUE(protocolVersion: string): UEVersion {
  // 精确匹配
  if (protocolVersion in PROTOCOL_VERSION_MAP) {
    return PROTOCOL_VERSION_MAP[protocolVersion];
  }

  // 提取主版本号进行匹配
  const major = parseInt(protocolVersion.split('.')[0]);
  
  if (major === 1) return '4.27';
  if (major === 2) return '5.1';
  if (major >= 3) return '5.4';

  // 默认
  return '5.4';
}
```

---

## Task 11: 创建统一服务层

**Files:**
- Create: `E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/service.ts`

- [ ] **Step 1: 编写 service.ts**

```typescript
// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/service.ts

import {
  PixelStreamingConfig,
  PixelStreamingCallbacks,
  UEVersion,
  MCPCommand,
  MCPResponse,
} from './types';
import { AdapterFactory } from './adapters';
import { SSEClient } from './utils/sse-client';
import { createLogger } from './utils/logger';
import { detectUEVersion, DetectionResult } from './version-detect';

/**
 * 统一像素流服务
 */
export class PixelStreamingService {
  private config: Required<PixelStreamingConfig>;
  private callbacks: PixelStreamingCallbacks;
  private logger: ReturnType<typeof createLogger>;
  
  private adapter: ReturnType<typeof AdapterFactory.create> | null = null;
  private sseClient: SSEClient | null = null;
  private currentVersion: UEVersion | null = null;

  constructor(config: PixelStreamingConfig, callbacks: PixelStreamingCallbacks = {}) {
    // 合并配置
    this.config = {
      signallingUrl: '',
      mcpBridgeUrl: '',
      videoContainer: document.body,
      ueVersion: undefined,
      connectionTimeout: 30000,
      commandTimeout: 30000,
      autoPlayVideo: true,
      initialSettings: {
        AutoConnect: false,
        AutoPlayVideo: true,
        StartVideoMuted: true,
        UseMic: false,
        UseCamera: false,
      },
      mouseInteraction: {
        HoveringMouse: false,
        FakeMouseWithTouches: false,
        HideBrowserCursor: false,
      },
      debugMode: false,
      logLevel: 'info',
      simulateMode: false,
      ...config,
      initialSettings: {
        AutoConnect: false,
        AutoPlayVideo: true,
        StartVideoMuted: true,
        UseMic: false,
        UseCamera: false,
        ...config.initialSettings,
      },
      mouseInteraction: {
        HoveringMouse: false,
        FakeMouseWithTouches: false,
        HideBrowserCursor: false,
        ...config.mouseInteraction,
      },
    };

    this.callbacks = callbacks;
    this.logger = createLogger('PixelStreamingService', this.config.logLevel);
  }

  /**
   * 启动服务
   */
  async start(): Promise<void> {
    this.logger.info('Starting Pixel Streaming service...');

    // 1. 检测或使用指定的 UE 版本
    if (this.config.ueVersion) {
      this.currentVersion = this.config.ueVersion;
      this.logger.info(`Using specified UE version: ${this.currentVersion}`);
    } else {
      try {
        const detectionResult = await detectUEVersion(this.config.signallingUrl);
        this.currentVersion = detectionResult.version;
        this.logger.info(`Detected UE version: ${this.currentVersion} (${detectionResult.method})`);
        this.callbacks.onVersionDetected?.(this.currentVersion);
      } catch (error) {
        this.logger.warn('Version detection failed, using default', error);
        this.currentVersion = '5.4';
      }
    }

    // 2. 创建并连接适配器
    this.adapter = AdapterFactory.create(this.config);
    this.adapter.onResponse((response) => this.handleAdapterResponse(response));
    
    await this.adapter.connect();

    // 3. 连接 SSE（用于接收 MCP 命令）
    if (this.config.mcpBridgeUrl) {
      this.sseClient = new SSEClient(this.config.mcpBridgeUrl, {
        onConnected: () => this.logger.info('SSE connected'),
        onDisconnected: () => this.logger.info('SSE disconnected'),
        onError: (error) => this.callbacks.onError?.(error),
        onCommandReceived: (command) => this.handleMCPCommand(command),
      });
      
      await this.sseClient.connect();
    }

    this.callbacks.onConnected?.();
    this.logger.info('Pixel Streaming service started');
  }

  /**
   * 停止服务
   */
  stop(): void {
    this.logger.info('Stopping Pixel Streaming service...');

    if (this.adapter) {
      this.adapter.disconnect();
      this.adapter = null;
    }

    if (this.sseClient) {
      this.sseClient.disconnect();
      this.sseClient = null;
    }

    this.callbacks.onDisconnected?.();
    this.logger.info('Pixel Streaming service stopped');
  }

  /**
   * 重连
   */
  async reconnect(): Promise<void> {
    this.stop();
    await this.start();
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus() {
    return {
      adapter: this.adapter?.getConnectionStatus() || { pixelStreaming: false, sse: false },
      sse: this.sseClient?.isConnected() || false,
      version: this.currentVersion,
    };
  }

  /**
   * 发送命令到 UE
   */
  sendCommand(command: MCPCommand): boolean {
    if (!this.adapter) {
      this.logger.error('Adapter not initialized');
      return false;
    }

    return this.adapter.sendCommand(command);
  }

  /**
   * 处理适配器响应
   */
  private handleAdapterResponse(response: string): void {
    this.logger.debug('Handling adapter response:', response);
    
    // 转发到 SSE
    if (this.sseClient && this.sseClient.isConnected()) {
      try {
        const data = JSON.parse(response);
        this.sseClient.sendResponse({
          commandId: data.commandId || '',
          result: data.result || data,
          error: data.error,
        });
        this.callbacks.onResponseSent?.(data);
      } catch (error) {
        this.logger.error('Failed to parse adapter response', error);
      }
    }
  }

  /**
   * 处理 MCP 命令
   */
  private handleMCPCommand(command: MCPCommand): void {
    this.logger.info('Received MCP command:', command);
    this.callbacks.onCommandReceived?.(command);
    
    // 发送到 UE
    this.sendCommand(command);
  }
}
```

---

## Task 12: 创建统一导出文件

**Files:**
- Create: `E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/index.ts`

- [ ] **Step 1: 编写 index.ts**

```typescript
// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/index.ts

// 导出类型
export type {
  UEVersion,
  PixelStreamingConfig,
  MouseInteractionConfig,
  MCPCommand,
  MCPResponse,
  ConnectionStatus,
  PixelStreamingCallbacks,
  IPixelStreamingAdapter,
} from './types';

// 导出服务
export { PixelStreamingService } from './service';

// 导出工具
export { createLogger } from './utils/logger';
export { SSEClient } from './utils/sse-client';

// 导出适配器
export { AdapterFactory } from './adapters';

// 导出版本检测
export { detectUEVersion } from './version-detect';
export type { DetectionResult } from './version-detect';

// 导出配置
export { DEFAULT_CONFIG, mergeConfig, getNpmPackageForVersion } from './config';
```

---

## Task 13: 更新 package.json 添加依赖

**Files:**
- Modify: `E:/Git/claude/chat/package.json`

- [ ] **Step 1: 读取当前 package.json**

```bash
cat E:/Git/claude/chat/package.json
```

- [ ] **Step 2: 添加 npm 依赖**

在 dependencies 中添加：
```json
"@epicgames-ps/lib-pixelstreamingfrontend-ue5.2": "^1.0.0",
"@epicgames-ps/lib-pixelstreamingfrontend-ue5.3": "^1.0.0",
"@epicgames-ps/lib-pixelstreamingfrontend-ue5.5": "^1.0.0",
"@epicgames-ps/lib-pixelstreamingfrontend-ue5.6": "^1.0.0",
"@epicgames-ps/lib-pixelstreamingfrontend-ue5.7": "^1.0.0"
```

注意：ue5.4 已在现有依赖中

- [ ] **Step 3: 运行 npm install**

```bash
cd E:/Git/claude/chat && npm install
```

---

## Task 14: 复制 Legacy 脚本

**Files:**
- Create: `E:/Git/claude/chat/public/libs/webRtcPlayer.js`
- Create: `E:/Git/claude/chat/public/libs/app.js`

- [ ] **Step 1: 复制 webRtcPlayer.js**

```bash
cp "E:/Git/Launcher/server-dtw-launcher_crypt/ps_server/SignallingWebServer5.1/scripts/webRtcPlayer.js" E:/Git/claude/chat/public/libs/
```

- [ ] **Step 2: 复制 app.js**

```bash
cp "E:/Git/Launcher/server-dtw-launcher_crypt/ps_server/SignallingWebServer5.1/scripts/app.js" E:/Git/claude/chat/public/libs/
```

- [ ] **Step 3: 验证文件**

```bash
ls -la E:/Git/claude/chat/public/libs/
```

---

## Task 15: 创建使用示例

**Files:**
- Modify: `E:/Git/claude/chat/src/components/qwenpaw-chat/src/PixelStreaming.vue`

- [ ] **Step 1: 更新 Vue 组件使用新服务**

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { PixelStreamingService } from './pixelstreaming';

const videoContainer = ref<HTMLElement | null>(null);
let service: PixelStreamingService | null = null;

const startPixelStreaming = async () => {
  if (!videoContainer.value) return;

  service = new PixelStreamingService({
    signallingUrl: 'ws://localhost:8888',
    mcpBridgeUrl: 'http://localhost:8080',
    videoContainer: videoContainer.value,
    mouseInteraction: {
      HoveringMouse: true,
      HideBrowserCursor: true,
    },
    debugMode: true,
    // ueVersion: '5.4', // 可选：手动指定版本
    // simulateMode: true, // 可选：测试模式
  }, {
    onConnected: () => console.log('Connected'),
    onDisconnected: () => console.log('Disconnected'),
    onError: (error) => console.error(error),
    onVersionDetected: (version) => console.log(`UE version: ${version}`),
  });

  await service.start();
};

const stopPixelStreaming = () => {
  service?.stop();
  service = null;
};

onMounted(() => {
  startPixelStreaming();
});

onUnmounted(() => {
  stopPixelStreaming();
});
</script>

<template>
  <div ref="videoContainer" class="pixel-streaming-container"></div>
</template>
```

---

## 验证步骤

- [ ] 运行 TypeScript 编译检查
- [ ] 测试 Modern 适配器连接（UE 5.2+）
- [ ] 测试 Legacy 适配器连接（UE 4.26-5.1）
- [ ] 测试模拟模式
- [ ] 测试版本检测功能

---

## 计划完成

Plan complete and saved to `E:/Git/claude/chat/docs/superpowers/plans/2026-04-20-pixel-streaming-multi-version.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?