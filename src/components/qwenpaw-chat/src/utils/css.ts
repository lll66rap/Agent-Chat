/**
 * CSS 值解析工具
 *
 * 提供 CSS 尺寸值的解析和转换功能，支持 px 和 rem 单位
 *
 * @module qwenpaw-chat/utils/css
 */

/**
 * CSS 尺寸值类型
 * 支持：
 * - number: 视为像素值
 * - string: 支持 'px' 和 'rem' 单位
 */
export type CSSValue = number | string

/**
 * 解析 CSS 值为像素数值
 *
 * @param value - CSS 值（数字或字符串），undefined 时返回 fallback
 * @param fallback - 解析失败时的回退值
 * @returns 像素数值
 *
 * @example
 * ```typescript
 * parseCSSValue(100)        // 100
 * parseCSSValue('100px')    // 100
 * parseCSSValue('10rem')    // 160 (假设根字体大小为 16px)
 * parseCSSValue('invalid')  // 0 (回退值)
 * parseCSSValue(undefined)  // 0 (回退值)
 * ```
 */
export function parseCSSValue(value: CSSValue | undefined, fallback = 0): number {
  // undefined 返回回退值
  if (value === undefined) {
    return fallback
  }

  // 数字直接返回
  if (typeof value === 'number') {
    return value
  }

  // 字符串解析
  if (typeof value === 'string') {
    const trimmed = value.trim()

    // 纯数字（无单位）
    const numOnly = parseFloat(trimmed)
    if (!isNaN(numOnly) && trimmed === String(numOnly)) {
      return numOnly
    }

    // 像素值
    if (trimmed.endsWith('px')) {
      const num = parseFloat(trimmed)
      return isNaN(num) ? fallback : num
    }

    // rem 值 - 需要转换
    if (trimmed.endsWith('rem')) {
      const num = parseFloat(trimmed)
      if (isNaN(num)) {
        return fallback
      }
      // 获取根元素字体大小
      const rootFontSize = getRootFontSize()
      return num * rootFontSize
    }

    // 尝试解析为数字
    const num = parseFloat(trimmed)
    return isNaN(num) ? fallback : num
  }

  return fallback
}

/**
 * 格式化 CSS 值为字符串
 *
 * @param value - CSS 值
 * @returns CSS 字符串
 *
 * @example
 * ```typescript
 * formatCSSValue(100)       // '100px'
 * formatCSSValue('10rem')   // '10rem'
 * formatCSSValue('50%')     // '50%'
 * ```
 */
export function formatCSSValue(value: CSSValue): string {
  if (typeof value === 'number') {
    return `${value}px`
  }
  return value
}

/**
 * 获取根元素字体大小
 * 用于 rem 到 px 的转换
 *
 * @returns 根元素字体大小（像素）
 */
function getRootFontSize(): number {
  // 缓存根字体大小，避免频繁读取 DOM
  if (cachedRootFontSize !== null) {
    return cachedRootFontSize
  }

  try {
    const rootStyle = getComputedStyle(document.documentElement)
    const fontSize = rootStyle.fontSize
    const size = parseFloat(fontSize)

    if (!isNaN(size)) {
      cachedRootFontSize = size
      return size
    }
  } catch {
    // 忽略错误，使用默认值
  }

  // 默认 16px
  return 16
}

/**
 * 缓存的根元素字体大小
 */
let cachedRootFontSize: number | null = null

/**
 * 重置根字体大小缓存
 * 用于测试或响应字体大小变化
 */
export function resetRootFontSizeCache(): void {
  cachedRootFontSize = null
}
