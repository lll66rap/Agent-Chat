// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/index.ts

// 导出类型
export type {
  UEVersion,
  PixelStreamingConfig,
  MouseInteractionConfig,
  MCPCommand,
  MCPResponse,
  ConnectionStatus,
  ConnectionState,
  PixelStreamingCallbacks,
  IPixelStreamingAdapter,
} from './types';

// 导出状态标签
export { ConnectionStateLabels } from './types';

// 导出错误类型
export {
  PixelStreamingError,
  ErrorCodes,
  createError,
  isRecoverable,
  isErrorCode,
} from './errors';
export type { ErrorCode } from './errors';

// 导出服务
export { PixelStreamingService } from './service';

// 导出工具
export {
  createLogger,
  Logger,
  ConsoleTransport,
  NullTransport,
  setGlobalTransport,
  getGlobalTransport,
} from './utils/logger';
export type { LogTransport } from './utils/logger';
export { SSEClient } from './utils/sse-client';

// 导出适配器
export { AdapterFactory, BaseAdapter, ModernAdapter, LegacyAdapter, SimulateAdapter } from './adapters';

// 导出版本检测
export { detectUEVersion } from './version-detect';
export type { DetectionResult } from './version-detect';

// 导出配置
export { DEFAULT_CONFIG, mergeConfig, getNpmPackageForVersion } from './config';

// 导出常量
export {
  TIMEOUTS,
  RECONNECT,
  LOG,
  UI,
  PROTOCOL,
  DEFAULT_URLS,
  calculateReconnectDelay,
  validateTimeout,
  validateReconnectAttempts,
} from './constants';

// 导出类型常量
export { PROTOCOL_VERSION_MAP } from './types';
