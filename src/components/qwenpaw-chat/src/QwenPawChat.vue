<script setup lang="ts">
/**
 * QwenPaw Chat 主组件
 * 重构版本：使用 composables 和子组件
 */

import { useDrag } from './composables/useDrag'
import { useChat } from './composables/useChat'
import './styles/variables.css'
import ChatMessage from './components/ChatMessage.vue'
import ChatInput from './components/ChatInput.vue'
import { WINDOW_DEFAULTS, MESSAGE_CONFIG } from './chat-constants'
import { setDebugMode } from './api'
import type { LocalCommand } from './chat-types'
import 'katex/dist/katex.min.css'

defineOptions({ name: 'QwenPawChat' })

// Props 定义
const props = defineProps<{
  /** 标题 */
  title?: string
  /** 用户头像 URL */
  userAvatar?: string
  /** 智能体头像 URL */
  agentAvatar?: string
  /** 输入框占位符 */
  placeholder?: string
  /** 是否显示关闭按钮 */
  showClose?: boolean
  /** 宽度（px），默认 1024 */
  width?: number
  /** 最大高度（px），默认 640 */
  maxHeight?: number
  /** 是否可拖拽 */
  draggable?: boolean
  /** 是否显示复制按钮 */
  showCopy?: boolean
  /** 是否打印日志 */
  debug?: boolean
  /** 本地命令配置（拦截特定消息，前端直接执行操作） */
  localCommands?: LocalCommand[]
}>()

// Emits 定义
const emit = defineEmits<{
  close: []
  /** 本地命令执行事件 */
  'local-command': [command: LocalCommand, message: string]
}>()

// 默认值
const title = props.title || MESSAGE_CONFIG.TITLE
const userAvatar = props.userAvatar || ''
const agentAvatar = props.agentAvatar || ''
const placeholder = props.placeholder || MESSAGE_CONFIG.PLACEHOLDER
const width = props.width || WINDOW_DEFAULTS.WIDTH
const maxHeight = props.maxHeight || WINDOW_DEFAULTS.MAX_HEIGHT
const isDraggable = props.draggable !== false
const isShowCopy = props.showCopy !== false
const isDebug = props.debug === true

// 设置调试模式
setDebugMode(isDebug)

// 使用拖拽 composable
const { dragState, windowPosition, computedLeft, resetPosition, onDragStart } = useDrag({
  width,
  draggable: isDraggable,
  debug: isDebug
})

// 使用聊天 composable
const {
  list,
  sendFlag,
  text,
  message,
  isThinking: _isThinking,
  isToolCalling,
  toolCallName,
  errorMessage,
  showScrollToBottom,
  send,
  stop,
  scrollToBottom,
  checkScrollPosition,
  queryConversation,
  copyMessage,
  getMarkdown: _getMarkdown,
} = useChat({
  showCopy: isShowCopy,
  debug: isDebug,
  localCommands: props.localCommands,
  onLocalCommand: (command, message) => {
    emit('local-command', command, message)
  }
})

// 加载会话历史
queryConversation()

/**
 * 关闭窗口
 */
const close = () => {
  if (sendFlag.value) return  // 发送中不允许关闭
  resetPosition()
  emit('close')
}

/**
 * 复制消息处理
 */
const handleCopy = (content: string, index: number) => {
  copyMessage(content, index)
}
</script>

<template>
<div
  class="qwenpaw-chat"
  :class="{ dragging: dragState.isDragging }"
  :style="{
    width: width + 'px',
    left: computedLeft + 'px',
    bottom: windowPosition.bottom + 'px',
    transform: 'translateX(-50%)'
  }"
>
  <div class="dialog-header" @mousedown.stop.prevent="onDragStart">
    <div class="header-title">
      <div class="agent-avatar">
        <img v-if="agentAvatar" :src="agentAvatar" alt="AI" />
        <div v-else class="avatar-placeholder">AI</div>
      </div>
      <span class="title-text">{{ title }}</span>
    </div>
    <div v-if="showClose" class="close-btn" @click="close">
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </div>
  </div>

  <div class="chat-content" :style="{ maxHeight: maxHeight + 'px' }" @scroll="checkScrollPosition">
    <!-- 消息列表 -->
    <ChatMessage
      v-for="(item, index) in list"
      :key="index"
      :item="item"
      :index="index"
      :title="title"
      :user-avatar="userAvatar"
      :agent-avatar="agentAvatar"
      :show-copy="isShowCopy"
      @copy="handleCopy"
    />

    <!-- 等待回复 / 思考中 / 工具调用 -->
    <div v-if="sendFlag && !message" class="agent-message agent-message-assistant">
      <div class="message-avatar">
        <img v-if="agentAvatar" :src="agentAvatar" alt="AI" />
        <div v-else class="avatar-placeholder">AI</div>
      </div>
      <div class="message-wrapper">
        <div class="message-header">
          <span class="sender-name">{{ title }}</span>
        </div>
        <div class="message-bubble">
          <div v-if="isToolCalling" class="tool-call-indicator">
            <span class="tool-icon">🔧</span>
            <span class="tool-call-text">{{ toolCallName ? `正在调用 ${toolCallName}...` : '正在调用工具...' }}</span>
          </div>
          <div v-else class="thinking-indicator">
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 流式回复中 -->
    <div v-if="message" class="agent-message agent-message-assistant streaming">
      <div class="message-avatar">
        <img v-if="agentAvatar" :src="agentAvatar" alt="AI" />
        <div v-else class="avatar-placeholder">AI</div>
      </div>
      <div class="message-wrapper">
        <div class="message-header">
          <span class="sender-name">{{ title }}</span>
        </div>
        <div class="message-bubble">
          <div class="agent-markdown" v-html="message"></div>
        </div>
      </div>
    </div>

    <!-- 错误信息 -->
    <div v-if="errorMessage" class="agent-message agent-message-error">
      <div class="message-avatar">
        <div class="avatar-placeholder">AI</div>
      </div>
      <div class="message-wrapper">
        <div class="message-header">
          <span class="sender-name">{{ title }}</span>
          <span class="agent-error-badge">错误</span>
        </div>
        <div class="message-bubble">
          <div class="error-text">{{ errorMessage }}</div>
        </div>
      </div>
    </div>

    <!-- 回到底部按钮 -->
    <Transition name="scroll-btn">
      <div v-if="showScrollToBottom" class="scroll-to-bottom" @click="scrollToBottom">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
        </svg>
      </div>
    </Transition>
  </div>

  <!-- 输入区域 -->
  <ChatInput
    v-model="text"
    :placeholder="placeholder"
    :disabled="sendFlag"
    @send="send"
    @stop="stop"
  />
</div>
</template>

<style scoped>
/* 使用 CSS 变量，详见 src/styles/variables.css */
.qwenpaw-chat {
  position: fixed;
  background: linear-gradient(180deg, var(--chat-bg-start) 0%, var(--chat-bg-end) 100%);
  border-radius: var(--chat-border-radius);
  border: 1px solid var(--chat-border);
  box-shadow: var(--chat-shadow);
  z-index: 100;
  font-family: var(--chat-font-family);
}

.qwenpaw-chat.dragging {
  box-shadow: var(--chat-shadow-dragging);
  cursor: grabbing !important;
}

.qwenpaw-chat.dragging * {
  cursor: grabbing !important;
  user-select: none;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--chat-padding-xl);
  border-bottom: 1px solid var(--chat-border);
  cursor: grab;
}

.dialog-header:active {
  cursor: grabbing;
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--chat-gap);
}

.agent-avatar {
  width: var(--chat-avatar-sm);
  height: var(--chat-avatar-sm);
  border-radius: var(--chat-radius-full);
  overflow: hidden;
  background: var(--chat-brand-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
}

.agent-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: var(--chat-font-size-md);
  font-weight: var(--chat-font-weight-bold);
}

.title-text {
  font-size: var(--chat-font-size-xl);
  color: var(--chat-text-highlight);
  font-weight: var(--chat-font-weight-normal);
}

.close-btn {
  width: var(--chat-close-btn-size);
  height: var(--chat-close-btn-size);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--chat-text-secondary);
  border-radius: var(--chat-radius-full);
  transition: all var(--chat-transition-fast);
}

.close-btn:hover {
  color: var(--chat-text-highlight);
  background: var(--chat-border);
}

.chat-content {
  min-height: var(--chat-min-height);
  overflow-y: auto;
  padding: var(--chat-padding-xl);
}

.chat-content::-webkit-scrollbar {
  width: var(--chat-scrollbar-width);
}

.chat-content::-webkit-scrollbar-track {
  background: var(--chat-scrollbar-track);
  border-radius: var(--chat-radius-sm);
}

.chat-content::-webkit-scrollbar-thumb {
  background: var(--chat-scrollbar-thumb);
  border-radius: var(--chat-radius-sm);
}

.scroll-to-bottom {
  position: sticky;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: var(--chat-scroll-btn-size);
  height: var(--chat-scroll-btn-size);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.95);
  border-radius: var(--chat-radius-full);
  cursor: pointer;
  color: #333;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(0, 0, 0, 0.1);
  z-index: 10;
  margin: var(--chat-padding-sm) auto;
  transition: all 0.2s ease;
}

.scroll-to-bottom:hover {
  background: #fff;
  color: var(--chat-brand-start);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  border-color: var(--chat-brand-start);
  transform: translateX(-50%) scale(1.05);
}

.scroll-btn-enter-active,
.scroll-btn-leave-active {
  transition: all var(--chat-transition-normal) ease-out;
}

.scroll-btn-enter-from,
.scroll-btn-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(var(--chat-padding-xl));
}

/* 消息样式（用于思考/工具调用/流式回复/错误） */
.agent-message {
  display: flex;
  gap: var(--chat-gap);
  margin-bottom: var(--chat-message-gap);
}

.agent-message-assistant {
  flex-direction: row;
}

.agent-message-assistant .message-wrapper {
  align-items: flex-start;
}

.agent-message-assistant .message-bubble {
  background: var(--chat-bubble-assistant-bg);
  border: 1px solid var(--chat-bubble-assistant-border);
  border-radius: var(--chat-bubble-assistant-radius);
}

.agent-message-assistant .agent-markdown {
  color: var(--chat-text-primary);
}

.message-avatar {
  width: var(--chat-avatar-md);
  height: var(--chat-avatar-md);
  border-radius: var(--chat-radius-full);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--chat-border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.message-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
  max-width: 75%;
}

.message-header {
  display: flex;
  align-items: center;
  gap: var(--chat-padding-sm);
  margin-bottom: var(--chat-padding-xs);
}

.sender-name {
  font-size: var(--chat-font-size-sm);
  color: var(--chat-text-secondary);
  font-weight: var(--chat-font-weight-normal);
}

.message-bubble {
  padding: var(--chat-padding-md) var(--chat-padding-lg);
  max-width: fit-content;
  font-size: var(--chat-font-size-lg);
  line-height: 23px;
  word-break: break-word;
}

.streaming {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

.thinking-indicator {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: var(--chat-padding-xs) 0;
}

.thinking-dot {
  width: 10px;
  height: 10px;
  background: var(--chat-accent);
  border-radius: var(--chat-radius-full);
  animation: thinking-pulse 1.4s ease-in-out infinite;
}

.thinking-dot:nth-child(1) { animation-delay: 0s; }
.thinking-dot:nth-child(2) { animation-delay: 0.2s; }
.thinking-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes thinking-pulse {
  0%, 100% {
    opacity: 0.4;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

.tool-call-indicator {
  display: flex;
  gap: var(--chat-padding-sm);
  align-items: center;
  padding: var(--chat-padding-xs) 0;
}

.tool-icon {
  font-size: var(--chat-font-size-md);
  animation: wrench-shake 0.8s ease-in-out infinite;
}

@keyframes wrench-shake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-15deg); }
  75% { transform: rotate(15deg); }
}

.tool-call-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: var(--chat-font-size-md);
}

.agent-message-error .message-bubble {
  background: var(--chat-error-bg);
  border: 1px solid var(--chat-error-border);
}

.agent-error-badge {
  font-size: var(--chat-font-size-sm);
  color: var(--chat-text-error-badge);
  background: rgba(239, 68, 68, 0.15);
  padding: 3px var(--chat-padding-sm);
  border-radius: var(--chat-radius-md);
}

.error-text {
  color: #fca5a5;
  font-size: var(--chat-font-size-md);
  line-height: 20px;
}
</style>
