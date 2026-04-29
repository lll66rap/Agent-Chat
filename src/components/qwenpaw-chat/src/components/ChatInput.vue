<script setup lang="ts">
/**
 * 聊天输入区域组件
 * 从 QwenPawChat.vue 提取
 *
 * 功能：
 * - 发送消息（发送按钮）
 * - 停止会话（发送中显示停止按钮）
 */

const props = defineProps<{
  /** 输入内容 */
  modelValue: string
  /** 占位符 */
  placeholder?: string
  /** 是否正在发送（发送中显示停止按钮） */
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'send', value: string): void
  (e: 'stop'): void
}>()

/**
 * 发送消息
 */
const handleSend = () => {
  if (!props.modelValue.trim() || props.disabled) return
  emit('send', props.modelValue)
  emit('update:modelValue', '')
}

/**
 * 停止会话
 */
const handleStop = () => {
  emit('stop')
}

/**
 * 按 Enter 发送
 */
const handleKeyup = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    handleSend()
  }
}
</script>

<template>
<div class="input-area">
  <input
    class="chat-input"
    :value="modelValue"
    :placeholder="placeholder"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    @keyup="handleKeyup"
  />
  <!-- 停止按钮（发送中显示） -->
  <button
    v-if="disabled"
    class="send-btn stop-btn"
    type="button"
    @click="handleStop"
    title="停止生成"
  >
    <svg viewBox="0 0 24 24" width="18" height="18">
      <rect fill="currentColor" x="6" y="6" width="12" height="12" rx="2"/>
    </svg>
  </button>
  <!-- 发送按钮（正常状态） -->
  <button
    v-else
    class="send-btn"
    :class="{ disabled: !modelValue }"
    type="button"
    @click="handleSend"
    :disabled="!modelValue"
  >
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>
  </button>
</div>
</template>

<style scoped>
/* 使用 CSS 变量，详见 src/styles/variables.css */
.input-area {
  display: flex;
  gap: var(--chat-gap);
  padding: var(--chat-padding-xl);
  border-top: 1px solid var(--chat-border);
}

.chat-input {
  flex: 1;
  height: var(--chat-input-height);
  padding: 0 var(--chat-padding-lg);
  border: 1px solid var(--chat-input-border);
  border-radius: var(--chat-radius-xl);
  background: var(--chat-input-bg);
  color: var(--chat-text-highlight);
  font-size: var(--chat-font-size-lg);
  outline: none;
  transition: all var(--chat-transition-fast);
}

.chat-input::placeholder {
  color: var(--chat-text-tertiary);
}

.chat-input:focus {
  border-color: var(--chat-input-border-focus);
  background: var(--chat-input-bg-focus);
}

.chat-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.send-btn {
  width: var(--chat-input-height);
  height: var(--chat-input-height);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--chat-brand-gradient);
  border: none;
  border-radius: var(--chat-radius-xl);
  cursor: pointer;
  color: var(--chat-text-highlight);
  transition: all var(--chat-transition-fast);
}

.send-btn:hover:not(.disabled) {
  transform: scale(1.05);
  box-shadow: var(--chat-shadow);
}

.send-btn.disabled {
  background: rgba(255, 255, 255, 0.2);
  cursor: not-allowed;
  color: var(--chat-text-tertiary);
}

.send-btn.stop-btn {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.send-btn.stop-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}
</style>
