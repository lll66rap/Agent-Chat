/**
 * QwenPaw Chat 错误处理
 * 与 pixelstreaming 错误处理模式保持一致
 */

/**
 * 错误码定义
 */
export const ChatErrorCodes = {
  // 网络错误 (C0xx)
  SSE_TIMEOUT: 'C001',
  SSE_CONNECTION_FAILED: 'C002',
  NETWORK_ERROR: 'C003',

  // 解析错误 (C1xx)
  PARSE_ERROR: 'C101',
  INVALID_RESPONSE: 'C102',

  // 业务错误 (C2xx)
  API_ERROR: 'C201',
  RATE_LIMIT: 'C202',
  UNAUTHORIZED: 'C203',

  // 本地错误 (C3xx)
  STORAGE_ERROR: 'C301',
  CLIPBOARD_ERROR: 'C302',
} as const

export type ChatErrorCode = typeof ChatErrorCodes[keyof typeof ChatErrorCodes]

/**
 * 错误描述映射
 */
const ChatErrorDescriptions: Record<ChatErrorCode, string> = {
  [ChatErrorCodes.SSE_TIMEOUT]: 'SSE 连接超时',
  [ChatErrorCodes.SSE_CONNECTION_FAILED]: 'SSE 连接失败',
  [ChatErrorCodes.NETWORK_ERROR]: '网络请求失败',

  [ChatErrorCodes.PARSE_ERROR]: '响应解析失败',
  [ChatErrorCodes.INVALID_RESPONSE]: '无效的响应格式',

  [ChatErrorCodes.API_ERROR]: 'API 返回错误',
  [ChatErrorCodes.RATE_LIMIT]: '请求频率超限',
  [ChatErrorCodes.UNAUTHORIZED]: '未授权访问',

  [ChatErrorCodes.STORAGE_ERROR]: '本地存储操作失败',
  [ChatErrorCodes.CLIPBOARD_ERROR]: '剪贴板操作失败',
}

/**
 * Chat 错误类
 */
export class ChatError extends Error {
  readonly code: ChatErrorCode
  readonly timestamp: number
  readonly context?: Record<string, unknown>
  readonly recoverable: boolean

  constructor(
    code: ChatErrorCode,
    message?: string,
    options?: {
      context?: Record<string, unknown>
      recoverable?: boolean
    }
  ) {
    const description = ChatErrorDescriptions[code]
    super(message || description)

    this.name = 'ChatError'
    this.code = code
    this.timestamp = Date.now()
    this.context = options?.context
    this.recoverable = options?.recoverable ?? false
  }

  /**
   * 获取完整的错误信息
   */
  get fullMessage(): string {
    return `[${this.code}] ${this.message}`
  }

  /**
   * 转換為 JSON 格式
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      context: this.context,
      recoverable: this.recoverable,
    }
  }
}

/**
 * 便捷创建错误的工厂函数
 */
export const createChatError = {
  sseTimeout: (timeout: number) => new ChatError(
    ChatErrorCodes.SSE_TIMEOUT,
    `SSE 连接超时 (${timeout}ms)`,
    { context: { timeout }, recoverable: true }
  ),

  sseConnectionFailed: (url: string, reason?: string) => new ChatError(
    ChatErrorCodes.SSE_CONNECTION_FAILED,
    reason || `无法连接到 ${url}`,
    { context: { url }, recoverable: true }
  ),

  networkError: (message: string) => new ChatError(
    ChatErrorCodes.NETWORK_ERROR,
    message,
    { recoverable: true }
  ),

  parseError: (raw: string) => new ChatError(
    ChatErrorCodes.PARSE_ERROR,
    '响应解析失败',
    { context: { raw: raw.substring(0, 100) }, recoverable: false }
  ),

  apiError: (message: string, status?: number) => new ChatError(
    ChatErrorCodes.API_ERROR,
    message,
    { context: { status }, recoverable: false }
  ),

  storageError: (operation: string, error?: unknown) => new ChatError(
    ChatErrorCodes.STORAGE_ERROR,
    `本地存储操作失败: ${operation}`,
    { context: { operation, error }, recoverable: false }
  ),

  clipboardError: (error?: unknown) => new ChatError(
    ChatErrorCodes.CLIPBOARD_ERROR,
    '剪贴板操作失败',
    { context: { error }, recoverable: false }
  ),
}

/**
 * 判断是否为可恢复错误
 */
export function isChatRecoverable(error: unknown): boolean {
  return error instanceof ChatError && error.recoverable
}

/**
 * 判断是否为特定错误码
 */
export function isChatErrorCode(error: unknown, code: ChatErrorCode): boolean {
  return error instanceof ChatError && error.code === code
}
