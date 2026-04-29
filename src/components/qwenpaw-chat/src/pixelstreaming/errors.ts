/**
 * 像素流错误类型定义
 * 提供结构化的错误处理，便于调试和错误追踪
 */

/**
 * 错误码常量
 */
export const ErrorCodes = {
  // 连接相关错误
  CONNECTION_TIMEOUT: 'E001',
  CONNECTION_FAILED: 'E002',
  CONNECTION_DROPPED: 'E003',

  // 版本检测错误
  VERSION_DETECT_TIMEOUT: 'E101',
  VERSION_DETECT_FAILED: 'E102',
  VERSION_UNSUPPORTED: 'E103',

  // 适配器错误
  ADAPTER_NOT_INITIALIZED: 'E201',
  ADAPTER_NOT_CONNECTED: 'E202',
  ADAPTER_DISCONNECTED: 'E203',

  // 命令错误
  COMMAND_SEND_FAILED: 'E301',
  COMMAND_TIMEOUT: 'E302',
  COMMAND_INVALID: 'E303',

  // SSE 相关错误
  SSE_CONNECTION_FAILED: 'E401',
  SSE_MAX_RECONNECT: 'E402',
  SSE_HEARTBEAT_TIMEOUT: 'E403',

  // 配置错误
  CONFIG_INVALID: 'E501',
  CONFIG_MISSING_REQUIRED: 'E502',

  // 视频相关错误
  VIDEO_CONTAINER_NOT_READY: 'E601',
  VIDEO_PLAYBACK_FAILED: 'E602',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * 错误码描述映射
 */
const ErrorDescriptions: Record<ErrorCode, string> = {
  [ErrorCodes.CONNECTION_TIMEOUT]: '连接超时',
  [ErrorCodes.CONNECTION_FAILED]: '连接失败',
  [ErrorCodes.CONNECTION_DROPPED]: '连接断开',

  [ErrorCodes.VERSION_DETECT_TIMEOUT]: '版本检测超时',
  [ErrorCodes.VERSION_DETECT_FAILED]: '版本检测失败',
  [ErrorCodes.VERSION_UNSUPPORTED]: '不支持的版本',

  [ErrorCodes.ADAPTER_NOT_INITIALIZED]: '适配器未初始化',
  [ErrorCodes.ADAPTER_NOT_CONNECTED]: '适配器未连接',
  [ErrorCodes.ADAPTER_DISCONNECTED]: '适配器已断开',

  [ErrorCodes.COMMAND_SEND_FAILED]: '命令发送失败',
  [ErrorCodes.COMMAND_TIMEOUT]: '命令超时',
  [ErrorCodes.COMMAND_INVALID]: '命令格式无效',

  [ErrorCodes.SSE_CONNECTION_FAILED]: 'SSE 连接失败',
  [ErrorCodes.SSE_MAX_RECONNECT]: 'SSE 达到最大重连次数',
  [ErrorCodes.SSE_HEARTBEAT_TIMEOUT]: 'SSE 心跳超时',

  [ErrorCodes.CONFIG_INVALID]: '配置无效',
  [ErrorCodes.CONFIG_MISSING_REQUIRED]: '缺少必要配置',

  [ErrorCodes.VIDEO_CONTAINER_NOT_READY]: '视频容器未就绪',
  [ErrorCodes.VIDEO_PLAYBACK_FAILED]: '视频播放失败',
};

/**
 * 像素流结构化错误
 */
export class PixelStreamingError extends Error {
  /** 错误码 */
  readonly code: ErrorCode;

  /** 错误时间戳 */
  readonly timestamp: number;

  /** 附加上下文信息 */
  readonly context?: Record<string, unknown>;

  /** 是否可重试 */
  readonly recoverable: boolean;

  constructor(
    code: ErrorCode,
    message?: string,
    options?: {
      context?: Record<string, unknown>;
      recoverable?: boolean;
      cause?: Error;
    }
  ) {
    const description = ErrorDescriptions[code];
    super(message || description);

    this.name = 'PixelStreamingError';
    this.code = code;
    this.timestamp = Date.now();
    this.context = options?.context;
    this.recoverable = options?.recoverable ?? false;
  }

  /**
   * 获取完整的错误信息（包含错误码）
   */
  get fullMessage(): string {
    return `[${this.code}] ${this.message}`;
  }

  /**
   * 转換為 JSON 格式（用于日志或传输）
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      fullMessage: this.fullMessage,
      timestamp: this.timestamp,
      context: this.context,
      recoverable: this.recoverable,
    };
  }

  /**
   * 从普通错误创建 PixelStreamingError
   */
  static fromError(error: unknown, code: ErrorCode = ErrorCodes.CONNECTION_FAILED): PixelStreamingError {
    if (error instanceof PixelStreamingError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    return new PixelStreamingError(code, message, {
      cause: error instanceof Error ? error : undefined,
    });
  }
}

/**
 * 可恢复错误判断
 */
export function isRecoverable(error: unknown): boolean {
  if (error instanceof PixelStreamingError) {
    return error.recoverable;
  }
  return false;
}

/**
 * 判断是否为特定错误码
 */
export function isErrorCode(error: unknown, code: ErrorCode): boolean {
  if (error instanceof PixelStreamingError) {
    return error.code === code;
  }
  return false;
}

/**
 * 创建错误的便捷方法
 */
export const createError = {
  connectionTimeout: (timeout: number) => new PixelStreamingError(
    ErrorCodes.CONNECTION_TIMEOUT,
    `连接超时 (${timeout}ms)`,
    { context: { timeout }, recoverable: true }
  ),

  versionDetectFailed: (reason?: string) => new PixelStreamingError(
    ErrorCodes.VERSION_DETECT_FAILED,
    reason || '版本检测失败，使用默认版本',
    { recoverable: true }
  ),

  adapterNotReady: () => new PixelStreamingError(
    ErrorCodes.ADAPTER_NOT_INITIALIZED,
    '适配器未初始化，请先调用 connect()'
  ),

  adapterNotConnected: () => new PixelStreamingError(
    ErrorCodes.ADAPTER_NOT_CONNECTED,
    '适配器未连接，无法发送命令'
  ),

  commandFailed: (commandId: string, reason?: string) => new PixelStreamingError(
    ErrorCodes.COMMAND_SEND_FAILED,
    reason || '命令发送失败',
    { context: { commandId } }
  ),

  videoContainerNotReady: () => new PixelStreamingError(
    ErrorCodes.VIDEO_CONTAINER_NOT_READY,
    '视频容器元素未就绪'
  ),

  sseMaxReconnect: (attempts: number) => new PixelStreamingError(
    ErrorCodes.SSE_MAX_RECONNECT,
    `SSE 达到最大重连次数 (${attempts})`,
    { context: { attempts } }
  ),
};
