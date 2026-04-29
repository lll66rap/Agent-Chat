/**
 * Chat 常量定义单元测试
 */
import { describe, it, expect } from 'vitest'
import {
  CHAT_CONFIG,
  STORAGE_KEYS,
  WINDOW_DEFAULTS,
  MESSAGE_CONFIG,
  ENV_DEFAULTS
} from './chat-constants'

describe('CHAT_CONFIG', () => {
  it('should have correct timeout value', () => {
    expect(CHAT_CONFIG.TIMEOUT).toBe(60000)
  })

  it('should have correct max history value', () => {
    expect(CHAT_CONFIG.MAX_HISTORY).toBe(50)
  })

  it('should have correct max retries value', () => {
    expect(CHAT_CONFIG.MAX_RETRIES).toBe(3)
  })

  it('should have correct base delay value', () => {
    expect(CHAT_CONFIG.BASE_DELAY).toBe(1000)
  })

  it('should have correct max delay value', () => {
    expect(CHAT_CONFIG.MAX_DELAY).toBe(30000)
  })

  it('should be readonly (as const)', () => {
    // TypeScript 的 as const 使对象变为深度只读
    // 运行时无法直接测试，但可以验证值存在
    expect(Object.keys(CHAT_CONFIG)).toHaveLength(5)
  })
})

describe('STORAGE_KEYS', () => {
  it('should have correct user id key', () => {
    expect(STORAGE_KEYS.USER_ID).toBe('qwenpaw_user_id')
  })

  it('should have correct history prefix', () => {
    expect(STORAGE_KEYS.HISTORY_PREFIX).toBe('qwenpaw_history_')
  })

  it('should have correct position key', () => {
    expect(STORAGE_KEYS.POSITION).toBe('qwenpaw_chat_position')
  })

  it('should generate valid history key when combined with user id', () => {
    const userId = 'user_123'
    const historyKey = `${STORAGE_KEYS.HISTORY_PREFIX}${userId}`
    expect(historyKey).toBe('qwenpaw_history_user_123')
  })
})

describe('WINDOW_DEFAULTS', () => {
  it('should have correct default width', () => {
    expect(WINDOW_DEFAULTS.WIDTH).toBe(1024)
  })

  it('should have correct default max height', () => {
    expect(WINDOW_DEFAULTS.MAX_HEIGHT).toBe(640)
  })

  it('should have correct default bottom position', () => {
    expect(WINDOW_DEFAULTS.BOTTOM).toBe(333)
  })

  it('should have reasonable values for typical screen sizes', () => {
    // 宽度应该适合常见的桌面屏幕
    expect(WINDOW_DEFAULTS.WIDTH).toBeGreaterThan(320)
    expect(WINDOW_DEFAULTS.WIDTH).toBeLessThan(1920)

    // 高度应该合理
    expect(WINDOW_DEFAULTS.MAX_HEIGHT).toBeGreaterThan(200)
    expect(WINDOW_DEFAULTS.MAX_HEIGHT).toBeLessThan(1080)
  })
})

describe('MESSAGE_CONFIG', () => {
  it('should have correct default title', () => {
    expect(MESSAGE_CONFIG.TITLE).toBe('智能助手')
  })

  it('should have correct default placeholder', () => {
    expect(MESSAGE_CONFIG.PLACEHOLDER).toBe('请输入问题 (/clear 清空历史)')
  })

  it('should have correct copy feedback duration', () => {
    expect(MESSAGE_CONFIG.COPY_FEEDBACK_DURATION).toBe(2000)
  })

  it('should have non-empty title and placeholder', () => {
    expect(MESSAGE_CONFIG.TITLE.length).toBeGreaterThan(0)
    expect(MESSAGE_CONFIG.PLACEHOLDER.length).toBeGreaterThan(0)
  })
})

describe('ENV_DEFAULTS', () => {
  it('should have correct dev api path', () => {
    expect(ENV_DEFAULTS.DEV_API_PATH).toBe('/api/console/chat')
  })

  it('should have correct default agent id', () => {
    expect(ENV_DEFAULTS.AGENT_ID).toBe('default')
  })

  it('should have correct default channel', () => {
    expect(ENV_DEFAULTS.CHANNEL).toBe('console')
  })

  it('should have valid api path format', () => {
    // API 路径应该以 / 开头
    expect(ENV_DEFAULTS.DEV_API_PATH.startsWith('/')).toBe(true)
  })
})
