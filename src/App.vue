<script setup lang="ts">
import QwenPawChat, { PixelStreaming, type LocalCommand } from '@/components/qwenpaw-chat'
import type { UEVersion } from '@/components/qwenpaw-chat/src/pixelstreaming/types'
import PixelStreamingDemo from '@/components/PixelStreamingDemo.vue'
import { ref } from 'vue'

const showChat = ref(true)
const showPixelStreaming = ref(true)
const debugMode = ref(true)
const showDemoPanel = ref(true)  // 控制演示面板显示

// 像素流配置（从环境变量读取）
const signallingUrl = import.meta.env.VITE_PIXEL_STREAMING_SIGNALLING_URL || 'ws://localhost:8888'
const mcpBridgeUrl = import.meta.env.VITE_PIXEL_STREAMING_MCP_BRIDGE_URL || 'http://localhost:8080'
const ueVersion = ref<UEVersion | undefined>(undefined)  // 手动指定 UE 版本，undefined 表示自动检测

// 本地命令配置示例
const localCommands: LocalCommand[] = [
  {
    pattern: '道路总览',
    description: '跳转到道路总览页面',
    reply: '已为您跳转到 **道路总览** 页面',
    action: () => {
      console.log('执行：跳转到道路总览')
      // 实际使用时：router.push('/road-overview')
    }
  },
  {
    pattern: '地图视图',
    description: '切换到地图视图',
    reply: '正在切换到 **地图视图**...',
    action: () => {
      console.log('执行：切换地图视图')
    }
  },
  {
    pattern: '帮助',
    description: '显示帮助信息',
    reply: `**可用命令列表**

| 命令 | 说明 |
|------|------|
| 道路总览 | 查看道路总览页面 |
| 地图视图 | 切换到地图视图 |
| 帮助 | 显示此帮助信息 |
| 查看 <名称> | 查看指定内容 |

> 💡 提示：本地命令不会发送到后端`
  },
  {
    pattern: /^查看\s*(.+)$/,
    description: '查看指定内容（正则匹配）',
    reply: (msg) => `正在查看：**${msg.replace(/^查看\s*/, '')}**`,
    action: (msg) => {
      console.log('查看内容:', msg.replace(/^查看\s*/, ''))
    }
  }
]

const handleClose = () => {
  showChat.value = false
  // 3秒后重新显示（演示用）
  setTimeout(() => {
    showChat.value = true
  }, 3000)
}

const handleLocalCommand = (command: LocalCommand, message: string) => {
  console.log('📍 本地命令执行:', {
    pattern: command.pattern,
    description: command.description,
    message
  })
}

const handlePixelStreamingCommand = (command: unknown) => {
  console.log('Pixel Streaming command:', command)
}

const handlePixelStreamingResponse = (response: unknown) => {
  console.log('Pixel Streaming response:', response)
}
</script>

<template>
  <div class="app">
    <div class="demo-header">
      <h1>QwenPaw Chat + 像素流</h1>
      <p>智能体聊天 + UE5 像素流控制演示</p>
    </div>

    <div class="main-content">
      <!-- 像素流面板 -->
      <div class="pixel-streaming-panel">
        <div class="panel-header">
          <h2>UE5 像素流</h2>
          <div class="panel-controls">
            <label class="version-select">
              <span>UE版本:</span>
              <select v-model="ueVersion">
                <option :value="undefined">自动检测</option>
                <option value="5.5">UE 5.5+</option>
                <option value="5.0">UE 5.0+</option>
                <option value="4.26">UE 4.26+</option>
              </select>
            </label>
            <label class="debug-toggle">
              <input type="checkbox" v-model="debugMode" />
              调试模式
            </label>
            <label class="debug-toggle">
              <input type="checkbox" v-model="showDemoPanel" />
              演示面板
            </label>
          </div>
        </div>
        <PixelStreaming
          v-if="showPixelStreaming"
          :signalling-url="signallingUrl"
          :mcp-bridge-url="mcpBridgeUrl"
          :ue-version="ueVersion"
          :debug="debugMode"
          :auto-connect="true"
          @command="handlePixelStreamingCommand"
          @response="handlePixelStreamingResponse"
          style="height: 70vh; min-height: 500px;"
          :mouse-interaction="{ HoveringMouse: true }"
        >
          <!-- 使用示例面板（演示 usePixelStreaming） -->
          <PixelStreamingDemo v-if="showDemoPanel" />
        </PixelStreaming>
      </div>
    </div>

    <!-- QwenPawChat 作为浮动窗口 -->
    <QwenPawChat
      v-if="showChat"
      title="智能助手"
      :show-close="true"
      placeholder="请输入问题 (/clear 清空历史)"
      @close="handleClose"
      :draggable="true"
      :show-copy="true"
      :local-commands="localCommands"
      @local-command="handleLocalCommand"
    />

    <div class="demo-info">
      <h2>架构说明</h2>
      <div class="architecture">
        <pre>
┌─────────────┐    MCP     ┌─────────────┐    SSE     ┌─────────────┐
│   QwenPaw   │ ─────────▶ │ MCP Bridge  │ ◀────────▶ │  像素流网页  │
│   Chat      │            │  :8080      │            │             │
└─────────────┘            └─────────────┘            └──────┬──────┘
                                                           │ WebRTC
                                                           ▼
                                                      ┌─────────────┐
                                                      │     UE5     │
                                                      └─────────────┘
        </pre>
      </div>
      <div class="features">
        <h3>功能特性</h3>
        <ul>
          <li>✅ SSE 流式响应</li>
          <li>✅ 像素流实时视频</li>
          <li>✅ MCP 工具控制 UE5</li>
          <li>✅ 命令ID匹配响应</li>
          <li>✅ 调试面板</li>
          <li>✅ usePixelStreaming composable</li>
          <li>✅ 本地命令拦截（前端直接执行）</li>
        </ul>
      </div>
    </div>

    <div v-if="!showChat" class="chat-closed">
      <p>聊天窗口已关闭，3秒后重新显示...</p>
    </div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* 设置 rem 基准值：1rem = 256px */
html {
  font-size: 100px;
}

html, body, #app {
  width: 100%;
  height: 100%;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
  min-height: 100vh;
  /* 恢复 body 的字体大小为正常值 */
  font-size: 14px;
}

.app {
  width: 100%;
  min-height: 100vh;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.demo-header {
  text-align: center;
  margin-bottom: 20px;
  padding-top: 10px;
}

.demo-header h1 {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
}

.demo-header p {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.main-content {
  display: flex;
  gap: 20px;
  width: 100%;
  max-width: 1600px;
  margin-bottom: 20px;
}

.pixel-streaming-panel {
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  min-height: 600px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-header h2 {
  font-size: 14px;
  font-weight: 600;
}

.panel-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.version-select {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.version-select select {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 4px 8px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.version-select select:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.4);
}

.debug-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.chat-panel {
  width: 420px;
  flex-shrink: 0;
}

.demo-info {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px 30px;
  width: 100%;
  max-width: 1400px;
}

.demo-info h2 {
  font-size: 16px;
  margin-bottom: 12px;
  color: #f07e26;
}

.demo-info h3 {
  font-size: 14px;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.8);
}

.architecture {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  overflow-x: auto;
}

.architecture pre {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
  white-space: pre;
}

.features ul {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
}

.features li {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.chat-closed {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.1);
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

@media (max-width: 1000px) {
  .main-content {
    flex-direction: column;
  }

  .chat-panel {
    width: 100%;
  }
}
</style>
