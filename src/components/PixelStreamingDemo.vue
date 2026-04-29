/**
 * Pixel Streaming 使用示例组件
 * 演示如何在任意组件中使用 usePixelStreaming
 */

<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import { usePixelStreaming, type MCPCommand, type MCPResponse } from '@/components/qwenpaw-chat'

// 获取像素流上下文
const ps = usePixelStreaming()

// 本地状态
const commandHistory = ref<Array<{ cmd: MCPCommand; response?: MCPResponse }>>([])
const pendingCommands = ref(new Set<string>())

// 自定义命令输入
const customCategory = ref('')
const customAction = ref('')
const customData = ref('')

// 连接状态文本
const connectionStatus = computed(() => {
  if (!ps.isConnected.value) return '未连接'
  if (!ps.isVideoReady.value) return '视频加载中...'
  return '已连接'
})

// 发送命令
const sendCommand = (category: string, action: string, data: Record<string, unknown>) => {
  const commandId = `cmd-${Date.now()}`
  const command: MCPCommand = {
    commandId,
    category,
    action_name: action,
    action_data: data
  }

  // 记录命令
  commandHistory.value.unshift({ cmd: command })
  pendingCommands.value.add(commandId)

  // 发送
  const success = ps.sendCommand(command)
  if (!success) {
    console.warn('发送失败：像素流未连接')
  }

  // 限制历史记录
  if (commandHistory.value.length > 20) {
    commandHistory.value.pop()
  }
}

// 预设命令
const presetCommands = [
  { label: '📷 相机 - 首页', category: 'project', action: 'playerPoint', data: {point_name: 'overview'} },
  { label: '📷 相机 - 旋转', category: 'camera', action: 'rotateCamera', data: { position: [-8187.53, -1750.88, 0.00], distance: 5157.86, pitch: -64.32, yaw: -165.61, time : 10 } },
  { label: '📍 兴趣点 - 基站', category: 'poi', action: 'changeTypesPoisVisible', data: { categories: ['PP'] } },
  { label: '📍 兴趣点 - 监控', category: 'poi', action: 'changeTypesPoisVisible', data: { categories: ['cam'] } },
  { label: '🏢 建筑 - 一层', category: 'project', action: 'selectFloor', data: { floor_id: 0 } },
  { label: '🏢 建筑 - 二层', category: 'project', action: 'selectFloor', data: { floor_id: 1 } },
]

// 监听响应
const unsubResponse = ps.onResponse((response: MCPResponse) => {
  // 1. 优先通过 commandId 匹配
  console.log('收到响应demo:', response)
  let entry = commandHistory.value.find(e => e.cmd.commandId === response.commandId && !e.response)

  // 2. 如果 commandId 匹配不到，找最近的等待响应的命令（老版本兼容）
  if (!entry) {
    for (let i = commandHistory.value.length - 1; i >= 0; i--) {
      if (!commandHistory.value[i].response) {
        entry = commandHistory.value[i]
        break
      }
    }
  }

  if (entry) {
    entry.response = response
    pendingCommands.value.delete(entry.cmd.commandId)
  }
})

// 监听连接状态
const unsubConnected = ps.onConnected(() => {
  console.log('✅ 像素流已连接')
})

const unsubDisconnected = ps.onDisconnected(() => {
  console.log('❌ 像素流已断开')
  pendingCommands.value.clear()
})

// 清理
onUnmounted(() => {
  unsubResponse()
  unsubConnected()
  unsubDisconnected()
})

// 连接控制
const handleConnect = () => ps.connect()
const handleDisconnect = () => ps.disconnect()
const handleReconnect = () => ps.reconnect()

// 清空历史
const clearHistory = () => {
  commandHistory.value = []
}

// 发送自定义命令
const sendCustomCommand = () => {
  if (customCategory.value && customAction.value) {
    let data = {}
    try {
      data = JSON.parse(customData.value)
    } catch {
      // 解析失败，使用空对象
    }
    sendCommand(customCategory.value, customAction.value, data)
    // 清空输入
    customCategory.value = ''
    customAction.value = ''
    customData.value = ''
  }
}
</script>

<template>
  <div class="ps-demo">
    <!-- 状态栏 -->
    <div class="status-bar" :class="{ connected: ps.isConnected.value }">
      <div class="status-item">
        <span class="status-label">连接状态:</span>
        <span class="status-value">{{ connectionStatus }}</span>
      </div>
      <div class="status-item">
        <span class="status-label">SSE:</span>
        <span class="status-dot" :class="{ active: ps.isSSEConnected.value }"></span>
      </div>
      <div class="status-item">
        <span class="status-label">视频:</span>
        <span class="status-dot" :class="{ active: ps.isVideoReady.value }"></span>
      </div>
      <div class="status-item" v-if="ps.detectedVersion.value">
        <span class="status-label">UE版本:</span>
        <span class="status-value">{{ ps.detectedVersion.value }}</span>
      </div>
    </div>

    <!-- 连接控制 -->
    <div class="control-bar">
      <button @click="handleConnect" :disabled="ps.isConnected.value" class="btn btn-primary">
        连接
      </button>
      <button @click="handleDisconnect" :disabled="!ps.isConnected.value" class="btn btn-danger">
        断开
      </button>
      <button @click="handleReconnect" class="btn btn-secondary">
        重连
      </button>
    </div>

    <!-- 预设命令 -->
    <div class="command-section">
      <h3>快捷命令</h3>
      <div class="command-grid">
        <button
          v-for="cmd in presetCommands"
          :key="cmd.label"
          @click="sendCommand(cmd.category, cmd.action, cmd.data)"
          :disabled="!ps.isConnected.value"
          class="cmd-btn"
        >
          {{ cmd.label }}
        </button>
      </div>
    </div>

    <!-- 自定义命令 -->
    <div class="command-section">
      <h3>自定义命令</h3>
      <div class="custom-command">
        <input
          v-model="customCategory"
          type="text"
          placeholder="分类 (如: camera)"
          class="input"
        />
        <input
          v-model="customAction"
          type="text"
          placeholder="动作 (如: setPosition)"
          class="input"
        />
        <input
          v-model="customData"
          type="text"
          placeholder='数据 JSON (如: {"x": 100})'
          class="input input-wide"
        />
        <button
          @click="sendCustomCommand"
          :disabled="!ps.isConnected.value || !customCategory || !customAction"
          class="btn btn-primary"
        >
          发送
        </button>
      </div>
    </div>

    <!-- 命令历史 -->
    <div class="history-section">
      <div class="history-header">
        <h3>命令历史</h3>
        <button @click="clearHistory" class="btn btn-small">清空</button>
      </div>
      <div class="history-list">
        <div
          v-for="(entry, index) in commandHistory"
          :key="index"
          class="history-item"
          :class="{ pending: pendingCommands.has(entry.cmd.commandId) }"
        >
          <div class="history-cmd">
            <span class="cmd-time">{{ entry.cmd.commandId.split('-')[1] }}</span>
            <span class="cmd-category">{{ entry.cmd.category }}</span>
            <span class="cmd-action">{{ entry.cmd.action_name }}</span>
          </div>
          <div class="history-response" v-if="entry.response">
            <span :class="entry.response.error ? 'response-error' : 'response-ok'">
              {{ entry.response.error || '✓ 成功' }}
            </span>
          </div>
          <div class="history-pending" v-else-if="pendingCommands.has(entry.cmd.commandId)">
            <span class="pending-text">⏳ 等待响应...</span>
          </div>
        </div>
        <div v-if="commandHistory.length === 0" class="history-empty">
          暂无命令记录
        </div>
      </div>
    </div>

    <!-- 错误信息 -->
    <div v-if="ps.errorMessage.value" class="error-banner">
      ⚠️ {{ ps.errorMessage.value }}
    </div>
  </div>
</template>

<style scoped>
.ps-demo {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 320px;
  max-height: calc(100vh - 40px);
  background: rgba(20, 20, 30, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 16px;
  overflow-y: auto;
  z-index: 1000;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
}

/* 状态栏 */
.status-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  margin-bottom: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-label {
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
}

.status-value {
  font-weight: 600;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
}

.status-dot.active {
  background: #22c55e;
}

/* 控制栏 */
.control-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.btn-danger {
  background: #ef4444;
  color: #fff;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-small {
  padding: 4px 8px;
  font-size: 11px;
}

/* 命令区域 */
.command-section {
  margin-bottom: 16px;
}

.command-section h3 {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.command-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.cmd-btn {
  padding: 10px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.cmd-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.cmd-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 自定义命令 */
.custom-command {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.input {
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #fff;
  font-size: 11px;
  width: calc(50% - 3px);
}

.input-wide {
  width: 100%;
}

.input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

/* 历史记录 */
.history-section {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 12px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.history-header h3 {
  margin: 0;
}

.history-list {
  max-height: 200px;
  overflow-y: auto;
}

.history-item {
  padding: 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  margin-bottom: 4px;
  border-left: 2px solid rgba(102, 126, 234, 0.5);
}

.history-item.pending {
  border-left-color: #fbbf24;
}

.history-cmd {
  display: flex;
  gap: 8px;
  font-size: 11px;
}

.cmd-time {
  color: rgba(255, 255, 255, 0.3);
  font-family: monospace;
}

.cmd-category {
  color: #a5b4fc;
}

.cmd-action {
  color: rgba(255, 255, 255, 0.8);
}

.history-response {
  margin-top: 4px;
  font-size: 10px;
}

.response-ok {
  color: #86efac;
}

.response-error {
  color: #fca5a5;
}

.history-pending {
  margin-top: 4px;
}

.pending-text {
  color: #fcd34d;
  font-size: 10px;
}

.history-empty {
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
  padding: 20px;
  font-size: 11px;
}

/* 错误提示 */
.error-banner {
  margin-top: 12px;
  padding: 10px;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #fca5a5;
  font-size: 11px;
}

/* 滚动条 */
.history-list::-webkit-scrollbar {
  width: 4px;
}

.history-list::-webkit-scrollbar-track {
  background: transparent;
}

.history-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}
</style>
