/**
 * 聊天功能 composable
 *
 * 提供完整的聊天功能，包括：
 * - 消息发送和接收
 * - SSE 流式响应处理
 * - Markdown 渲染（支持 KaTeX 数学公式）
 * - 思考状态和工具调用状态管理
 * - 滚动控制
 * - 历史记录管理
 *
 * @module qwenpaw-chat/composables/useChat
 * @example
 * ```vue
 * <script setup>
 * import { useChat } from '@/components/qwenpaw-chat/src/composables/useChat'
 *
 * const {
 *   list,
 *   sendFlag,
 *   text,
 *   message,
 *   isThinking,
 *   send,
 *   scrollToBottom,
 *   queryConversation
 * } = useChat({
 *   showCopy: true,
 *   debug: false
 * })
 *
 * // 加载历史记录
 * queryConversation()
 *
 * // 发送消息
 * const handleSend = () => {
 *   send(text.value)
 * }
 * </script>
 * ```
 */

import { ref, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import markdownItKatex from '@traptitech/markdown-it-katex'
import {
  getConversation,
  clearConversation,
  isClearCommand,
  qwenPawGenerateSse,
  saveMessageToHistory,
  stopChat,
  getSessionId,
} from '../api'
import type { MessageItem } from '../chat-types'
import { createChatLogger } from '../utils/logger'
import { rafThrottle } from '../utils/performance'

/**
 * 聊天功能选项
 */
export interface UseChatOptions {
  /** 是否显示复制按钮 */
  showCopy?: boolean
  /** 是否启用调试日志 */
  debug?: boolean
}

/**
 * 聊天功能 composable
 * @param options - 聊天配置选项
 * @returns 聊天状态和方法
 */
export function useChat(options: UseChatOptions = {}) {
  const { debug = false } = options
  const logger = createChatLogger('useChat', debug)

  // Markdown 渲染器（单例）
  let mdInstance: MarkdownIt | null = null

  const getMarkdown = (): MarkdownIt => {
    if (!mdInstance) {
      mdInstance = new MarkdownIt({
        html: true,
        linkify: true,
        typographer: true,
        breaks: true
      })
      mdInstance.use(markdownItKatex, {
        throwOnError: false,
        errorColor: '#cc0000',
        displayMode: false,
      })
    }
    return mdInstance
  }

  // 消息列表
  const list = ref<MessageItem[]>([])

  // 发送状态
  const sendFlag = ref(false)
  const text = ref('')
  const message = ref('')

  // 思考状态
  const isThinking = ref(false)

  // 工具调用状态
  const isToolCalling = ref(false)
  const toolCallName = ref('')

  // 错误信息
  const errorMessage = ref('')

  // 当前 AbortController
  let currentController: AbortController | null = null

  // 当前回复内容
  let currentReplyText = ''

  /**
   * 滚动到底部（使用 rafThrottle 限制每帧最多执行一次）
   */
  const scrollToBottomRaw = () => {
    const content = document.querySelector('.chat-content')
    if (content) {
      content.scrollTop = content.scrollHeight
    }
  }

  const scrollToBottom = rafThrottle(scrollToBottomRaw)

  /**
   * 检测是否显示"回到底部"按钮（使用 rafThrottle 限制每帧最多执行一次）
   */
  const showScrollToBottom = ref(false)
  const checkScrollPositionRaw = () => {
    const content = document.querySelector('.chat-content')
    if (content) {
      const { scrollTop, scrollHeight, clientHeight } = content
      showScrollToBottom.value = scrollHeight - scrollTop - clientHeight > 50
    }
  }

  const checkScrollPosition = rafThrottle(checkScrollPositionRaw)

  /**
   * 流式 markdown 渲染器
   */
  const renderStreamingMarkdown = (text: string): string => {
    if (!text) return ''
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
    html = html.replace(/\n/g, '<br>')
    return html
  }

  /**
   * 加载会话历史
   */
  const queryConversation = () => {
    list.value = []
    message.value = ''
    const history = getConversation()
    const md = getMarkdown()
    history.forEach((item: { content: string; role: string }) => {
      if (typeof item.content === 'string') {
        if (item.role === 'user') {
          item.content = item.content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
        } else {
          item.content = md.render(item.content)
        }
      }
      list.value.push(item as MessageItem)
    })
    nextTick(() => {
      const content = document.querySelector('.chat-content')
      if (content) content.scrollTop = content.scrollHeight
    })
  }

  /**
   * 清空本地历史
   */
  const clearLocalHistory = () => {
    clearConversation()
    list.value = []
    message.value = ''
  }

  /**
   * 核心发送逻辑
   */
  const sendToQwenPawInternal = async (userMessage: string) => {
    message.value = ''
    currentReplyText = ''
    isThinking.value = false
    isToolCalling.value = false
    toolCallName.value = ''
    errorMessage.value = ''
    currentController = new AbortController()

    const md = getMarkdown()

    try {
      const apiUrl = import.meta.env.DEV
        ? '/api/console/chat'
        : (import.meta.env.VITE_QWENPAW_API_URL || '/api/console/chat')

      await qwenPawGenerateSse(
        apiUrl,
        userMessage,
        undefined,
        undefined,
        {
          onMessage: (data) => {
            if (data.text) {
              currentReplyText += data.text
              message.value = renderStreamingMarkdown(currentReplyText)
              nextTick(() => scrollToBottom())
            }
          },
          onThinking: (thinking: boolean) => {
            isThinking.value = thinking
            nextTick(() => scrollToBottom())
          },
          onToolCall: (toolCalling: boolean, toolName?: string) => {
            // 工具调用开始时，先保存之前的回复
            if (toolCalling && currentReplyText) {
              const rendered = md.render(currentReplyText)
              list.value.push({ content: rendered, role: 'assistant' })
              saveMessageToHistory(currentReplyText, 'assistant')
              currentReplyText = ''
              message.value = ''
            }
            isToolCalling.value = toolCalling
            toolCallName.value = toolName || ''
            nextTick(() => scrollToBottom())
          },
          onError: (error: string) => {
            logger.error('SSE error:', error)
            sendFlag.value = false
            isThinking.value = false
            isToolCalling.value = false
            currentController = null
            errorMessage.value = error
            nextTick(() => scrollToBottom())
          },
          onComplete: () => {
            sendFlag.value = false
            isThinking.value = false
            isToolCalling.value = false
            currentController = null
            if (currentReplyText) {
              const rendered = md.render(currentReplyText)
              list.value.push({ content: rendered, role: 'assistant' })
              saveMessageToHistory(currentReplyText, 'assistant')
              message.value = ''
              nextTick(() => scrollToBottom())
            }
          }
        }
      )
    } catch (error) {
      logger.error('Failed to send message:', error)
      sendFlag.value = false
      isThinking.value = false
      isToolCalling.value = false
      currentController = null
    }
  }

  /**
   * 发送消息
   */
  const sendToQwenPaw = async (value: string) => {
    if (sendFlag.value) return
    if (currentController) currentController.abort()

    sendFlag.value = true
    text.value = ''

    if (value.trim() === '') {
      sendFlag.value = false
      return
    }

    if (isClearCommand(value)) {
      clearLocalHistory()
      await sendToQwenPawInternal('/clear')
      sendFlag.value = false
      return
    }

    list.value.push({ content: value, role: 'user' })
    saveMessageToHistory(value, 'user')
    nextTick(() => scrollToBottom())
    await sendToQwenPawInternal(value)
  }

  /**
   * 发送消息入口
   */
  const send = (value: string) => {
    sendToQwenPaw(value)
  }

  /**
   * 复制消息内容
   */
  const copyMessage = async (content: string, index: number) => {
    try {
      // 去除HTML标签，获取纯文本
      const text = content.replace(/<[^>]*>/g, '')
      await navigator.clipboard.writeText(text)
      // 标记已复制
      list.value[index].copied = true
      setTimeout(() => {
        list.value[index].copied = false
      }, 2000)
    } catch (e) {
      logger.error('Failed to copy:', e)
    }
  }

  /**
   * 关闭聊天窗口
   */
  const close = (resetPosition: () => void, emit: (event: 'close') => void) => {
    if (currentController) currentController.abort()
    resetPosition()
    emit('close')
  }

  /**
   * 停止当前会话
   * 同时调用 API 和中止 SSE 请求
   */
  const stop = async (): Promise<boolean> => {
    logger.info('Stopping current session...')

    // 1. 中止 SSE 请求
    if (currentController) {
      currentController.abort()
      currentController = null
    }

    // 2. 调用后端 API 停止会话
    const sessionId = getSessionId()
    let apiStopped = false
    if (sessionId) {
      apiStopped = await stopChat(sessionId)
      logger.info('API stop result:', apiStopped)
    }

    // 3. 重置状态
    sendFlag.value = false
    isThinking.value = false
    isToolCalling.value = false
    toolCallName.value = ''

    // 4. 如果有未完成的回复，保存它
    if (currentReplyText) {
      const md = getMarkdown()
      const rendered = md.render(currentReplyText)
      list.value.push({ content: rendered, role: 'assistant' })
      saveMessageToHistory(currentReplyText, 'assistant')
      currentReplyText = ''
      message.value = ''
    }

    return apiStopped
  }

  return {
    // 状态
    list,
    sendFlag,
    text,
    message,
    isThinking,
    isToolCalling,
    toolCallName,
    errorMessage,
    showScrollToBottom,
    // 方法
    send,
    stop,
    scrollToBottom,
    checkScrollPosition,
    queryConversation,
    clearLocalHistory,
    copyMessage,
    close,
    getMarkdown,
  }
}
