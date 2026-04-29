/**
 * 性能优化工具
 *
 * 提供函数节流和防抖工具，用于优化高频事件处理：
 * - `throttle`: 节流函数，限制函数在指定时间间隔内最多执行一次
 * - `debounce`: 防抖函数，延迟执行，在延迟期间再次调用会重新计时
 * - `rafThrottle`: requestAnimationFrame 节流，限制函数每帧最多执行一次
 *
 * @module qwenpaw-chat/utils/performance
 * @example
 * ```typescript
 * import { throttle, debounce, rafThrottle } from '@/components/qwenpaw-chat/src/utils/performance'
 *
 * // 节流：每 100ms 最多执行一次
 * const throttledScroll = throttle(handleScroll, 100)
 * window.addEventListener('scroll', throttledScroll)
 *
 * // 防抖：停止输入 300ms 后执行
 * const debouncedSearch = debounce(search, 300)
 * input.addEventListener('input', debouncedSearch)
 *
 * // RAF 节流：每帧最多执行一次
 * const rafThrottledMove = rafThrottle(handleMove)
 * element.addEventListener('mousemove', rafThrottledMove)
 * ```
 */

/**
 * 节流函数
 * 限制函数在指定时间间隔内最多执行一次
 *
 * @typeParam T - 函数类型
 * @param fn - 要节流的函数
 * @param delay - 节流间隔（毫秒）
 * @returns 节流后的函数
 *
 * @example
 * ```typescript
 * // 每秒最多执行一次
 * const throttled = throttle(() => {
 *   console.log('执行')
 * }, 1000)
 *
 * // 快速调用 10 次，只会执行约 10 次（每秒 1 次）
 * for (let i = 0; i < 10; i++) {
 *   throttled()
 * }
 * ```
 */
export function throttle<T extends (...args: never[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCall

    // 如果距离上次调用时间超过 delay，立即执行
    if (timeSinceLastCall >= delay) {
      lastCall = now
      fn(...args)
    } else {
      // 否则，设置定时器在剩余时间后执行
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        lastCall = Date.now()
        fn(...args)
        timeoutId = null
      }, delay - timeSinceLastCall)
    }
  }
}

/**
 * 防抖函数
 * 延迟执行，在延迟期间再次调用会重新计时
 *
 * @typeParam T - 函数类型
 * @param fn - 要防抖的函数
 * @param delay - 延迟时间（毫秒）
 * @returns 防抖后的函数
 *
 * @example
 * ```typescript
 * // 停止输入 300ms 后执行搜索
 * const debouncedSearch = debounce((query) => {
 *   fetchSearchResults(query)
 * }, 300)
 *
 * input.addEventListener('input', (e) => {
 *   debouncedSearch(e.target.value)
 * })
 * ```
 */
export function debounce<T extends (...args: never[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}

/**
 * requestAnimationFrame 节流
 * 限制函数每帧最多执行一次，适合动画和拖拽场景
 *
 * @typeParam T - 函数类型
 * @param fn - 要节流的函数
 * @returns RAF 节流后的函数
 *
 * @example
 * ```typescript
 * // 拖拽时每帧最多更新一次位置
 * const throttledMove = rafThrottle((x, y) => {
 *   element.style.left = x + 'px'
 *   element.style.top = y + 'px'
 * })
 *
 * element.addEventListener('mousemove', (e) => {
 *   throttledMove(e.clientX, e.clientY)
 * })
 * ```
 */
export function rafThrottle<T extends (...args: never[]) => unknown>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null

  return (...args: Parameters<T>) => {
    if (rafId !== null) {
      return
    }
    rafId = requestAnimationFrame(() => {
      fn(...args)
      rafId = null
    })
  }
}
