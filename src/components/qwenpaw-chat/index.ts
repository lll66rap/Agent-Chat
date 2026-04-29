/**
 * QwenPaw Chat - 可复用的智能体聊天组件
 *
 * 快速迁移指南：
 * 1. 复制整个 qwenpaw-chat 目录到目标项目
 * 2. 安装依赖：npm install markdown-it @epicgames-ps/lib-pixelstreamingfrontend-ue5.7
 * 3. 在组件中导入使用：
 *    import QwenPawChat from '@/components/qwenpaw-chat'
 *
 * 4. 配置环境变量（可选）：
 *    VITE_QWENPAW_API_URL=/api/console/chat
 *    VITE_QWENPAW_API_KEY=your-api-key
 *    VITE_QWENPAW_AGENT_ID=default
 *    VITE_QWENPAW_TIMEOUT=60000
 */

// 组件
export { default as QwenPawChat } from './src/QwenPawChat.vue'
export { default as PixelStreaming } from './src/PixelStreaming.vue'

// 子组件
export { default as ChatMessage } from './src/components/ChatMessage.vue'
export { default as ChatInput } from './src/components/ChatInput.vue'

// Composables
export { useDrag } from './src/composables/useDrag'
export type { UseDragOptions } from './src/composables/useDrag'
export { useChat } from './src/composables/useChat'
export type { UseChatOptions } from './src/composables/useChat'
export { usePixelStreaming, usePixelStreamingOptional } from './src/composables/usePixelStreaming'
export type { PixelStreamingContext } from './src/composables/usePixelStreaming'

// 默认导出组件
import QwenPawChat from './src/QwenPawChat.vue'
export default QwenPawChat

// API 工具
export {
  qwenPawGenerateSse,
  stopChat,
  getConversation,
  saveMessageToHistory,
  clearConversation,
  isClearCommand,
  getUserId,
  setUserId,
  setSessionId,
  getSessionId,
  setDebugMode,
} from './src/api'

// 像素流服务（新版本，推荐使用）
export {
  // 服务
  PixelStreamingService,

  // 错误类型
  PixelStreamingError,
  ErrorCodes,
  createError,
  isRecoverable,
  isErrorCode,

  // 工具
  createLogger,
  SSEClient,

  // 适配器
  AdapterFactory,
  ModernAdapter,
  LegacyAdapter,

  // 常量
  TIMEOUTS,
  RECONNECT,
  DEFAULT_URLS,

  // 状态标签
  ConnectionStateLabels,
} from './src/pixelstreaming'

// Chat 类型
export type {
  QwenPawResponse,
  QwenPawRequest,
  QwenPawCallbacks,
  QwenPawContentItem,
  QwenPawOutputMessage,
  QwenPawInputItem,
  MessageItem,
  WindowPosition,
  DragState,
  QwenPawChatProps,
} from './src/chat-types'

// Chat 常量
export {
  CHAT_CONFIG,
  STORAGE_KEYS,
  WINDOW_DEFAULTS,
  MESSAGE_CONFIG,
  ENV_DEFAULTS,
} from './src/chat-constants'

// Chat 错误处理
export {
  ChatError,
  ChatErrorCodes,
  createChatError,
  isChatRecoverable,
  isChatErrorCode,
} from './src/chat-errors'
export type { ChatErrorCode } from './src/chat-errors'

// Chat 工具
export {
  createChatLogger,
  setDebugMode as setChatDebugMode,
} from './src/utils/logger'
export {
  throttle,
  debounce,
  rafThrottle,
} from './src/utils/performance'

// 像素流类型（从 pixelstreaming 重新导出）
export type {
  UEVersion,
  PixelStreamingConfig,
  MCPCommand,
  MCPResponse,
  ConnectionStatus,
  ConnectionState,
  PixelStreamingCallbacks,
  IPixelStreamingAdapter,
} from './src/pixelstreaming'
