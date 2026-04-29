<script setup lang="ts">
/**
 * 聊天消息项组件
 * 从 QwenPawChat.vue 提取
 */

import type { MessageItem } from '../chat-types'

const props = defineProps<{
  /** 消息内容 */
  item: MessageItem
  /** 消息索引 */
  index: number
  /** 标题（用于显示发送者名称） */
  title: string
  /** 用户头像 URL */
  userAvatar?: string
  /** 智能体头像 URL */
  agentAvatar?: string
  /** 是否显示复制按钮 */
  showCopy?: boolean
}>()

const emit = defineEmits<{
  (e: 'copy', content: string, index: number): void
}>()

/**
 * 复制消息
 */
const handleCopy = () => {
  emit('copy', props.item.content, props.index)
}
</script>

<template>
<div :class="['agent-message', item.role === 'user' ? 'agent-message-user' : 'agent-message-assistant']">
  <div class="message-avatar">
    <img v-if="item.role === 'user' && userAvatar" :src="userAvatar" alt="用户" />
    <img v-else-if="item.role !== 'user' && agentAvatar" :src="agentAvatar" alt="AI" />
    <div v-else class="avatar-placeholder" :class="{ user: item.role === 'user' }">
      {{ item.role === 'user' ? '我' : 'AI' }}
    </div>
  </div>
  <div class="message-wrapper">
    <div class="message-header">
      <span class="sender-name">{{ item.role === 'user' ? '我' : title }}</span>
    </div>
    <div class="message-bubble">
      <div class="agent-markdown" v-html="item.content"></div>
    </div>
    <div v-if="item.role === 'assistant' && showCopy" class="message-actions">
      <button class="copy-btn" @click="handleCopy" :title="item.copied ? '已复制' : '复制'">
        <svg v-if="!item.copied" viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      </button>
    </div>
  </div>
</div>
</template>

<style scoped>
/* 使用 CSS 变量，详见 src/styles/variables.css */
.agent-message {
  display: flex;
  gap: var(--chat-gap);
  margin-bottom: var(--chat-message-gap);
}

.agent-message-user {
  flex-direction: row-reverse;
}

.agent-message-user .message-wrapper {
  align-items: flex-end;
}

.agent-message-user .message-bubble {
  background: var(--chat-bubble-user-bg);
  border-radius: var(--chat-bubble-user-radius);
}

.agent-message-user .agent-markdown {
  color: var(--chat-text-highlight);
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

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--chat-text-highlight);
  font-size: var(--chat-font-size-md);
  font-weight: var(--chat-font-weight-bold);
}

.message-avatar .avatar-placeholder.user {
  background: var(--chat-brand-gradient);
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

.message-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--chat-padding-xs);
}

.copy-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--chat-text-tertiary);
  padding: 4px;
  border-radius: var(--chat-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--chat-transition-fast);
}

.copy-btn:hover {
  color: var(--chat-text-secondary);
  background: var(--chat-border);
}

.message-bubble {
  padding: var(--chat-padding-md) var(--chat-padding-lg);
  max-width: fit-content;
  font-size: var(--chat-font-size-lg);
  line-height: 23px;
  word-break: break-word;
}

/* Markdown 样式使用共享的 markdown.css */
.agent-markdown :deep(h1) { font-size: 22px; margin: 8px 0 3px; }
.agent-markdown :deep(h2) { font-size: 20px; margin: 8px 0 3px; }
.agent-markdown :deep(h3) { font-size: 18px; margin: 8px 0 3px; }
.agent-markdown :deep(h4) { font-size: 17px; margin: 8px 0 3px; }
.agent-markdown :deep(h5) { font-size: 17px; margin: 8px 0 3px; color: var(--chat-text-secondary); }
.agent-markdown :deep(h6) { font-size: 16px; margin: 8px 0 3px; color: var(--chat-text-tertiary); }

.agent-markdown :deep(p) {
  margin: 5px 0;
  line-height: 1.5;
}

.agent-markdown :deep(p:first-child) { margin-top: 0; }
.agent-markdown :deep(p:last-child) { margin-bottom: 0; }

.agent-markdown :deep(ul),
.agent-markdown :deep(ol) {
  margin: 5px 0;
  padding-left: var(--chat-padding-xl);
}

.agent-markdown :deep(li) {
  margin: 3px 0;
  line-height: 1.4;
}

.agent-markdown :deep(blockquote) {
  margin: 5px 0;
  padding: var(--chat-padding-xs) var(--chat-padding-md);
  border-left: 4px solid var(--chat-accent);
  background: rgba(240, 126, 38, 0.08);
  color: var(--chat-text-primary);
  border-radius: 0 var(--chat-radius-md) var(--chat-radius-md) 0;
}

.agent-markdown :deep(code) {
  background: rgba(240, 126, 38, 0.15);
  padding: 0 var(--chat-padding-xs);
  border-radius: var(--chat-radius-sm);
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  font-size: var(--chat-font-size-md);
  color: var(--chat-accent);
}

.agent-markdown :deep(pre) {
  background: var(--chat-input-bg);
  padding: var(--chat-padding-sm) var(--chat-padding-md);
  border-radius: var(--chat-radius-lg);
  overflow-x: auto;
  margin: 5px 0;
  border: 1px solid var(--chat-border);
}

.agent-markdown :deep(pre code) {
  background: none;
  padding: 0;
  font-size: var(--chat-font-size-sm);
  line-height: 1.5;
  color: #f8f8f2;
}

.agent-markdown :deep(a) {
  color: var(--chat-accent);
  text-decoration: none;
  transition: color var(--chat-transition-fast);
}

.agent-markdown :deep(a:hover) {
  color: var(--chat-accent-hover);
  text-decoration: underline;
}

.agent-markdown :deep(strong),
.agent-markdown :deep(b) {
  font-weight: var(--chat-font-weight-bold);
  color: rgba(255, 255, 255, 0.95);
}

.agent-markdown :deep(em),
.agent-markdown :deep(i) {
  font-style: italic;
  color: rgba(255, 255, 255, 0.9);
}

.agent-markdown :deep(table) {
  border-collapse: collapse;
  margin: 5px 0;
  width: 100%;
  border-radius: var(--chat-radius-md);
  overflow: hidden;
}

.agent-markdown :deep(th),
.agent-markdown :deep(td) {
  border: 1px solid var(--chat-table-border);
  padding: var(--chat-padding-xs) var(--chat-padding-sm);
  text-align: left;
}

.agent-markdown :deep(th) {
  background: var(--chat-table-header-bg);
  font-weight: var(--chat-font-weight-bold);
  color: rgba(255, 255, 255, 0.95);
}

.agent-markdown :deep(td) {
  color: var(--chat-text-primary);
}

.agent-markdown :deep(tr:nth-child(even)) {
  background: var(--chat-table-stripe-bg);
}

.agent-markdown :deep(hr) {
  border: none;
  border-top: 1px solid var(--chat-hr-border);
  margin: var(--chat-padding-sm) 0;
}

.agent-markdown :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--chat-radius-lg);
}
</style>
