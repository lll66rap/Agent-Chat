# QwenPaw Chat 组件

可复用的智能体聊天组件，基于 QwenPaw 设计系统，集成 Pixel Streaming 多版本适配器。支持完整的智能体交互和 UE 像素流控制。

## ✨ 特性

### 🤖 聊天功能
- **SSE 流式响应** - 实时消息流，支持思考阶段显示
- **Markdown 渲染** - 支持标题、列表、代码块、表格、LaTeX 数学公式
- **会话管理** - 自动保存历史到 localStorage，支持 `/clear` 命令
- **响应式设计** - 移动端友好，自适应布局
- **主题系统** - 亮色/暗色模式支持
- **可拖拽窗口** - 自由拖动聊天窗口位置
- **复制功能** - 一键复制消息内容

### 🎮 Pixel Streaming 集成
- **全版本支持** - UE 4.26+、UE 5.0-5.4、UE 5.5+ 完整兼容
- **智能版本检测** - 自动识别 UE 版本并选择适配器
- **MCP Bridge 集成** - 通过 SSE 接收命令，HTTP 发送响应
- **响应路由** - 前端命令响应不发送到 MCP Bridge，MCP 命令响应自动返回
- **命令超时** - 30 秒超时自动返回错误响应
- **自动重连** - 指数退避 + 抖动策略，防止惊群效应
- **生产级 UI** - 悬浮状态栏、调试面板、智能显示/隐藏
- **命令/响应对应** - 调试面板命令和响应一一对应显示
- **跨组件访问** - `usePixelStreaming` composable 支持在任意子组件中访问
- **完整类型支持** - 完整的 TypeScript 类型定义

---

## 快速开始

### 1. 安装依赖

```bash
npm install markdown-it @epicgames-ps/lib-pixelstreamingfrontend-ue5.7
```

### 2. 复制组件目录

将整个 `qwenpaw-chat` 目录复制到目标项目的 `src/components/` 下。

### 3. 配置环境变量（可选）

在 `.env` 文件中配置：

```env
# QwenPaw API 配置
VITE_QWENPAW_API_URL=/api/console/chat
VITE_QWENPAW_API_KEY=your-api-key
VITE_QWENPAW_AGENT_ID=default
VITE_QWENPAW_SESSION_ID=default
VITE_QWENPAW_TIMEOUT=60000
```

---

## UE 版本支持

| UE 版本 | 适配器 | 协议版本 | 检测方式 |
|---------|--------|----------|----------|
| **UE 5.5+** | Modern | 1.3.0 (三段式) | `protocolVersion` 三段式 |
| **UE 5.0-5.4** | Modern | 无/两段式 | 响应 `listStreamers` |
| **UE 4.26+** | Legacy | 1.0 | 拒绝 `listStreamers` (1008) |

### 版本检测流程

```
1. 连接 WebSocket → 发送 listStreamers 探测
2. 收到 protocolVersion 三段式 (如 "1.3.0") → UE 5.5+
3. 收到 streamerList 响应 → UE 5.0+
4. 连接关闭 1008 + "Unsupported" → UE 4.26
5. 超时 → 默认 UE 5.0+
```

---

## 组件 API

### PixelStreaming 组件

```vue
<template>
  <PixelStreaming
    signalling-url="ws://localhost:8888"
    mcp-bridge-url="http://localhost:8080"
    :debug="false"
    :auto-connect="true"
    @connected="onConnected"
    @disconnected="onDisconnected"
    @error="onError"
    @version-detected="onVersionDetected"
  />
</template>

<script setup lang="ts">
import PixelStreaming from '@/components/qwenpaw-chat/src/PixelStreaming.vue'
import type { UEVersion } from '@/components/qwenpaw-chat/src/pixelstreaming'

const onConnected = () => console.log('已连接')
const onDisconnected = () => console.log('已断开')
const onError = (msg: string) => console.error('错误:', msg)
const onVersionDetected = (version: UEVersion) => console.log('UE 版本:', version)
</script>
```

#### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `signallingUrl` | `string` | `ws://localhost:8888` | 信令服务器地址 |
| `mcpBridgeUrl` | `string` | `http://localhost:8080` | MCP Bridge 地址 |
| `ueVersion` | `'5.5' \| '5.0' \| '4.26'` | 自动检测 | 手动指定 UE 版本 |
| `autoConnect` | `boolean` | `true` | 自动连接 |
| `debug` | `boolean` | `false` | 调试模式（状态栏常显） |
| `showDebugPanel` | `boolean` | `false` | 调试面板初始显示 |
| `initialSettings` | `object` | 见下方 | 初始设置 |
| `mouseInteraction` | `object` | `{ HoveringMouse: true }` | 鼠标交互配置 |

```typescript
// initialSettings 默认值
{
  AutoConnect: true,
  AutoPlayVideo: true,
  StartVideoMuted: true,
  UseMic: false,
  UseCamera: false,
  MatchViewportResolution: true,
}
```

#### Events

| 事件 | 参数 | 说明 |
|------|------|------|
| `connected` | - | 连接成功 |
| `disconnected` | - | 连接断开 |
| `error` | `message: string` | 发生错误 |
| `command` | `command: MCPCommand` | 收到 MCP 命令 |
| `response` | `response: MCPResponse` | 发送响应 |
| `versionDetected` | `version: UEVersion` | 版本检测完成 |

#### Methods

```typescript
// 通过 ref 调用
const pixelStreamingRef = ref()

// 连接/断开
await pixelStreamingRef.value.connect()
pixelStreamingRef.value.disconnect()
await pixelStreamingRef.value.reconnect()

// 发送命令（响应不会发送到 MCP Bridge）
pixelStreamingRef.value.sendCommand({
  commandId: 'cmd-001',
  category: 'camera',
  action_name: 'setPosition',
  action_data: { x: 100, y: 200, z: 300 }
})

// 状态查询
pixelStreamingRef.value.isConnected.value
pixelStreamingRef.value.isVideoReady.value
pixelStreamingRef.value.detectedVersion.value

// 清空调试日志
pixelStreamingRef.value.clearLogs()
```

---

### 响应路由机制

组件实现了智能响应路由：

| 命令来源 | 响应去向 |
|----------|----------|
| **前端直接调用** `sendCommand()` | 只触发 `onResponse` 回调 |
| **MCP Bridge 发送** | 自动发送回 MCP Bridge + 触发回调 |

```typescript
// 前端调用 - 响应不发送到 MCP Bridge
pixelStreamingRef.value.sendCommand({ ... })

// MCP Bridge 发来的命令 - 响应自动返回
// 无需手动处理
```

---

### 在任意组件中使用（推荐）

使用 `usePixelStreaming` composable，可以在 PixelStreaming 组件的任意后代组件中访问像素流服务：

```vue
<template>
  <div>
    <button @click="moveCamera">移动相机</button>
    <p>状态: {{ ps.isConnected.value ? '已连接' : '未连接' }}</p>
    <p>UE 版本: {{ ps.detectedVersion.value }}</p>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue'
import { usePixelStreaming, type MCPCommand } from '@/components/qwenpaw-chat'

const ps = usePixelStreaming()

// 发送命令
const moveCamera = () => {
  const command: MCPCommand = {
    commandId: `cmd-${Date.now()}`,
    category: 'camera',
    action_name: 'setPosition',
    action_data: { x: 100, y: 200, z: 300 }
  }
  ps.sendCommand(command)
}

// 监听响应
const unsub = ps.onResponse((response) => {
  console.log('收到响应:', response)
})

onUnmounted(() => unsub())
</script>
```

#### usePixelStreaming API

| 属性/方法 | 类型 | 说明 |
|----------|------|------|
| `isConnected` | `Ref<boolean>` | 是否已连接 |
| `isVideoReady` | `Ref<boolean>` | 视频是否就绪 |
| `isSSEConnected` | `Ref<boolean>` | SSE 是否连接 |
| `detectedVersion` | `Ref<UEVersion \| null>` | 检测到的 UE 版本 |
| `errorMessage` | `Ref<string>` | 错误信息 |
| `connect()` | `() => Promise<void>` | 连接 |
| `disconnect()` | `() => void` | 断开 |
| `reconnect()` | `() => void` | 重连 |
| `sendCommand(cmd)` | `(MCPCommand) => boolean` | 发送命令 |
| `onCommand(cb)` | `(cb) => () => void` | 监听命令，返回取消函数 |
| `onResponse(cb)` | `(cb) => () => void` | 监听响应，返回取消函数 |
| `onConnected(cb)` | `(cb) => () => void` | 监听连接 |
| `onDisconnected(cb)` | `(cb) => () => void` | 监听断开 |
| `onError(cb)` | `(cb) => () => void` | 监听错误 |

---

## 目录结构

```
qwenpaw-chat/
├── index.ts                    # 导出入口
├── README.md                   # 使用文档
├── PROJECT_SUMMARY.md          # 项目技术总结
├── src/
│   ├── QwenPawChat.vue         # 聊天主组件
│   ├── PixelStreaming.vue      # 像素流组件
│   ├── api.ts                  # API 工具函数
│   ├── composables/            # Composables
│   │   ├── useDrag.ts          # 拖拽功能
│   │   ├── useChat.ts          # 聊天功能
│   │   └── usePixelStreaming.ts # 像素流功能（provide/inject）
│   └── pixelstreaming/         # 像素流模块
│       ├── index.ts            # 模块导出
│       ├── types.ts            # 类型定义
│       ├── constants.ts        # 常量配置
│       ├── errors.ts           # 错误处理
│       ├── config.ts           # 配置管理
│       ├── service.ts          # 核心服务
│       ├── version-detect.ts   # 版本检测
│       ├── adapters/           # 适配器
│       │   ├── index.ts        # 工厂
│       │   ├── base.ts         # 基类
│       │   ├── modern.ts       # UE 5.x 适配器
│       │   ├── legacy.ts       # UE 4.x 适配器
│       │   └── simulate.ts     # 模拟适配器
│       └── utils/              # 工具
│           ├── logger.ts       # 日志
│           └── sse-client.ts   # SSE 客户端
└── src/styles/                 # 样式文件
    ├── variables.css           # CSS 变量
    └── markdown.css            # Markdown 样式
```

---

## 导出的 API

```typescript
import {
  // ===== 组件 =====
  QwenPawChat,
  PixelStreaming,
  ChatMessage,
  ChatInput,

  // ===== Composables =====
  useDrag,
  useChat,
  usePixelStreaming,        // 在任意组件中访问像素流
  usePixelStreamingOptional, // 安全使用（可选）

  // ===== Pixel Streaming 相关 =====
  PixelStreamingService,

  // 类型
  UEVersion,                // '5.5' | '5.0' | '4.26'
  PixelStreamingConfig,
  MCPCommand,
  MCPResponse,
  ConnectionStatus,
  
  // 错误处理
  PixelStreamingError,
  ErrorCodes,
  
  // 常量
  TIMEOUTS,
  DEFAULT_URLS,
  ConnectionStateLabels,
} from '@/components/qwenpaw-chat'
```

---

## MCP Bridge 配置

QwenPaw 智能体需要配置 MCP Bridge：

```json
{
  "mcpServers": {
    "pixelstreaming": {
      "command": "node",
      "args": ["E:/Git/claude/pixelstreming-mcp-bridge/dist/index.js"],
      "env": {
        "API_JSON_PATH": "E:/Git/claude/pixelstreming-mcp-bridge/api.json",
        "HTTP_PORT": "8080"
      }
    }
  }
}
```

### 架构说明

```
┌─────────────────┐                    ┌─────────────────┐
│   QwenPaw       │   stdio (MCP)      │   MCP Bridge    │
│   智能体客户端   │◄──────────────────►│   (Node.js)     │
└─────────────────┘                    └────────┬────────┘
                                                │
                                                │ HTTP/SSE (8080)
                                                │
                                       ┌────────▼────────┐
                                       │  PixelStreaming │
                                       │  Vue 组件        │
                                       │  (浏览器)        │
                                       └────────┬────────┘
                                                │
                                                │ WebSocket (8888)
                                                │
                                       ┌────────▼────────┐
                                       │   UE 5.x/4.x    │
                                       │   Pixel Stream  │
                                       └─────────────────┘
```

---

## 浏览器兼容性

- Chrome 88+
- Firefox 78+
- Safari 14+
- Edge 88+

---

## 相关文档

- [项目技术总结](./PROJECT_SUMMARY.md)
