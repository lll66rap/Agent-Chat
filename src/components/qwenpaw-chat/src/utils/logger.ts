/**
 * Chat Logger 工具
 * 复用 pixelstreaming 的 logger 模式
 */

import { createLogger as createPsLogger } from '../pixelstreaming/utils/logger'

/**
 * 创建 Chat 模块的 logger
 */
export function createChatLogger(context: string = 'QwenPawChat', debug: boolean = false) {
  return createPsLogger(context, debug ? 'debug' : 'warn')
}

/**
 * 默认 logger 实例
 */
let defaultLogger: ReturnType<typeof createChatLogger> | null = null

/**
 * 获取默认 logger
 */
export function getLogger() {
  if (!defaultLogger) {
    defaultLogger = createChatLogger()
  }
  return defaultLogger
}

/**
 * 设置全局日志级别
 */
export function setDebugMode(debug: boolean) {
  defaultLogger = createChatLogger('QwenPawChat', debug)
}

// 导出 pixelstreaming 的 logger 工具
export { createLogger, ConsoleTransport, NullTransport, setGlobalTransport, getGlobalTransport } from '../pixelstreaming/utils/logger'
export type { LogTransport } from '../pixelstreaming/utils/logger'
