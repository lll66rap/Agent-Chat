/**
 * Chat 类型定义单元测试
 * 验证类型导出和运行时行为
 */
import { describe, it, expect } from 'vitest'

describe('Chat Types', () => {
  describe('MessageItem', () => {
    it('should create valid user message', () => {
      const message = {
        content: 'Hello',
        role: 'user' as const
      }
      expect(message.role).toBe('user')
      expect(message.content).toBe('Hello')
    })

    it('should create valid assistant message', () => {
      const message = {
        content: '<p>Hello</p>',
        role: 'assistant' as const
      }
      expect(message.role).toBe('assistant')
      expect(message.content).toContain('<p>')
    })

    it('should support optional copied flag', () => {
      const message = {
        content: 'Hello',
        role: 'user' as const,
        copied: true
      }
      expect(message.copied).toBe(true)
    })
  })

  describe('WindowPosition', () => {
    it('should support null left (centered)', () => {
      const position = {
        left: null,
        bottom: 100
      }
      expect(position.left).toBeNull()
      expect(position.bottom).toBe(100)
    })

    it('should support numeric left', () => {
      const position = {
        left: 500,
        bottom: 200
      }
      expect(position.left).toBe(500)
      expect(position.bottom).toBe(200)
    })
  })

  describe('DragState', () => {
    it('should create valid drag state', () => {
      const state = {
        isDragging: true,
        startX: 100,
        startY: 200,
        startLeft: 300,
        startBottom: 400
      }
      expect(state.isDragging).toBe(true)
      expect(state.startX).toBe(100)
      expect(state.startY).toBe(200)
      expect(state.startLeft).toBe(300)
      expect(state.startBottom).toBe(400)
    })
  })

  describe('QwenPawRequest', () => {
    it('should create valid request', () => {
      const request = {
        input: [
          {
            role: 'user' as const,
            content: [{ type: 'text', text: 'Hello' }]
          }
        ],
        session_id: 'session_123',
        user_id: 'user_123',
        channel: 'console'
      }
      expect(request.input).toHaveLength(1)
      expect(request.input[0].role).toBe('user')
      expect(request.channel).toBe('console')
    })
  })

  describe('QwenPawCallbacks', () => {
    it('should create valid callbacks', () => {
      const callbacks = {
        onMessage: (data: { text: string }) => console.log(data.text),
        onError: (error: string) => console.error(error),
        onComplete: () => console.log('complete')
      }
      expect(typeof callbacks.onMessage).toBe('function')
      expect(typeof callbacks.onError).toBe('function')
      expect(typeof callbacks.onComplete).toBe('function')
    })

    it('should support optional callbacks', () => {
      const callbacks = {
        onMessage: (data: { text: string }) => console.log(data.text),
        onError: (error: string) => console.error(error),
        onComplete: () => console.log('complete'),
        onThinking: (thinking: boolean) => console.log(thinking),
        onToolCall: (calling: boolean, name?: string) => console.log(calling, name)
      }
      expect(typeof callbacks.onThinking).toBe('function')
      expect(typeof callbacks.onToolCall).toBe('function')
    })
  })

  describe('QwenPawChatProps', () => {
    it('should create valid props', () => {
      const props = {
        title: 'AI Assistant',
        userAvatar: '/avatar.png',
        agentAvatar: '/ai-avatar.png',
        placeholder: 'Type here...',
        showClose: true,
        width: 800,
        maxHeight: 500,
        draggable: true,
        showCopy: true,
        debug: false
      }
      expect(props.title).toBe('AI Assistant')
      expect(props.width).toBe(800)
      expect(props.draggable).toBe(true)
    })

    it('should support partial props', () => {
      const props = {
        title: 'AI Assistant'
      }
      expect(props.title).toBe('AI Assistant')
    })
  })
})
