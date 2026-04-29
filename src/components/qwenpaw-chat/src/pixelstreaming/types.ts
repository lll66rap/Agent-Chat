// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/types.ts

import type { PixelStreamingError } from './errors';

/**
 * UE 版本枚举
 * - '5.5': UE 5.5+ (使用 Modern 适配器 + lib-pixelstreamingfrontend-ue5.7)
 * - '5.0': UE 5.0 ~ 5.4 (使用 Modern54 适配器 + lib-pixelstreamingfrontend-ue5.4)
 * - '4.26': UE 4.26+ (使用 Legacy 适配器 + 原生 WebSocket)
 */
export type UEVersion = '5.5' | '5.0' | '4.26';

/**
 * 协议版本到 UE 版本的映射
 * - 协议 1.x: UE 4.26+
 * - 协议 2.x+: UE 5.0+
 */
export const PROTOCOL_VERSION_MAP: Record<string, UEVersion> = {
  '1.0': '4.26',
  '1.1': '4.26',
  '2.0': '5.0',
  '2.1': '5.0',
  '3.0': '5.0',
  '3.1': '5.0',
  '3.2': '5.0',
  '3.3': '5.0',
  '3.4': '5.0',
  '3.5': '5.0',
};

/**
 * 鼠标交互配置
 */
export interface MouseInteractionConfig {
  HoveringMouse?: boolean;         // 悬停鼠标模式，默认 true
  FakeMouseWithTouches?: boolean;  // 触摸模拟鼠标，默认 false
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

  // 初始设置
  initialSettings?: {
    AutoConnect?: boolean;         // 自动连接，默认 false
    AutoPlayVideo?: boolean;       // 自动播放视频，默认 true
    StartVideoMuted?: boolean;     // 静音开始，默认 true
    UseMic?: boolean;              // 使用麦克风，默认 false
    UseCamera?: boolean;           // 使用摄像头，默认 false
    MatchViewportResolution?: boolean;  // 匹配视口分辨率，默认 true
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
  /** 像素流是否连接 */
  pixelStreaming: boolean;
  /** SSE 是否连接 */
  sse: boolean;
  /** 视频是否就绪 */
  videoReady?: boolean;
}

/**
 * 连接状态枚举（用于状态机）
 */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * 连接状态显示配置
 */
export const ConnectionStateLabels: Record<ConnectionState, string> = {
  disconnected: '已断开',
  connecting: '连接中',
  connected: '已连接',
  reconnecting: '重连中',
  error: '错误',
};

/**
 * 事件回调
 */
export interface PixelStreamingCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onVideoReady?: () => void;
  onError?: (error: PixelStreamingError | string) => void;  // 支持结构化错误和字符串
  onCommandReceived?: (command: MCPCommand) => void;
  onResponseSent?: (response: MCPResponse) => void;
  onVersionDetected?: (version: UEVersion) => void;
  onSSEStatusChange?: (connected: boolean) => void;  // SSE 状态变化回调
  onPixelStreamingStatusChange?: (connected: boolean) => void;  // 像素流状态变化回调
}

/**
 * 适配器接口
 */
export interface IPixelStreamingAdapter {
  // 生命周期
  connect(): Promise<void>;
  disconnect(): void;
  reconnect(): Promise<void>;

  // 状态
  isConnected(): boolean;
  getConnectionStatus(): ConnectionStatus;

  // 命令发送
  sendCommand(command: MCPCommand): boolean;

  // 事件监听
  onResponse(callback: (response: string) => void): () => void;
  onStatusChange?(callback: (status: ConnectionStatus) => void): () => void;  // 状态变化监听（可选）
}
