/**
 * Pixel Streaming Composable
 * 提供全局访问像素流服务的能力
 */

import { inject, type InjectionKey, type Ref } from 'vue'
import type { MCPCommand, MCPResponse, UEVersion } from '../pixelstreaming'

// 像素流上下文类型
export interface PixelStreamingContext {
  // 状态
  isConnected: Ref<boolean>
  isVideoReady: Ref<boolean>
  isSSEConnected: Ref<boolean>
  detectedVersion: Ref<UEVersion | null>
  errorMessage: Ref<string>

  // 方法
  connect: () => Promise<void>
  disconnect: () => void
  reconnect: () => void
  sendCommand: (command: MCPCommand) => boolean

  // 事件回调设置
  onCommand: (callback: (command: MCPCommand) => void) => () => void
  onResponse: (callback: (response: MCPResponse) => void) => () => void
  onConnected: (callback: () => void) => () => void
  onDisconnected: (callback: () => void) => () => void
  onError: (callback: (error: string) => void) => () => void
}

// Injection Key
export const PixelStreamingKey: InjectionKey<PixelStreamingContext> = Symbol('PixelStreaming')

/**
 * 使用像素流服务
 * 必须在 PixelStreaming 组件内部或其后代组件中使用
 */
export function usePixelStreaming(): PixelStreamingContext {
  const context = inject(PixelStreamingKey)

  if (!context) {
    throw new Error(
      'usePixelStreaming() must be used within a component that has PixelStreaming in its parent tree. ' +
      'Make sure PixelStreaming component is mounted before calling this composable.'
    )
  }

  return context
}

/**
 * 可选的使用方式：返回 undefined 而不是抛出错误
 * 用于在不确定 PixelStreaming 是否存在时安全使用
 */
export function usePixelStreamingOptional(): PixelStreamingContext | undefined {
  return inject(PixelStreamingKey)
}
