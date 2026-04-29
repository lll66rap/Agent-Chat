// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/utils/logger.ts

/**
 * 日志级别类型
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 日志级别优先级
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * 日志传输接口
 * 用于自定义日志输出方式（如发送到服务器、写入文件等）
 */
export interface LogTransport {
  log(level: LogLevel, context: string, message: string, data?: unknown): void;
}

/**
 * 控制台日志传输（默认）
 */
export class ConsoleTransport implements LogTransport {
  log(level: LogLevel, context: string, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;

    switch (level) {
      case 'debug':
        console.debug(formattedMessage, data ?? '');
        break;
      case 'info':
        console.info(formattedMessage, data ?? '');
        break;
      case 'warn':
        console.warn(formattedMessage, data ?? '');
        break;
      case 'error':
        console.error(formattedMessage, data ?? '');
        break;
    }
  }
}

/**
 * 空日志传输（禁用日志）
 */
export class NullTransport implements LogTransport {
  log(): void {
    // 不输出任何日志
  }
}

/**
 * 日志类
 */
export class Logger {
  private context: string;
  private level: LogLevel;
  private transport: LogTransport;

  constructor(
    context: string,
    level: LogLevel = 'info',
    transport?: LogTransport
  ) {
    this.context = context;
    this.level = level;
    this.transport = transport ?? new ConsoleTransport();
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      this.transport.log('debug', this.context, message, data);
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      this.transport.log('info', this.context, message, data);
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      this.transport.log('warn', this.context, message, data);
    }
  }

  error(message: string, error?: unknown): void {
    if (this.shouldLog('error')) {
      this.transport.log('error', this.context, message, error);
    }
  }

  /**
   * 创建子日志器（继承配置但使用新的上下文）
   */
  child(subContext: string): Logger {
    return new Logger(
      `${this.context}:${subContext}`,
      this.level,
      this.transport
    );
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 设置日志传输
   */
  setTransport(transport: LogTransport): void {
    this.transport = transport;
  }
}

/**
 * 全局日志传输（用于跨实例共享）
 */
let globalTransport: LogTransport | undefined;

/**
 * 设置全局日志传输
 */
export function setGlobalTransport(transport: LogTransport): void {
  globalTransport = transport;
}

/**
 * 获取全局日志传输
 */
export function getGlobalTransport(): LogTransport | undefined {
  return globalTransport;
}

/**
 * 创建日志器
 */
export function createLogger(context: string, level: LogLevel = 'info'): Logger {
  return new Logger(context, level, globalTransport);
}
