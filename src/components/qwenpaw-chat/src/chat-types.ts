/**
 * QwenPaw Chat 类型定义
 *
 * 本模块定义了 QwenPaw Chat 组件所需的所有 TypeScript 类型。
 * 包括 API 请求/响应类型、消息类型、UI 状态类型等。
 *
 * @module qwenpaw-chat/types
 */

/**
 * SSE 响应内容项
 * 表示消息中的单个内容块（文本、代码等）
 */
export interface QwenPawContentItem {
  /** 内容类型，如 'text' */
  type: string
  /** 文本内容 */
  text?: string
  /** 是否为思考内容（reasoning） */
  is_thought?: boolean
}

/**
 * SSE 响应消息
 * 表示 API 返回的单条消息
 */
export interface QwenPawOutputMessage {
  /** 消息角色，如 'assistant' */
  role: string
  /** 消息类型：reasoning（思考）、message（消息）、plugin_call（工具调用）、plugin_call_output（工具输出） */
  type?: string
  /** 内容数组 */
  content: QwenPawContentItem[]
  /** 工具名称（当 type 为 plugin_call 时） */
  name?: string
}

/**
 * SSE 响应格式
 * 根据 QwenPaw API 实际响应格式定义
 *
 * @example
 * ```typescript
 * // 流式文本响应
 * {
 *   object: 'content',
 *   type: 'text',
 *   status: 'in_progress',
 *   text: '你好',
 *   msg_id: 'msg_xxx'
 * }
 *
 * // 思考阶段响应
 * {
 *   object: 'message',
 *   type: 'reasoning',
 *   id: 'msg_xxx'
 * }
 * ```
 */
export interface QwenPawResponse {
  /** 序列号 */
  sequence_number?: number
  /** 对象类型：'response'、'message'、'content' */
  object?: string
  /** 状态：'created'、'in_progress'、'completed' */
  status?: string
  /** 错误信息 */
  error?: {
    message: string
  }
  /** 消息 ID */
  id?: string
  /** 创建时间戳 */
  created_at?: number
  /** 完成时间戳 */
  completed_at?: number | null
  /** 输出消息数组（旧格式） */
  output?: QwenPawOutputMessage[]
  /** 用量统计 */
  usage?: unknown
  /** 会话 ID，用于保持多轮对话上下文 */
  session_id?: string
  /** 用户 ID */
  user_id?: string
  /** 消息类型：'reasoning'、'text'、'message' 等 */
  type?: string
  /** 角色，如 'assistant' */
  role?: string
  /** 内容 */
  content?: unknown
  /** 代码 */
  code?: unknown
  /** 消息 */
  message?: unknown
  /** 元数据 */
  metadata?: Record<string, unknown>
  /** 索引 */
  index?: number
  /** 是否为增量内容 */
  delta?: boolean
  /** 关联的消息 ID（用于追踪内容属于哪条消息） */
  msg_id?: string
  /** 流式文本内容 */
  text?: string
  /** 工具名称 */
  name?: string
}

/**
 * SSE 请求输入项
 * 表示发送给 API 的单条输入消息
 */
export interface QwenPawInputItem {
  /** 角色：'user'（用户）或 'assistant'（助手） */
  role: 'user' | 'assistant'
  /** 内容数组 */
  content: QwenPawContentItem[]
}

/**
 * SSE 请求参数
 * 按照 QwenPaw API 官方示例格式定义
 *
 * @example
 * ```typescript
 * const request: QwenPawRequest = {
 *   input: [
 *     {
 *       role: 'user',
 *       content: [{ type: 'text', text: '你好' }]
 *     }
 *   ],
 *   session_id: 'session_xxx',
 *   user_id: 'user_xxx',
 *   channel: 'default'
 * }
 * ```
 */
export interface QwenPawRequest {
  /** 输入消息数组 */
  input: QwenPawInputItem[]
  /** 会话 ID（可选，用于保持上下文） */
  session_id?: string
  /** 用户 ID */
  user_id: string
  /** 渠道标识 */
  channel: string
}

/**
 * SSE 回调参数
 * 用于处理流式响应的各种事件
 *
 * @example
 * ```typescript
 * const callbacks: QwenPawCallbacks = {
 *   onMessage: (data) => console.log('消息:', data.text),
 *   onThinking: (thinking) => console.log('思考中:', thinking),
 *   onToolCall: (calling, name) => console.log('工具调用:', name),
 *   onError: (error) => console.error('错误:', error),
 *   onComplete: () => console.log('完成')
 * }
 * ```
 */
export interface QwenPawCallbacks {
  /** 收到消息时的回调 */
  onMessage: (data: { text: string; session_id?: string }) => void
  /** 思考状态变化时的回调（可选） */
  onThinking?: (isThinking: boolean) => void
  /** 工具调用状态变化时的回调（可选） */
  onToolCall?: (isToolCalling: boolean, toolName?: string) => void
  /** 发生错误时的回调 */
  onError: (error: string) => void
  /** 请求完成时的回调 */
  onComplete: () => void
}

/**
 * 消息项
 * 用于渲染聊天消息列表
 */
export interface MessageItem {
  /** 消息内容（HTML 格式） */
  content: string
  /** 角色：'user'（用户）或 'assistant'（助手） */
  role: 'user' | 'assistant'
  /** 是否已复制（用于显示复制状态） */
  copied?: boolean
}

/**
 * 窗口位置
 * 用于拖拽定位
 */
export interface WindowPosition {
  /** 左侧位置（像素），null 表示居中 */
  left: number | null
  /** 底部距离（像素） */
  bottom: number
}

/**
 * 拖拽状态
 * 用于跟踪拖拽过程中的鼠标位置
 */
export interface DragState {
  /** 是否正在拖拽 */
  isDragging: boolean
  /** 拖拽开始时的鼠标 X 坐标 */
  startX: number
  /** 拖拽开始时的鼠标 Y 坐标 */
  startY: number
  /** 拖拽开始时的窗口左侧位置 */
  startLeft: number
  /** 拖拽开始时的窗口底部距离 */
  startBottom: number
}

/**
 * QwenPawChat 组件 Props
 * 定义组件的所有可配置属性
 */
export interface QwenPawChatProps {
  /** 标题（显示在头部） */
  title?: string
  /** 用户头像 URL */
  userAvatar?: string
  /** 智能体头像 URL */
  agentAvatar?: string
  /** 输入框占位符文本 */
  placeholder?: string
  /** 是否显示关闭按钮 */
  showClose?: boolean
  /** 窗口宽度（像素），默认 1024 */
  width?: number
  /** 内容区最大高度（像素），默认 640 */
  maxHeight?: number
  /** 是否可拖拽 */
  draggable?: boolean
  /** 是否显示复制按钮 */
  showCopy?: boolean
  /** 是否开启调试日志 */
  debug?: boolean
}
