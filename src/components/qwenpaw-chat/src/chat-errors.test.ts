/**
 * Chat 错误处理单元测试
 */
import { describe, it, expect } from 'vitest'
import {
  ChatError,
  ChatErrorCodes,
  createChatError,
  isChatRecoverable,
  isChatErrorCode
} from './chat-errors'

describe('ChatError', () => {
  it('should create error with code', () => {
    const error = new ChatError(ChatErrorCodes.NETWORK_ERROR)
    expect(error.code).toBe(ChatErrorCodes.NETWORK_ERROR)
  })

  it('should create error with custom message', () => {
    const error = new ChatError(ChatErrorCodes.NETWORK_ERROR, 'Custom message')
    expect(error.message).toBe('Custom message')
  })

  it('should have correct name', () => {
    const error = new ChatError(ChatErrorCodes.NETWORK_ERROR)
    expect(error.name).toBe('ChatError')
  })

  it('should be instance of Error', () => {
    const error = new ChatError(ChatErrorCodes.NETWORK_ERROR)
    expect(error).toBeInstanceOf(Error)
  })

  it('should have timestamp', () => {
    const error = new ChatError(ChatErrorCodes.NETWORK_ERROR)
    expect(error.timestamp).toBeDefined()
    expect(typeof error.timestamp).toBe('number')
  })

  it('should have optional context', () => {
    const context = { key: 'value' }
    const error = new ChatError(ChatErrorCodes.NETWORK_ERROR, 'Test', { context })
    expect(error.context).toEqual(context)
  })

  it('should have recoverable flag', () => {
    const error = new ChatError(ChatErrorCodes.NETWORK_ERROR, 'Test', { recoverable: true })
    expect(error.recoverable).toBe(true)
  })

  it('should default recoverable to false', () => {
    const error = new ChatError(ChatErrorCodes.NETWORK_ERROR)
    expect(error.recoverable).toBe(false)
  })

  it('should have fullMessage getter', () => {
    const error = new ChatError(ChatErrorCodes.NETWORK_ERROR, 'Test message')
    expect(error.fullMessage).toBe(`[${ChatErrorCodes.NETWORK_ERROR}] Test message`)
  })

  it('should have toJSON method', () => {
    const error = new ChatError(ChatErrorCodes.NETWORK_ERROR, 'Test')
    const json = error.toJSON()
    expect(json.name).toBe('ChatError')
    expect(json.code).toBe(ChatErrorCodes.NETWORK_ERROR)
    expect(json.message).toBe('Test')
  })
})

describe('ChatErrorCodes', () => {
  it('should have SSE_TIMEOUT code', () => {
    expect(ChatErrorCodes.SSE_TIMEOUT).toBe('C001')
  })

  it('should have SSE_CONNECTION_FAILED code', () => {
    expect(ChatErrorCodes.SSE_CONNECTION_FAILED).toBe('C002')
  })

  it('should have NETWORK_ERROR code', () => {
    expect(ChatErrorCodes.NETWORK_ERROR).toBe('C003')
  })

  it('should have PARSE_ERROR code', () => {
    expect(ChatErrorCodes.PARSE_ERROR).toBe('C101')
  })

  it('should have API_ERROR code', () => {
    expect(ChatErrorCodes.API_ERROR).toBe('C201')
  })

  it('should have STORAGE_ERROR code', () => {
    expect(ChatErrorCodes.STORAGE_ERROR).toBe('C301')
  })

  it('should have unique codes', () => {
    const codes = Object.values(ChatErrorCodes)
    const uniqueCodes = new Set(codes)
    expect(uniqueCodes.size).toBe(codes.length)
  })
})

describe('createChatError', () => {
  it('should create SSE timeout error', () => {
    const error = createChatError.sseTimeout(60000)
    expect(error).toBeInstanceOf(ChatError)
    expect(error.code).toBe(ChatErrorCodes.SSE_TIMEOUT)
    expect(error.message).toContain('60000')
  })

  it('should create SSE connection failed error', () => {
    const error = createChatError.sseConnectionFailed('https://example.com')
    expect(error).toBeInstanceOf(ChatError)
    expect(error.code).toBe(ChatErrorCodes.SSE_CONNECTION_FAILED)
    expect(error.message).toContain('example.com')
  })

  it('should create network error', () => {
    const error = createChatError.networkError('Connection refused')
    expect(error).toBeInstanceOf(ChatError)
    expect(error.code).toBe(ChatErrorCodes.NETWORK_ERROR)
    expect(error.message).toBe('Connection refused')
  })

  it('should create parse error', () => {
    const error = createChatError.parseError('invalid json')
    expect(error).toBeInstanceOf(ChatError)
    expect(error.code).toBe(ChatErrorCodes.PARSE_ERROR)
  })

  it('should create API error', () => {
    const error = createChatError.apiError('Rate limit exceeded', 429)
    expect(error).toBeInstanceOf(ChatError)
    expect(error.code).toBe(ChatErrorCodes.API_ERROR)
    expect(error.context?.status).toBe(429)
  })
})

describe('isChatRecoverable', () => {
  it('should return true for recoverable error', () => {
    const error = new ChatError(ChatErrorCodes.NETWORK_ERROR, 'Network error', { recoverable: true })
    expect(isChatRecoverable(error)).toBe(true)
  })

  it('should return false for non-recoverable error', () => {
    const error = new ChatError(ChatErrorCodes.API_ERROR, 'API error', { recoverable: false })
    expect(isChatRecoverable(error)).toBe(false)
  })

  it('should return false for regular Error', () => {
    const error = new Error('Regular error')
    expect(isChatRecoverable(error)).toBe(false)
  })
})

describe('isChatErrorCode', () => {
  it('should return true for matching error code', () => {
    const error = new ChatError(ChatErrorCodes.NETWORK_ERROR)
    expect(isChatErrorCode(error, ChatErrorCodes.NETWORK_ERROR)).toBe(true)
  })

  it('should return false for non-matching error code', () => {
    const error = new ChatError(ChatErrorCodes.NETWORK_ERROR)
    expect(isChatErrorCode(error, ChatErrorCodes.API_ERROR)).toBe(false)
  })

  it('should return false for regular Error', () => {
    const error = new Error('Regular error')
    expect(isChatErrorCode(error, ChatErrorCodes.NETWORK_ERROR)).toBe(false)
  })
})
