<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, provide } from 'vue'
import {
  PixelStreamingService,
  MCPCommand,
  MCPResponse,
  UEVersion,
  TIMEOUTS,
  DEFAULT_URLS,
} from './pixelstreaming'
import { PixelStreamingKey, type PixelStreamingContext } from './composables/usePixelStreaming'

// Props
const props = defineProps<{
  signallingUrl?: string      // 信令服务器地址
  mcpBridgeUrl?: string       // MCP Bridge 地址
  ueVersion?: UEVersion       // UE 版本（可选，自动检测）
  autoConnect?: boolean       // 是否自动连接（默认 true）
  debug?: boolean             // 调试模式：启用调试功能、显示切换按钮（默认 false）
  showDebugPanel?: boolean    // 调试面板初始显示状态（需要 debug=true 才生效）
  simulateMode?: boolean      // 模拟模式（测试用）
  initialSettings?: {         // 初始设置
    AutoConnect?: boolean
    AutoPlayVideo?: boolean
    StartVideoMuted?: boolean
    UseMic?: boolean
    UseCamera?: boolean
    MatchViewportResolution?: boolean
  }
  mouseInteraction?: {        // 鼠标交互配置
    HoveringMouse?: boolean
    FakeMouseWithTouches?: boolean
  }
}>()

// Emits
const emit = defineEmits<{
  (e: 'connected'): void
  (e: 'disconnected'): void
  (e: 'error', message: string): void
  (e: 'command', command: MCPCommand): void
  (e: 'response', response: MCPResponse): void
  (e: 'versionDetected', version: UEVersion): void
}>()

// Slots
defineSlots<{
  default?: () => unknown
}>()

// Refs
const videoContainer = ref<HTMLElement | null>(null)
const service = ref<PixelStreamingService | null>(null)

// 状态
const isConnecting = ref(false)
const isConnected = ref(false)
const isSSEConnected = ref(false)
const isVideoReady = ref(false)
const errorMessage = ref('')
const detectedVersion = ref<UEVersion | null>(null)

// 统一日志条目（命令 + 对应响应）
interface LogEntry {
  time: string
  command: MCPCommand
  response?: MCPResponse
  responseTime?: string
}
const logEntries = ref<LogEntry[]>([])

// UI 状态
const showStatusBar = ref(false)        // 是否显示状态栏
const isStatusBarPinned = ref(false)    // 状态栏是否固定显示
const showDebugPanelState = ref(false)  // 调试面板显示状态

// 计算属性：是否显示调试面板（需要 debug=true）
const shouldShowDebugPanel = computed(() => props.debug && showDebugPanelState.value)

// 计算属性：是否有任何连接问题
const hasConnectionIssue = computed(() =>
  !isConnected.value || !isVideoReady.value || !!errorMessage.value
)

// 计算属性：状态栏是否应该显示
const shouldShowStatusBar = computed(() => {
  // 调试模式下常显
  if (props.debug) return true
  // 否则按原有逻辑
  return showStatusBar.value
})

// 时间格式化
const formatTime = () => {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

// 添加命令日志
const addCommandLog = (command: MCPCommand) => {
  const entry: LogEntry = { time: formatTime(), command }
  logEntries.value.unshift(entry)
  if (logEntries.value.length > 50) {
    logEntries.value.pop()
  }
  // 超时检查由 PixelStreamingService 处理，通过 onResponseSent 回调通知
}

// 添加响应日志（根据 commandId 匹配，或时间顺序匹配）
const addResponseLog = (response: MCPResponse) => {
  let entry: LogEntry | undefined

  // 1. 优先通过 commandId 匹配
  if (response.commandId) {
    entry = logEntries.value.find(e => e.command.commandId === response.commandId && !e.response)
  }

  // 2. 如果 commandId 匹配不到，找最近的等待响应的命令（老版本兼容）
  if (!entry) {
    // 从后往前找（最新的在前），找第一个没有响应的条目
    for (let i = logEntries.value.length - 1; i >= 0; i--) {
      if (!logEntries.value[i].response) {
        entry = logEntries.value[i]
        break
      }
    }
  }

  if (entry) {
    entry.response = response
    entry.responseTime = formatTime()
  } else {
    // 3. 没找到任何等待的命令，创建一个占位条目
    logEntries.value.unshift({
      time: formatTime(),
      command: { commandId: response.commandId || 'unknown', category: 'unknown', action_name: 'unknown', action_data: {} },
      response,
      responseTime: formatTime()
    })
  }

  if (logEntries.value.length > 50) {
    logEntries.value.pop()
  }
}

// 清空日志
const clearLogs = () => {
  logEntries.value = []
}

// 隐藏状态栏（仅非固定状态）
const hideStatusBar = () => {
  if (!isStatusBarPinned.value) {
    showStatusBar.value = false
  }
}

// 切换状态栏固定状态
const toggleStatusBarPin = () => {
  isStatusBarPinned.value = !isStatusBarPinned.value
  if (isStatusBarPinned.value) {
    showStatusBar.value = true
  }
}

// 切换调试面板
const toggleDebugPanel = () => {
  showDebugPanelState.value = !showDebugPanelState.value
}

// 鼠标进入视频区域
const handleMouseEnter = () => {
  // 仅在有连接问题时显示状态栏
  if (hasConnectionIssue.value || isStatusBarPinned.value) {
    showStatusBar.value = true
  }
}

// 鼠标离开视频区域
const handleMouseLeave = () => {
  hideStatusBar()
}

// 连接
const connect = async () => {
  if (!videoContainer.value) {
    errorMessage.value = '视频容器未就绪'
    return
  }

  // 先清理旧连接（如果存在）
  // 这确保旧 adapter 的重连定时器和事件监听器被正确清理
  if (service.value) {
    service.value.stop()
    service.value = null
  }

  errorMessage.value = ''
  isConnecting.value = true
  showStatusBar.value = true  // 连接时显示状态栏

  try {
    service.value = new PixelStreamingService(
      {
        signallingUrl: props.signallingUrl || DEFAULT_URLS.SIGNALLING,
        mcpBridgeUrl: props.mcpBridgeUrl || DEFAULT_URLS.MCP_BRIDGE,
        videoContainer: videoContainer.value,
        ueVersion: props.ueVersion,
        debugMode: props.debug || false,
        simulateMode: props.simulateMode || false,
        // 初始设置
        ...(props.initialSettings && { initialSettings: props.initialSettings }),
        // 鼠标交互配置
        ...(props.mouseInteraction && { mouseInteraction: props.mouseInteraction }),
      },
      {
        onConnected: () => {
          isConnecting.value = false
          isConnected.value = true
          emit('connected')
          connectedCallbacks.forEach(cb => cb())
          // 连接成功后延迟隐藏状态栏
          setTimeout(() => hideStatusBar(), TIMEOUTS.STATUS_BAR_HIDE_DELAY)
        },
        onDisconnected: () => {
          isConnecting.value = false
          isConnected.value = false
          isVideoReady.value = false
          showStatusBar.value = true  // 断开时显示状态栏
          emit('disconnected')
          disconnectedCallbacks.forEach(cb => cb())
        },
        onVideoReady: () => {
          isVideoReady.value = true
          // 视频就绪后延迟隐藏状态栏
          setTimeout(() => hideStatusBar(), TIMEOUTS.VIDEO_READY_HIDE_DELAY)
        },
        onError: (error) => {
          isConnecting.value = false
          // 支持 PixelStreamingError 和 string 两种类型
          errorMessage.value = typeof error === 'string' ? error : error.message
          showStatusBar.value = true  // 错误时显示状态栏
          emit('error', errorMessage.value)
          errorCallbacks.forEach(cb => cb(errorMessage.value))
        },
        onCommandReceived: (command) => {
          addCommandLog(command)
          emit('command', command)
          commandCallbacks.forEach(cb => cb(command))
        },
        onResponseSent: (response) => {
          addResponseLog(response)
          emit('response', response)
          responseCallbacks.forEach(cb => cb(response))
        },
        onVersionDetected: (version) => {
          detectedVersion.value = version
          emit('versionDetected', version)
        },
        onSSEStatusChange: (connected) => {
          isSSEConnected.value = connected
        },
        onPixelStreamingStatusChange: (connected) => {
          isConnected.value = connected
          if (!connected) {
            isVideoReady.value = false
            showStatusBar.value = true  // 像素流断开时显示状态栏
          }
        },
      }
    )

    await service.value.start()

    // 更新 SSE 状态
    const status = service.value.getConnectionStatus()
    isSSEConnected.value = status.sse

  } catch (err) {
    isConnecting.value = false
    errorMessage.value = err instanceof Error ? err.message : String(err)
    showStatusBar.value = true  // 错误时显示状态栏
    emit('error', errorMessage.value)
  }
}

// 断开
const disconnect = () => {
  if (service.value) {
    service.value.stop()
    service.value = null
  }
  isConnecting.value = false
  isConnected.value = false
  isSSEConnected.value = false
  isVideoReady.value = false
}

// 重连
const reconnect = async () => {
  showStatusBar.value = true  // 重连时显示状态栏
  disconnect()
  setTimeout(() => connect(), TIMEOUTS.RECONNECT_DELAY)
}

// 发送命令（前端直接调用）
const sendCommand = (command: MCPCommand): boolean => {
  if (!service.value) {
    return false
  }
  // 前端直接调用时也添加命令日志
  addCommandLog(command)
  // 使用 sendCommandFromFrontend，响应不会发送到 MCP Bridge
  return service.value.sendCommandFromFrontend(command)
}

// ===== 事件回调管理（用于 provide/inject） =====
type CommandCallback = (command: MCPCommand) => void
type ResponseCallback = (response: MCPResponse) => void
type VoidCallback = () => void
type ErrorCallback = (error: string) => void

const commandCallbacks = new Set<CommandCallback>()
const responseCallbacks = new Set<ResponseCallback>()
const connectedCallbacks = new Set<VoidCallback>()
const disconnectedCallbacks = new Set<VoidCallback>()
const errorCallbacks = new Set<ErrorCallback>()

// 注册回调函数，返回取消注册函数
const onCommand = (callback: CommandCallback) => {
  commandCallbacks.add(callback)
  return () => commandCallbacks.delete(callback)
}

const onResponse = (callback: ResponseCallback) => {
  responseCallbacks.add(callback)
  return () => responseCallbacks.delete(callback)
}

const onConnected = (callback: VoidCallback) => {
  connectedCallbacks.add(callback)
  return () => connectedCallbacks.delete(callback)
}

const onDisconnected = (callback: VoidCallback) => {
  disconnectedCallbacks.add(callback)
  return () => disconnectedCallbacks.delete(callback)
}

const onError = (callback: ErrorCallback) => {
  errorCallbacks.add(callback)
  return () => errorCallbacks.delete(callback)
}

// 提供 context 给后代组件
provide(PixelStreamingKey, {
  // 状态
  isConnected,
  isVideoReady,
  isSSEConnected,
  detectedVersion,
  errorMessage,
  // 方法
  connect,
  disconnect,
  reconnect,
  sendCommand,
  // 事件回调
  onCommand,
  onResponse,
  onConnected,
  onDisconnected,
  onError,
} as PixelStreamingContext)

// 生命周期
onMounted(() => {
  // 初始化调试面板状态
  if (props.debug && props.showDebugPanel) {
    showDebugPanelState.value = true
  }

  if (props.autoConnect !== false) {
    // 延迟连接，确保 DOM 已渲染
    setTimeout(() => connect(), TIMEOUTS.MOUNT_CONNECT_DELAY)
  }
})

onUnmounted(() => {
  disconnect()
})

// 监听调试模式变化
watch(() => props.debug, () => {
  // 调试模式变化时的处理
})

// 暴露方法
defineExpose({
  connect,
  disconnect,
  reconnect,
  clearLogs,
  sendCommand,
  // 状态
  isConnected,
  isSSEConnected,
  isVideoReady,
  detectedVersion,
  // UI 控制
  showStatusBar,
  isStatusBarPinned,
  toggleStatusBarPin,
  toggleDebugPanel,
  showDebugPanelState,
})
</script>

<template>
  <div
    class="pixel-streaming-container"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- 视频容器（底层） -->
    <div ref="videoContainer" class="video-container"></div>

    <!-- 状态栏（悬浮） - 仅在需要时显示 -->
    <Transition name="slide-fade">
      <div v-if="shouldShowStatusBar" class="status-bar">
        <div class="status-indicators">
          <div class="indicator" :class="{ active: isConnected }" title="像素流连接状态">
            <span class="dot"></span>
            <span>像素流</span>
          </div>
          <div class="indicator" :class="{ active: isSSEConnected }" title="MCP Bridge 连接状态">
            <span class="dot"></span>
            <span>MCP</span>
          </div>
          <div class="indicator" :class="{ active: isVideoReady }" title="视频就绪状态">
            <span class="dot"></span>
            <span>视频</span>
          </div>
          <div v-if="detectedVersion" class="version-badge">
            UE {{ detectedVersion }}+
          </div>
          <div v-if="isConnecting" class="connecting-indicator">
            <span class="spinner"></span>
            <span>连接中...</span>
          </div>
        </div>
        <div class="actions">
          <!-- 固定按钮 -->
          <button
            @click="toggleStatusBarPin"
            class="btn btn-icon"
            :class="{ active: isStatusBarPinned }"
            :title="isStatusBarPinned ? '取消固定' : '固定状态栏'"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path v-if="isStatusBarPinned" d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
              <path v-else d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" opacity="0.5"/>
            </svg>
          </button>
          <!-- 调试面板切换 -->
          <button
            v-if="props.debug"
            @click="toggleDebugPanel"
            class="btn btn-icon"
            :class="{ active: shouldShowDebugPanel }"
            title="切换调试面板"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5s-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z"/>
            </svg>
          </button>
          <!-- 连接/重连/断开按钮 -->
          <button v-if="!isConnected && !isConnecting" @click="connect" class="btn btn-connect">
            连接
          </button>
          <button v-else-if="isConnecting" @click="disconnect" class="btn btn-disconnect">
            断开
          </button>
          <template v-else>
            <button @click="reconnect" class="btn btn-reconnect">
              重连
            </button>
            <button @click="disconnect" class="btn btn-disconnect">
              断开
            </button>
          </template>
        </div>
      </div>
    </Transition>

    <!-- 错误提示（悬浮） -->
    <Transition name="fade">
      <div v-if="errorMessage" class="error-message">
        ⚠️ {{ errorMessage }}
      </div>
    </Transition>

    <!-- 调试面板（悬浮） - 仅在调试模式下显示 -->
    <Transition name="slide-up">
      <div v-if="shouldShowDebugPanel" class="debug-panel">
        <div class="debug-section">
          <div class="debug-header">
            <span class="debug-title">📋 命令/响应日志</span>
            <button @click="clearLogs" class="btn-small">清空</button>
          </div>
          <div class="log-list">
            <div v-for="(entry, index) in logEntries" :key="'log-' + index" class="log-entry">
              <div class="log-row command-row">
                <span class="log-time">{{ entry.time }}</span>
                <span class="log-tag cmd">CMD</span>
                <span class="log-content">{{ entry.command.category }}.{{ entry.command.action_name }}</span>
              </div>
              <div v-if="entry.response" class="log-row response-row">
                <span class="log-time">{{ entry.responseTime }}</span>
                <span class="log-tag" :class="entry.response.error ? 'err' : 'ok'">
                  {{ entry.response.error ? 'ERR' : 'OK' }}
                </span>
                <span class="log-content" :class="{ error: entry.response.error }">
                  {{ entry.response.error || '成功' }}
                </span>
              </div>
              <div v-else class="log-row pending-row">
                <span class="log-time">--:--:--</span>
                <span class="log-tag pending">等待</span>
                <span class="log-content pending">等待响应...</span>
              </div>
            </div>
            <div v-if="logEntries.length === 0" class="empty">
              <span class="empty-icon">📭</span>
              <span>暂无日志</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 插槽：允许子组件访问像素流上下文 -->
    <slot></slot>
  </div>
</template>

<style scoped>
.pixel-streaming-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #000;
  overflow: hidden;
}

/* 视频容器 - 占满整个区域 */
.video-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.video-container :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 状态栏 - 悬浮在视频上方 */
.status-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0));
  backdrop-filter: blur(4px);
  z-index: 10;
}

.status-indicators {
  display: flex;
  align-items: center;
  gap: 16px;
}

.indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  transition: color 0.3s;
}

.indicator.active {
  color: #4ade80;
}

.indicator .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transition: all 0.3s;
}

.indicator.active .dot {
  background: #4ade80;
  box-shadow: 0 0 8px #4ade80;
}

.version-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(99, 102, 241, 0.3);
  border-radius: 4px;
  color: #a5b4fc;
}

.connecting-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #fbbf24;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fbbf24;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 4px 12px;
  border-radius: 4px;
  border: none;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon {
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.btn-icon.active {
  background: rgba(99, 102, 241, 0.3);
  color: #a5b4fc;
}

.btn-connect {
  background: #4ade80;
  color: #000;
}

.btn-connect:hover {
  background: #22c55e;
}

.btn-reconnect {
  background: #fbbf24;
  color: #000;
}

.btn-reconnect:hover {
  background: #f59e0b;
}

.btn-disconnect {
  background: #f87171;
  color: #fff;
}

.btn-disconnect:hover {
  background: #ef4444;
}

/* 错误提示 - 悬浮在视频上方 */
.error-message {
  position: absolute;
  top: 50px;
  left: 12px;
  right: 12px;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.9);
  backdrop-filter: blur(4px);
  border-radius: 4px;
  color: #fff;
  font-size: 13px;
  z-index: 20;
}

/* 调试面板 - 悬浮在底部 */
.debug-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(15, 15, 20, 0.95);
  backdrop-filter: blur(8px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  height: 200px;
  max-height: 50%;
  z-index: 10;
}

.debug-section {
  padding: 10px 12px;
  background: rgba(20, 20, 28, 0.8);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.debug-title {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  letter-spacing: 0.5px;
}

.btn-small {
  padding: 3px 8px;
  font-size: 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-small:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.2);
}

.log-list {
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  min-height: 0;
  padding-right: 4px;
}

.log-list::-webkit-scrollbar {
  width: 6px;
}

.log-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.log-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.log-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* 日志条目（包含命令和响应） */
.log-entry {
  margin-bottom: 6px;
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  border-left: 2px solid rgba(99, 102, 241, 0.5);
}

.log-entry:hover {
  background: rgba(255, 255, 255, 0.06);
}

.log-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  padding: 2px 0;
}

.command-row {
  color: rgba(255, 255, 255, 0.9);
}

.response-row {
  margin-left: 8px;
  opacity: 0.8;
}

.pending-row {
  margin-left: 8px;
  opacity: 0.5;
}

.log-time {
  color: rgba(255, 255, 255, 0.4);
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 10px;
  flex-shrink: 0;
  min-width: 70px;
}

.log-tag {
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 600;
  flex-shrink: 0;
}

.log-tag.cmd {
  background: rgba(99, 102, 241, 0.3);
  color: #a5b4fc;
}

.log-tag.ok {
  background: rgba(74, 222, 128, 0.2);
  color: #86efac;
}

.log-tag.err {
  background: rgba(248, 113, 113, 0.2);
  color: #fca5a5;
}

.log-tag.pending {
  background: rgba(251, 191, 36, 0.2);
  color: #fcd34d;
}

.log-content {
  color: rgba(255, 255, 255, 0.8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.log-content.error {
  color: #fca5a5;
}

.log-content.pending {
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px;
  color: rgba(255, 255, 255, 0.3);
  font-size: 11px;
}

.empty-icon {
  font-size: 20px;
  opacity: 0.5;
}

/* 过渡动画 */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
