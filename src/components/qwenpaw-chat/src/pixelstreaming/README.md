# Pixel Streaming 多版本适配器

基于 Epic Games 官方像素流前端库的多版本适配方案，支持 UE 4.26+ 和 UE 5.0+ 项目。

## ✨ 特性

- 🎮 **多版本支持** - 自动检测 UE 版本，智能选择适配器
- 📚 **多库支持** - UE 5.5+ 使用 `lib-pixelstreamingfrontend-ue5.7`，UE 5.0~5.4 使用 `lib-pixelstreamingfrontend-ue5.4`
- 🔄 **自动重连** - 指数退避 + 抖动策略，防止惊群效应
- 📡 **MCP Bridge 集成** - 通过 SSE 接收命令，HTTP 发送响应
- 🎛️ **生产级 UI** - 悬浮状态栏、调试面板、智能显示/隐藏
- 🛡️ **类型安全** - 完整 TypeScript 类型定义
- ⚡ **事件驱动** - 无轮询，即时响应状态变化
- 🔧 **可扩展日志** - 支持自定义日志传输

## 安装

```bash
# UE 5.5+
npm install @epicgames-ps/lib-pixelstreamingfrontend-ue5.7

# UE 5.0 ~ 5.4
npm install @epicgames-ps/lib-pixelstreamingfrontend-ue5.4
```

## 快速开始

### 基础用法

```vue
<template>
  <PixelStreaming
    signalling-url="ws://localhost:8888"
    mcp-bridge-url="http://localhost:8080"
    @connected="onConnected"
    @disconnected="onDisconnected"
    @error="onError"
  />
</template>

<script setup>
import PixelStreaming from './PixelStreaming.vue'

const onConnected = () => console.log('已连接')
const onDisconnected = () => console.log('已断开')
const onError = (msg) => console.error('错误:', msg)
</script>
```

### 调试模式

```vue
<PixelStreaming
  :debug="true"
  :show-debug-panel="true"
/>
```

### 自定义配置

```vue
<PixelStreaming
  signalling-url="ws://your-server:8888"
  :mouse-interaction="{ HoveringMouse: true }"
  :auto-connect="true"
/>
```

## API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `signallingUrl` | `string` | `ws://localhost:8888` | 信令服务器地址 |
| `mcpBridgeUrl` | `string` | `http://localhost:8080` | MCP Bridge 地址 |
| `ueVersion` | `'5.0' \| '4.26'` | 自动检测 | 手动指定 UE 版本 |
| `autoConnect` | `boolean` | `true` | 自动连接 |
| `debug` | `boolean` | `false` | 调试模式（状态栏常显） |
| `showDebugPanel` | `boolean` | `false` | 调试面板初始显示 |
| `mouseInteraction` | `object` | `{ HoveringMouse: true }` | 鼠标交互配置 |

### Events

| 事件 | 参数 | 说明 |
|------|------|------|
| `connected` | - | 连接成功 |
| `disconnected` | - | 连接断开 |
| `error` | `message: string` | 发生错误 |
| `command` | `command: MCPCommand` | 收到 MCP 命令 |
| `response` | `response: MCPResponse` | 发送响应 |
| `versionDetected` | `version: UEVersion` | 版本检测完成 |

### Methods

```typescript
// 连接/断开
await pixelStreaming.connect()
pixelStreaming.disconnect()
await pixelStreaming.reconnect()

// 发送命令
pixelStreaming.sendCommand({
  commandId: 'cmd-001',
  category: 'camera',
  action_name: 'setPosition',
  action_data: { x: 100, y: 200, z: 300 }
})

// 状态
pixelStreaming.isConnected.value
pixelStreaming.isVideoReady.value
pixelStreaming.detectedVersion.value
```

## 架构

```
pixelstreaming/
├── index.ts              # 统一导出
├── types.ts              # 类型定义
├── constants.ts          # 常量配置
├── errors.ts             # 错误类型
├── config.ts             # 配置合并
├── service.ts            # 核心服务
├── version-detect.ts     # 版本检测
├── adapters/
│   ├── index.ts          # 适配器工厂
│   ├── base.ts           # 基类
│   ├── modern.ts         # UE 5.5+ 适配器 (ue5.7 库)
│   ├── modern54.ts       # UE 5.0~5.4 适配器 (ue5.4 库)
│   ├── legacy.ts         # UE 4.26+ 适配器
│   └── simulate.ts       # 模拟适配器
└── utils/
    ├── logger.ts         # 日志系统
    └── sse-client.ts     # SSE 客户端
```

### 适配器选择

```
┌─────────────────────────────────────────────────────────┐
│                    AdapterFactory                        │
├─────────────────────────────────────────────────────────┤
│  simulateMode? ──→ SimulateAdapter (测试)               │
│                                                         │
│  ueVersion >= 5.5 ──→ ModernAdapter                     │
│  (lib-pixelstreamingfrontend-ue5.7)                     │
│                                                         │
│  ueVersion >= 5.0 ──→ Modern54Adapter                   │
│  (lib-pixelstreamingfrontend-ue5.4)                     │
│                                                         │
│  ueVersion < 5.0 ──→ LegacyAdapter                      │
│  (原生 WebSocket + webRtcPlayer.js)                     │
└─────────────────────────────────────────────────────────┘
```

### 数据流

```
┌──────────────┐     WebSocket      ┌──────────────┐
│   UE 5.x     │◄──────────────────►│  Modern      │
│  PixelStream │                    │  Adapter     │
└──────────────┘                    └──────┬───────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │   Service    │
                                    └──────┬───────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
             ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
             │    SSE       │      │   Callbacks  │      │  Vue Comp    │
             │   Client     │      │              │      │              │
             └──────────────┘      └──────────────┘      └──────────────┘
                    │
                    ▼
             ┌──────────────┐
             │  MCP Bridge  │
             │  (Optional)  │
             └──────────────┘
```

## 配置

### 超时配置

```typescript
import { TIMEOUTS } from './pixelstreaming'

TIMEOUTS.CONNECTION         // 连接超时: 30000ms
TIMEOUTS.COMMAND            // 命令超时: 30000ms
TIMEOUTS.VERSION_DETECT     // 版本检测: 5000ms
TIMEOUTS.SSE_HEARTBEAT      // SSE 心跳: 60000ms
```

### 重连配置

```typescript
import { RECONNECT } from './pixelstreaming'

RECONNECT.MAX_ATTEMPTS      // 最大重连次数: 10
RECONNECT.BASE_DELAY        // 基础延迟: 1000ms
RECONNECT.MAX_DELAY         // 最大延迟: 30000ms
RECONNECT.JITTER_FACTOR     // 抖动因子: 0.25 (±25%)
```

## 导出的 API

```typescript
import {
  // ===== 类型 =====
  UEVersion,
  PixelStreamingConfig,
  MCPCommand,
  MCPResponse,
  ConnectionStatus,
  ConnectionState,
  ConnectionStateLabels,

  // ===== 服务 =====
  PixelStreamingService,

  // ===== 错误处理 =====
  PixelStreamingError,
  ErrorCodes,
  createError,
  isRecoverable,
  isErrorCode,

  // ===== 常量 =====
  TIMEOUTS,
  RECONNECT,
  DEFAULT_URLS,
  calculateReconnectDelay,

  // ===== 工具 =====
  createLogger,
  SSEClient,

  // ===== 适配器 =====
  AdapterFactory,
  ModernAdapter,
  Modern54Adapter,
  LegacyAdapter,
  SimulateAdapter,

  // ===== 版本检测 =====
  detectUEVersion,
} from './pixelstreaming'
```

---

## 错误处理

```typescript
import { PixelStreamingError, ErrorCodes, createError } from './pixelstreaming'

// 使用错误码
try {
  await service.start()
} catch (error) {
  if (error instanceof PixelStreamingError) {
    console.log(error.code)        // 'E001'
    console.log(error.recoverable) // true
    console.log(error.context)     // { timeout: 30000 }
  }
}

// 便捷创建
throw createError.connectionTimeout(30000)
throw createError.adapterNotReady()
```

### 错误码

| 代码 | 名称 | 说明 |
|------|------|------|
| E001 | CONNECTION_TIMEOUT | 连接超时 |
| E002 | CONNECTION_FAILED | 连接失败 |
| E101 | VERSION_DETECT_FAILED | 版本检测失败 |
| E201 | ADAPTER_NOT_INITIALIZED | 适配器未初始化 |
| E301 | COMMAND_SEND_FAILED | 命令发送失败 |
| E401 | SSE_CONNECTION_FAILED | SSE 连接失败 |

## 日志系统

```typescript
import { createLogger, NullTransport, setGlobalTransport } from './pixelstreaming'

// 禁用所有日志（生产环境）
setGlobalTransport(new NullTransport())

// 自定义日志传输
class MyTransport implements LogTransport {
  log(level, context, message, data) {
    // 发送到日志服务器
  }
}
setGlobalTransport(new MyTransport())
```

## 开发

### 版本检测原理

通过 WebSocket 连接信令服务器，解析握手消息中的 `majorProtocolVersion` 或 `protocolVersion` 字段判断 UE 版本：

```typescript
// UE 5.x 通常使用 protocolVersion 1.x 或 2.x+
// 但 protocolVersion 1.x 也被 UE 5.x 使用
// 因此默认使用 ModernAdapter (UE 5.0+)
```

### MCP 命令格式

```typescript
interface MCPCommand {
  commandId: string
  category: string      // 命令分类
  action_name: string   // 动作名称
  action_data: Record<string, unknown>  // 动作数据
}

// 示例
{
  commandId: 'cmd-001',
  category: 'camera',
  action_name: 'setPosition',
  action_data: { x: 100, y: 200, z: 300 }
}
```

## License

MIT
