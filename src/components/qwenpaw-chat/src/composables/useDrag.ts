/**
 * 拖拽功能 composable
 *
 * 提供窗口拖拽功能，包括：
 * - 鼠标拖拽移动窗口
 * - 边界约束（防止窗口超出屏幕）
 * - 位置持久化（localStorage）
 * - 窗口 resize 响应
 *
 * @module qwenpaw-chat/composables/useDrag
 * @example
 * ```vue
 * <script setup>
 * import { useDrag } from '@/components/qwenpaw-chat/src/composables/useDrag'
 *
 * const { dragState, windowPosition, computedLeft, resetPosition, onDragStart } = useDrag({
 *   width: 1024,
 *   draggable: true,
 *   debug: false
 * })
 * </script>
 *
 * <template>
 *   <div
 *     class="window"
 *     :style="{ left: computedLeft + 'px', bottom: windowPosition.bottom + 'px' }"
 *   >
 *     <div class="header" @mousedown="onDragStart">拖拽区域</div>
 *   </div>
 * </template>
 * ```
 */

import { ref, onMounted, onUnmounted } from 'vue'
import type { DragState, WindowPosition } from '../chat-types'
import { STORAGE_KEYS, WINDOW_DEFAULTS } from '../chat-constants'
import { createChatLogger } from '../utils/logger'
import { rafThrottle } from '../utils/performance'

/**
 * 拖拽功能选项
 */
export interface UseDragOptions {
  /** 窗口宽度（像素），用于计算边界约束 */
  width: number
  /** 是否启用拖拽功能 */
  draggable: boolean
  /** 是否启用调试日志 */
  debug?: boolean
}

/**
 * 拖拽功能 composable
 * @param options - 拖拽配置选项
 * @returns 拖拽状态和方法
 */
export function useDrag(options: UseDragOptions) {
  const { width, draggable, debug = false } = options
  const logger = createChatLogger('useDrag', debug)

  // 拖拽状态
  const dragState = ref<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startBottom: 0
  })

  // 窗口位置状态
  const windowPosition = ref<WindowPosition>({
    left: null,  // null 表示居中
    bottom: WINDOW_DEFAULTS.BOTTOM
  })

  // 计算实际 left 位置
  const computedLeft = ref(0)

  /**
   * 重置位置到默认（居中）
   */
  const resetPosition = () => {
    windowPosition.value = { left: null, bottom: WINDOW_DEFAULTS.BOTTOM }
    computedLeft.value = window.innerWidth / 2
    // 清除保存的位置
    try {
      localStorage.removeItem(STORAGE_KEYS.POSITION)
    } catch (e) {
      logger.warn('Failed to clear saved position:', e)
    }
  }

  /**
   * 加载保存的位置
   */
  const loadSavedPosition = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.POSITION)
      if (saved) {
        const pos = JSON.parse(saved) as WindowPosition
        // 验证位置数据
        if (pos && typeof pos.bottom === 'number') {
          // left 为 null 表示居中
          if (pos.left === null) {
            windowPosition.value = { left: null, bottom: pos.bottom }
            computedLeft.value = window.innerWidth / 2
            return
          }
          // left 有具体值，验证是否在屏幕范围内
          if (typeof pos.left === 'number') {
            const maxLeft = window.innerWidth - width / 2 - 10
            const maxBottom = window.innerHeight - 100
            if (pos.left > 0 && pos.left <= maxLeft && pos.bottom >= 10 && pos.bottom <= maxBottom) {
              windowPosition.value = { left: pos.left, bottom: pos.bottom }
              computedLeft.value = pos.left
              return
            }
          }
        }
      }
    } catch (e) {
      logger.warn('Failed to load saved position:', e)
    }
    // 默认位置
    resetPosition()
  }

  /**
   * 保存位置到 localStorage
   */
  const savePosition = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.POSITION, JSON.stringify(windowPosition.value))
    } catch (e) {
      logger.warn('Failed to save position:', e)
    }
  }

  /**
   * 拖拽开始
   */
  const onDragStart = (e: MouseEvent) => {
    if (!draggable) return

    // 忽略关闭按钮的点击
    const target = e.target as HTMLElement
    if (target.closest('.close-btn')) return

    logger.debug('Drag start', { clientX: e.clientX, clientY: e.clientY })

    dragState.value = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: computedLeft.value,
      startBottom: windowPosition.value.bottom
    }

    // 添加全局事件监听
    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragEnd)
  }

  /**
   * 拖拽移动（使用 rafThrottle 限制每帧最多执行一次）
   */
  const onDragMoveRaw = (e: MouseEvent) => {
    if (!dragState.value.isDragging) return

    const deltaX = e.clientX - dragState.value.startX
    const deltaY = e.clientY - dragState.value.startY

    // 计算新位置
    let newLeft = dragState.value.startLeft + deltaX
    let newBottom = dragState.value.startBottom - deltaY

    // 边界限制
    const halfWidth = width / 2
    const minLeft = halfWidth + 10
    const maxLeft = window.innerWidth - halfWidth - 10
    const minBottom = 10
    const maxBottom = window.innerHeight - 100

    newLeft = Math.max(minLeft, Math.min(maxLeft, newLeft))
    newBottom = Math.max(minBottom, Math.min(maxBottom, newBottom))

    computedLeft.value = newLeft
    windowPosition.value.left = newLeft
    windowPosition.value.bottom = newBottom
  }

  const onDragMove = rafThrottle(onDragMoveRaw)

  /**
   * 拖拽结束
   */
  const onDragEnd = () => {
    if (dragState.value.isDragging) {
      dragState.value.isDragging = false
      savePosition()
    }

    // 移除全局事件监听
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
  }

  /**
   * 窗口大小变化时更新居中位置（使用 throttle 限制频率）
   */
  const onResizeRaw = () => {
    // 只有当窗口是居中状态时才更新位置
    if (windowPosition.value.left === null) {
      computedLeft.value = window.innerWidth / 2
    }
  }

  const onResize = rafThrottle(onResizeRaw)

  // 生命周期
  onMounted(() => {
    loadSavedPosition()
    window.addEventListener('resize', onResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', onResize)
    // 清理拖拽事件
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
  })

  return {
    // 状态
    dragState,
    windowPosition,
    computedLeft,
    // 方法
    resetPosition,
    loadSavedPosition,
    savePosition,
    onDragStart,
  }
}
