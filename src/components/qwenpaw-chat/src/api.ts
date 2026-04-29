/**
 * QwenPaw Chat API 模块
 *
 * 提供与 QwenPaw 智能体 API 的通信功能，包括：
 * - SSE 流式对话
 * - 会话管理（session_id, user_id）
 * - 本地历史记录存储
 * - 错误处理和重试机制
 *
 * @module qwenpaw-chat/api
 * @example
 * ```typescript
 * import { qwenPawGenerateSse, getConversation, clearConversation } from '@/components/qwenpaw-chat/api'
 *
 * // 发送消息
 * const controller = await qwenPawGenerateSse(
 *   '/api/chat',
 *   '你好',
 *   undefined,
 *   undefined,
 *   {
 *     onMessage: (data) => console.log('收到消息:', data.text),
 *     onThinking: (thinking) => console.log('思考中:', thinking),
 *     onToolCall: (calling, name) => console.log('工具调用:', calling, name),
 *     onError: (error) => console.error('错误:', error),
 *     onComplete: () => console.log('完成')
 *   }
 * )
 *
 * // 取消请求
 * controller.abort()
 * ```
 */

// 开发环境使用代理路径解决跨域，生产环境使用完整 URL
import { CHAT_CONFIG, ENV_DEFAULTS, STORAGE_KEYS } from './chat-constants'
import type { QwenPawRequest, QwenPawResponse, QwenPawCallbacks } from './chat-types'

const QWENPAW_FETCH_URL = import.meta.env.DEV
  ? ENV_DEFAULTS.DEV_API_PATH  // 通过 Vite 代理
  : (import.meta.env.VITE_QWENPAW_API_URL || ENV_DEFAULTS.DEV_API_PATH)
const QWENPAW_API_KEY = import.meta.env.VITE_QWENPAW_API_KEY || ''
const QWENPAW_AGENT_ID = import.meta.env.VITE_QWENPAW_AGENT_ID || ENV_DEFAULTS.AGENT_ID
const QWENPAW_SESSION_ID = import.meta.env.VITE_QWENPAW_SESSION_ID || ''
const QWENPAW_TIMEOUT = parseInt(import.meta.env.VITE_QWENPAW_TIMEOUT || String(CHAT_CONFIG.TIMEOUT), 10)

// 会话 ID 和用户 ID 存储（用于保持多轮对话上下文）
let currentSessionId = QWENPAW_SESSION_ID
let currentUserId = ''

// 是否开启调试日志
let debugMode = false

/**
 * 设置调试模式
 * @param debug - 是否开启调试日志
 * @example
 * ```typescript
 * setDebugMode(true) // 开启调试日志
 * ```
 */
export const setDebugMode = (debug: boolean) => {
  debugMode = debug
}

// 日志记录工具
const logger = {
  info: (message: string, data?: unknown) => {
    if (debugMode) {
      console.log(`[QwenPaw] ${message}`, data ?? '')
    }
  },
  error: (message: string, error?: unknown) => {
    if (debugMode) {
      console.error(`[QwenPaw] ${message}`, error ?? '')
    }
  },
  debug: (message: string, data?: unknown) => {
    if (debugMode) {
      console.debug(`[QwenPaw] ${message}`, data ?? '')
    }
  }
}

/**
 * 生成唯一的用户 ID
 * 存储在 localStorage 中，刷新页面后保持不变
 * @returns 用户 ID 字符串
 * @internal
 */
const generateOrGetUserId = (): string => {
  let userId = localStorage.getItem(STORAGE_KEYS.USER_ID)
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    localStorage.setItem(STORAGE_KEYS.USER_ID, userId)
    logger.info('Generated new user ID:', userId)
  }
  return userId
}

/**
 * 获取当前用户 ID
 * @returns 当前用户 ID 字符串
 * @example
 * ```typescript
 * const userId = getUserId()
 * console.log('当前用户:', userId)
 * ```
 */
export const getUserId = (): string => {
  if (!currentUserId) {
    currentUserId = generateOrGetUserId()
  }
  return currentUserId
}

/**
 * 设置用户 ID
 * @param userId - 用户 ID 字符串
 * @example
 * ```typescript
 * setUserId('user_123456')
 * ```
 */
export const setUserId = (userId: string) => {
  currentUserId = userId
  localStorage.setItem(STORAGE_KEYS.USER_ID, userId)
  logger.info('User ID set:', userId)
}

/**
 * 获取会话历史记录（从本地 localStorage 读取）
 * @returns 消息数组，每条消息包含 content 和 role
 * @example
 * ```typescript
 * const history = getConversation()
 * console.log('历史消息数:', history.length)
 * ```
 */
export const getConversation = (): { content: string; role: string }[] => {
  const key = `${STORAGE_KEYS.HISTORY_PREFIX}${currentUserId || getUserId()}`
  const stored = localStorage.getItem(key)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch (e) {
      logger.error('Failed to parse conversation history', e)
    }
  }
  return []
}

/**
 * 保存消息到本地历史
 * @param content - 消息内容
 * @param role - 消息角色（'user' 或 'assistant'）
 * @example
 * ```typescript
 * saveMessageToHistory('你好', 'user')
 * saveMessageToHistory('你好！有什么可以帮助你的？', 'assistant')
 * ```
 */
export const saveMessageToHistory = (content: string, role: 'user' | 'assistant') => {
  const key = `${STORAGE_KEYS.HISTORY_PREFIX}${currentUserId || getUserId()}`
  const history = getConversation()
  history.push({ content, role })
  // 限制历史记录数量
  if (history.length > CHAT_CONFIG.MAX_HISTORY) {
    history.shift()
  }
  localStorage.setItem(key, JSON.stringify(history))
  logger.info('Message saved to history', { role, totalMessages: history.length })
}

/**
 * 清空会话历史（本地存储）
 * 清除当前用户的所有历史消息，重置会话 ID
 * @example
 * ```typescript
 * clearConversation()
 * ```
 */
export const clearConversation = (): void => {
  logger.info('Clearing conversation history')
  const key = `${STORAGE_KEYS.HISTORY_PREFIX}${currentUserId || getUserId()}`
  localStorage.removeItem(key)
  // 清空本地会话 ID，保留用户 ID
  currentSessionId = QWENPAW_SESSION_ID
  logger.info('Conversation history cleared, session_id reset to:', currentSessionId || '(empty)')
}

/**
 * 判断是否为清空指令
 * @param message - 用户消息
 * @returns 是否为清空指令
 * @example
 * ```typescript
 * if (isClearCommand(message)) {
 *   clearConversation()
 * }
 * ```
 */
export const isClearCommand = (message: string): boolean => {
  return message.trim().toLowerCase() === '/clear'
}

/**
 * 设置当前会话 ID（用于保持上下文）
 * @param sessionId - 会话 ID 字符串
 * @example
 * ```typescript
 * setSessionId('session_abc123')
 * ```
 */
export const setSessionId = (sessionId: string) => {
  currentSessionId = sessionId
  logger.info('Session ID set:', sessionId)
}

/**
 * 获取当前会话 ID
 * @returns 当前会话 ID 字符串，可能为空
 * @example
 * ```typescript
 * const sessionId = getSessionId()
 * if (sessionId) {
 *   console.log('当前会话:', sessionId)
 * }
 * ```
 */
export const getSessionId = (): string => {
  return currentSessionId
}

// 导出类型
export type { QwenPawContentItem, QwenPawOutputMessage, QwenPawResponse, QwenPawRequest, QwenPawCallbacks } from './chat-types'

/**
 * 指数退避重试延迟
 * @param attempt 尝试次数（从 0 开始）
 * @param baseDelay 基础延迟（毫秒）
 * @param maxDelay 最大延迟（毫秒）
 */
const exponentialBackoffDelay = (
  attempt: number,
  baseDelay: number = CHAT_CONFIG.BASE_DELAY,
  maxDelay: number = CHAT_CONFIG.MAX_DELAY
): number => {
  return Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
}

/**
 * 停止正在进行的会话
 * @param chatId - 会话 ID（可以是 session_id 或 chat UUID）
 * @returns 是否成功停止
 * @example
 * ```typescript
 * const stopped = await stopChat('session_abc123')
 * if (stopped) {
 *   console.log('会话已停止')
 * }
 * ```
 */
export async function stopChat(chatId: string): Promise<boolean> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (QWENPAW_API_KEY) {
    headers['Authorization'] = `Bearer ${QWENPAW_API_KEY}`
  }

  try {
    const url = import.meta.env.DEV
      ? '/api/console/chat/stop'
      : (import.meta.env.VITE_QWENPAW_API_URL || '/api/console/chat') + '/stop'

    const response = await fetch(`${url}?chat_id=${encodeURIComponent(chatId)}`, {
      method: 'POST',
      headers,
    })

    if (!response.ok) {
      logger.error('Stop chat request failed', { status: response.status })
      return false
    }

    const data = await response.json()
    logger.info('Stop chat response:', data)
    return data.stopped === true
  } catch (error) {
    logger.error('Failed to stop chat', error)
    return false
  }
}

/**
 * 使用 fetch 连接 QwenPaw SSE API
 * 支持：
 * - 会话管理：自动保存和传递 session_id
 * - 错误处理：完整的网络和 API 错误处理
 * - 流式读取：使用 ReadableStream 避免内存问题
 * - 连接超时：可配置的超时时间
 * - 重试机制：指数退避重试（网络错误时）
 * - 日志记录：详细的调用日志
 * - 思考阶段：通过 onThinking 回调通知思考状态
 *
 * @param url - QwenPaw API 端点
 * @param message - 用户消息
 * @param sessionId - 会话 ID（用于保持上下文）
 * @param userId - 用户 ID（用于标识用户）
 * @param callbacks - 回调对象
 * @param maxRetries - 最大重试次数（默认 3 次）
 * @returns AbortController 用于取消请求
 */
export async function qwenPawGenerateSse(
  url: string = QWENPAW_FETCH_URL,
  message: string,
  sessionId: string = currentSessionId,
  userId: string = currentUserId || getUserId(),
  callbacks: QwenPawCallbacks,
  maxRetries: number = CHAT_CONFIG.MAX_RETRIES
): Promise<AbortController> {
  const { onMessage, onThinking, onToolCall, onError, onComplete } = callbacks
  const controller = new AbortController()
  let attempt = 0
  let thinkingDetected = false
  let toolCallDetected = false

  logger.info('Starting QwenPaw chat request', {
    url,
    sessionId: sessionId || '(new)',
    userId,
    maxRetries
  })

  const performRequest = async (): Promise<void> => {
    // 设置超时定时器
    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => {
      timeoutController.abort(new Error(`Request timeout after ${QWENPAW_TIMEOUT}ms`))
    }, QWENPAW_TIMEOUT)

    try {
      // 按照官方示例的请求格式
      const requestBody: QwenPawRequest = {
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: message
              }
            ]
          }
        ],
        session_id: sessionId ? sessionId : currentSessionId,
        user_id: userId,
        channel: ENV_DEFAULTS.CHANNEL
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'X-Agent-Id': QWENPAW_AGENT_ID
      }

      // 如果配置了认证令牌，添加到请求头
      if (QWENPAW_API_KEY) {
        headers['Authorization'] = `Bearer ${QWENPAW_API_KEY}`
      }

      logger.debug('Sending request to QwenPaw', requestBody)

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.any([controller.signal, timeoutController.signal])
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        const error = new Error(`HTTP error! status: ${response.status}, body: ${errorText}`)
        logger.error('API returned error response', { status: response.status, error: errorText })
        throw error
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      logger.info('Successfully connected to SSE stream')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let receivedBytes = 0
      // 使用 Map 跟踪每个消息 ID 对应的类型，用于过滤 reasoning 内容
      const messageTypeMap: Map<string, string> = new Map()

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          logger.debug('SSE stream completed')
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        receivedBytes += value.length

        // 处理 SSE 格式的数据
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()

            try {
              const parsed: QwenPawResponse = JSON.parse(data)
              logger.debug('Received SSE event:', {
                object: parsed.object,
                type: parsed.type,
                status: parsed.status,
                hasText: !!parsed.text,
                textLength: parsed.text?.length || 0,
                hasOutput: !!parsed.output,
                outputLength: parsed.output?.length || 0,
                dataPreview: data.length > 100 ? data.substring(0, 100) + '...' : data
              })

              // 保存返回的 session_id 用于后续请求（保持多轮对话上下文）
              if (parsed.session_id && parsed.session_id !== currentSessionId) {
                currentSessionId = parsed.session_id
                logger.info('Received session ID:', parsed.session_id)
                onMessage({ text: '', session_id: parsed.session_id })
              }

              // 检查错误
              if (parsed.error) {
                const errorMsg = parsed.error.message || 'Unknown error from API'
                logger.error('API returned error in response', parsed.error)
                onError(errorMsg)
                continue
              }

              // 跟踪每个消息 ID 对应的类型（用于过滤 reasoning 内容）
              // API 事件：message(id, type) -> content(msg_id, text) -> message(completed)
              if (parsed.object === 'message' && parsed.type && parsed.id) {
                messageTypeMap.set(parsed.id, parsed.type)
                logger.debug('Message type recorded:', { id: parsed.id, type: parsed.type })

                // 检测到 reasoning 类型，通知思考状态
                if (parsed.type === 'reasoning' && onThinking) {
                  thinkingDetected = true
                  onThinking(true)
                }

                // 检测到 plugin_call 类型，通知工具调用状态
                // 注意：可能多次调用工具，每次都需要显示loading
                if (parsed.type === 'plugin_call' && onToolCall) {
                  toolCallDetected = true
                  const toolName = parsed.name || ''
                  onToolCall(true, toolName)
                  logger.info('Tool call detected:', toolName || 'unknown')
                }
              }

              // 处理实际的流式文本内容
              // 只有消息类型是 "message" 时才显示，过滤掉 "reasoning" 思考内容
              // 注意：只处理 status: "in_progress" 的增量内容，跳过 status: "completed" 的完整内容
              if (parsed.object === 'content' && parsed.type === 'text' && parsed.text) {
                // 跳过 completed 状态的事件（这些包含完整内容，会导致重复显示）
                if (parsed.status === 'completed') {
                  logger.debug('Skipping completed content event (full text)', {
                    msgId: parsed.msg_id?.substring(0, 20),
                    status: parsed.status
                  })
                } else {
                  // 通过 msg_id 查找对应的消息类型
                  const msgType = parsed.msg_id ? messageTypeMap.get(parsed.msg_id) : null

                  if (msgType === 'message') {
                    // 显示实际回复内容
                    // 如果之前有思考状态，现在收到实际消息，通知思考结束
                    if (thinkingDetected && onThinking) {
                      thinkingDetected = false
                      onThinking(false)
                    }
                    // 如果之前有工具调用状态，现在收到实际消息，通知工具调用结束
                    if (toolCallDetected && onToolCall) {
                      toolCallDetected = false
                      onToolCall(false)
                      logger.debug('Tool call completed, hiding loading indicator')
                    }
                    logger.debug('Sending text chunk:', {
                      length: parsed.text.length,
                      preview: parsed.text.substring(0, Math.min(50, parsed.text.length)),
                      msgId: parsed.msg_id?.substring(0, 20),
                      msgType
                    })
                    onMessage({ text: parsed.text })
                  } else if (msgType === 'reasoning') {
                    // 跳过 reasoning 思考内容
                    logger.debug('Skipping reasoning content:', {
                      msgId: parsed.msg_id?.substring(0, 20),
                      preview: parsed.text.substring(0, 30)
                    })
                  } else {
                    // 未知消息类型，可能是旧格式或新的 API 格式
                    // 为了兼容性，仍然显示内容
                    logger.debug('Sending text chunk (unknown type):', {
                      length: parsed.text.length,
                      msgId: parsed.msg_id
                    })
                    onMessage({ text: parsed.text })
                  }
                }
              }
              // 同时保持对旧格式的支持（如果有的话）
              // 注意：跳过 response completed 事件，因为它包含完整的 output（会导致重复显示）
              else if (parsed.output && parsed.object !== 'response') {
                for (const item of parsed.output) {
                  // 只显示 type 为 "message" 的最终回复，跳过 reasoning/plugin_call 等
                  if (item.type !== 'message' || item.role !== 'assistant') {
                    continue
                  }
                  if (item.content) {
                    for (const content of item.content) {
                      if (content.type === 'text' && content.text) {
                        onMessage({ text: content.text })
                      }
                    }
                  }
                }
              }
            } catch (e) {
              logger.error('Failed to parse SSE data', { line, error: e })
            }
          }
        }
      }

      logger.info('Request completed successfully', { receivedBytes })
      // 确保所有状态都被重置
      if (thinkingDetected && onThinking) {
        onThinking(false)
      }
      if (toolCallDetected && onToolCall) {
        onToolCall(false)
      }
      onComplete()
    } catch (error) {
      clearTimeout(timeoutId)

      const err = error as Error
      logger.error('Request failed', { attempt, error: err.message })

      // 重置所有状态
      if (thinkingDetected && onThinking) {
        thinkingDetected = false
        onThinking(false)
      }
      if (toolCallDetected && onToolCall) {
        toolCallDetected = false
        onToolCall(false)
      }

      // 判断是否是可重试的错误
      const isRetryable = (
        err.name === 'AbortError' &&
        !controller.signal.aborted &&
        attempt < maxRetries
      ) || (
        err.message.includes('timeout') &&
        attempt < maxRetries
      ) || (
        // 网络连接错误
        !err.message.includes('HTTP error') &&
        attempt < maxRetries
      )

      if (isRetryable) {
        attempt++
        const delay = exponentialBackoffDelay(attempt)
        logger.info(`Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`)

        await new Promise(resolve => setTimeout(resolve, delay))
        return performRequest()
      }

      // 用户主动中断请求，不显示错误
      if (err.name === 'AbortError' && controller.signal.aborted) {
        logger.info('Request aborted by user')
        // 仍然调用 onComplete 以重置状态
        onComplete()
        return
      }

      // 不可重试或已达最大重试次数
      onError(err.message || 'Request failed')
    }
  }

  // 启动请求
  performRequest()

  return controller
}
