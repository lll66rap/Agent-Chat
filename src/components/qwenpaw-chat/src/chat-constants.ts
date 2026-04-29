/**
 * QwenPaw Chat 常量定义
 *
 * 统一管理所有配置值，包括：
 * - API 超时和重试配置
 * - localStorage 存储键名
 * - 窗口默认尺寸
 * - 消息配置
 * - 环境变量默认值
 *
 * @module qwenpaw-chat/constants
 * @example
 * ```typescript
 * import { CHAT_CONFIG, STORAGE_KEYS, WINDOW_DEFAULTS } from '@/components/qwenpaw-chat/src/chat-constants'
 *
 * // 使用超时配置
 * const timeout = CHAT_CONFIG.TIMEOUT
 *
 * // 构建存储键
 * const historyKey = `${STORAGE_KEYS.HISTORY_PREFIX}${userId}`
 * ```
 */

/**
 * 聊天配置常量
 * 控制 API 请求行为和历史记录管理
 */
export const CHAT_CONFIG = {
  /** API 请求超时：60秒 */
  TIMEOUT: 60000,
  /** 历史记录最大条数 */
  MAX_HISTORY: 50,
  /** SSE 重试次数 */
  MAX_RETRIES: 3,
  /** 重试基础延迟：1秒 */
  BASE_DELAY: 1000,
  /** 重试最大延迟：30秒 */
  MAX_DELAY: 30000,
} as const

/**
 * localStorage 存储键名
 * 用于持久化用户数据和会话状态
 */
export const STORAGE_KEYS = {
  /** 用户 ID 键名，用于标识用户身份 */
  USER_ID: 'qwenpaw_user_id',
  /** 历史记录键名前缀，需拼接用户 ID 使用：`${HISTORY_PREFIX}${userId}` */
  HISTORY_PREFIX: 'qwenpaw_history_',
  /** 窗口位置键名，用于保存拖拽后的窗口位置 */
  POSITION: 'qwenpaw_chat_position',
} as const

/**
 * 窗口默认配置
 * 定义聊天窗口的初始尺寸和位置
 */
export const WINDOW_DEFAULTS = {
  /** 默认窗口宽度（像素） */
  WIDTH: 1024,
  /** 默认内容区最大高度（像素） */
  MAX_HEIGHT: 640,
  /** 默认窗口底部距离（像素） */
  BOTTOM: 333,
} as const

/**
 * 消息配置
 * 定义消息显示相关的默认值
 */
export const MESSAGE_CONFIG = {
  /** 默认标题，显示在聊天窗口头部 */
  TITLE: '智能助手',
  /** 默认输入框占位符文本 */
  PLACEHOLDER: '请输入问题 (/clear 清空历史)',
  /** 复制成功反馈显示时间（毫秒） */
  COPY_FEEDBACK_DURATION: 2000,
} as const

/**
 * 环境变量默认值
 * 当环境变量未配置时使用的默认值
 */
export const ENV_DEFAULTS = {
  /** 开发环境 API 路径，通过 Vite 代理访问 */
  DEV_API_PATH: '/api/console/chat',
  /** 默认 Agent ID，用于标识智能体 */
  AGENT_ID: 'default',
  /** 默认渠道标识 */
  CHANNEL: 'console',
} as const
