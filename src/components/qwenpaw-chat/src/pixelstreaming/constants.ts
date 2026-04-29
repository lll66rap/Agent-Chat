/**
 * 像素流常量定义
 * 统一管理所有超时、重连参数等配置值
 */

/**
 * 连接超时常量（毫秒）
 */
export const TIMEOUTS = {
  /** 默认连接超时：30秒 */
  CONNECTION: 30000,
  /** 默认命令超时：30秒 */
  COMMAND: 30000,
  /** 版本检测超时：3秒（缩短以更快检测 UE 4.x 连接关闭行为） */
  VERSION_DETECT: 3000,
  /** SSE 心跳超时：60秒 */
  SSE_HEARTBEAT: 60000,
  /** SSE 心跳发送间隔：25秒 */
  SSE_HEARTBEAT_INTERVAL: 25000,
  /** 视频就绪检测间隔：500ms */
  VIDEO_READY_POLL: 500,
  /** 状态栏自动隐藏延迟：2秒 */
  STATUS_BAR_HIDE_DELAY: 2000,
  /** 视频就绪后隐藏延迟：1.5秒 */
  VIDEO_READY_HIDE_DELAY: 1500,
  /** 重连延迟：500ms */
  RECONNECT_DELAY: 500,
  /** 组件挂载后连接延迟：100ms */
  MOUNT_CONNECT_DELAY: 100,
} as const;

/**
 * 重连配置常量
 */
export const RECONNECT = {
  /** 最大重连次数 */
  MAX_ATTEMPTS: 10,
  /** 基础延迟：1秒 */
  BASE_DELAY: 1000,
  /** 最大延迟：30秒 */
  MAX_DELAY: 30000,
  /** 抖动因子：±25% */
  JITTER_FACTOR: 0.25,
} as const;

/**
 * 日志配置常量
 */
export const LOG = {
  /** 默认日志级别 */
  DEFAULT_LEVEL: 'info' as const,
  /** 日志历史最大长度 */
  MAX_HISTORY: 100,
} as const;

/**
 * UI 配置常量
 */
export const UI = {
  /** 日志列表最大长度 */
  MAX_LOG_ENTRIES: 20,
  /** 调试面板最大高度：180px */
  DEBUG_PANEL_MAX_HEIGHT: 180,
} as const;

/**
 * 协议版本常量
 */
export const PROTOCOL = {
  /** UE 5.x 最低协议版本 */
  UE5_MIN_PROTOCOL: 2,
  /** 默认协议版本 */
  DEFAULT_VERSION: '3.5',
  /** UE 4.x 协议版本范围 */
  UE4_PROTOCOL_RANGE: ['1.0', '1.1', '1.2', '1.3'] as const,
} as const;

/**
 * 默认 URL 配置
 */
export const DEFAULT_URLS = {
  /** 默认信令服务器地址 */
  SIGNALLING: 'ws://localhost:8888',
  /** 默认 MCP Bridge 地址 */
  MCP_BRIDGE: 'http://localhost:8080',
} as const;

/**
 * 计算重连延迟（指数退避 + 抖动）
 */
export function calculateReconnectDelay(
  attempt: number,
  baseDelay: number = RECONNECT.BASE_DELAY,
  maxDelay: number = RECONNECT.MAX_DELAY
): number {
  // 指数退避: baseDelay * 2^(attempt-1)
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);

  // 限制最大延迟
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // 添加抖动 (±25%) 防止惊群效应
  const jitter = cappedDelay * RECONNECT.JITTER_FACTOR * (Math.random() * 2 - 1);

  return Math.floor(cappedDelay + jitter);
}

/**
 * 验证连接超时值
 */
export function validateTimeout(timeout: number, min = 1000, max = 60000): number {
  return Math.max(min, Math.min(max, timeout));
}

/**
 * 验证重连次数
 */
export function validateReconnectAttempts(attempts: number): number {
  return Math.max(0, Math.min(attempts, RECONNECT.MAX_ATTEMPTS));
}
