# Pixel Streaming 项目技术总结

## 项目概述

本项目实现了一个统一的 Pixel Streaming 前端组件，支持 UE 4.26+ 和 UE 5.x 全版本兼容，集成 MCP Bridge 智能体控制能力。

---

## 核心架构

### 1. 适配器模式 (Adapter Pattern)

采用工厂模式创建版本适配器，实现多版本兼容：

```
AdapterFactory.create(config)
    │
    ├── UE 5.5+  → ModernAdapter (lib-pixelstreamingfrontend-ue5.7)
    ├── UE 5.0-5.4 → ModernAdapter (lib-pixelstreamingfrontend-ue5.4)
    ├── UE 4.26+ → LegacyAdapter (原生 WebSocket + webRtcPlayer.js)
    └── 测试模式 → SimulateAdapter
```

### 2. 服务层架构

```
PixelStreamingService (核心服务)
    │
    ├── Adapter (版本适配器)
    │   ├── WebSocket 连接
    │   ├── WebRTC PeerConnection
    │   ├── DataChannel (cirrus)
    │   └── 视频流处理
    │
    ├── SSEClient (MCP Bridge 通信)
    │   ├── SSE 接收命令
    │   └── HTTP 发送响应
    │
    └── VersionDetector (版本检测)
        └── WebSocket 握手探测
```

---

## 版本检测机制

### 检测策略

| UE 版本 | 协议版本 | 检测方式 | 结果 |
|---------|----------|----------|------|
| **UE 5.5+** | `1.3.0` (三段式) | `protocolVersion` 格式 | `5.5` |
| **UE 5.0-5.4** | 无/两段式 | 响应 `listStreamers` | `5.0` |
| **UE 4.26+** | `1.0` | 拒绝 `listStreamers` (1008) | `4.26` |

### 检测流程

```
1. 连接 WebSocket
2. 发送 { type: 'listStreamers' } 探测消息
3. 分析响应：
   ├── protocolVersion 三段式 (如 "1.3.0") → UE 5.5+
   ├── 收到 streamerList 响应 → UE 5.0+
   └── 连接关闭 1008 + "Unsupported" → UE 4.26
4. 超时 (3s) → 默认 UE 5.0+
```

### 关键发现

UE 4.x 和 UE 5.0 的初始握手消息完全相同：
- 都发送 `config` + `peerConnectionOptions`
- 都发送 `playerCount`
- 区分点：UE 4.x 不支持 `listStreamers` 命令

---

## 响应路由机制

### 问题背景

前端可能直接调用 `sendCommand()`，也可能从 MCP Bridge 接收命令。响应应该只返回给命令来源。

### 解决方案

```typescript
// 命令来源追踪
private pendingCommandSource: 'mcp' | 'frontend' | null = null;

// 两种发送方法
sendCommand(command)           // 来自 MCP Bridge → 标记 'mcp'
sendCommandFromFrontend(command) // 来自前端 → 标记 'frontend'

// 响应路由
handleAdapterResponse(response) {
  if (pendingCommandSource === 'mcp') {
    sseClient.sendResponse(response); // 只发送到 MCP Bridge
  }
  callbacks.onResponseSent?.(response); // 都通知前端
}
```

---

## 命令超时处理

### 实现机制

```typescript
// 发送命令时设置超时
pendingCommandTimer = setTimeout(() => {
  callbacks.onResponseSent?.({
    commandId,
    error: 'UE 响应超时'
  });
}, 30000);

// 收到响应时取消超时
clearTimeout(pendingCommandTimer);
```

### 防止重复超时

移除了 Vue 组件中的重复超时检查，统一由 Service 层处理。

---

## UE 4.x 适配器特殊处理

### 视频自动播放

UE 4.x 使用原生 `<video>` 元素，需要处理浏览器自动播放策略：

```typescript
// 确保视频静音才能自动播放
video.muted = true;
video.play().catch(() => {
  // 自动播放失败，等待用户交互
});
```

### 鼠标交互

UE 4.x 使用 `webRtcPlayer.js`，需要修正：

| 问题 | 原因 | 修复 |
|------|------|------|
| 鼠标滚轮方向相反 | deltaY 符号问题 | `-delta` |
| 鼠标光标不显示 | `styleCursor = 'none'` | `cursor = 'default'` |
| DataChannel 名称 | `cirrus` | 固定使用 `cirrus` |

### 重连机制

```typescript
// 移除 isReconnecting 检查，允许连续重连
ws.onclose = () => {
  scheduleReconnect();
};

scheduleReconnect() {
  const delay = calculateReconnectDelay(attempt);
  setTimeout(() => this.connect(), delay);
}
```

---

## 配置参数统一

### 移除重复属性

| 旧属性 | 新位置 |
|--------|--------|
| `autoPlayVideo` | `initialSettings.AutoPlayVideo` |
| `hoveringMouse` | `mouseInteraction.HoveringMouse` |

### 最终配置结构

```typescript
{
  signallingUrl: string,
  mcpBridgeUrl: string,
  videoContainer: HTMLElement,
  ueVersion?: '5.5' | '5.0' | '4.26',
  connectionTimeout?: number,
  commandTimeout?: number,
  initialSettings?: {
    AutoConnect?: boolean,
    AutoPlayVideo?: boolean,
    StartVideoMuted?: boolean,
    UseMic?: boolean,
    UseCamera?: boolean,
    MatchViewportResolution?: boolean,
  },
  mouseInteraction?: {
    HoveringMouse?: boolean,
    FakeMouseWithTouches?: boolean,
  },
  debugMode?: boolean,
  logLevel?: 'debug' | 'info' | 'warn' | 'error',
  simulateMode?: boolean,
}
```

---

## 调试功能

### 日志系统

```typescript
const logger = createLogger('ModuleName', logLevel);

logger.debug('详细调试信息');  // debug 级别
logger.info('一般信息');      // info 级别
logger.warn('警告信息');      // warn 级别
logger.error('错误信息');     // error 级别
```

### 调试面板

- 命令/响应日志一一对应
- 显示时间戳、命令类型、响应状态
- 支持清空日志

---

## 测试验证

### 版本检测测试

| UE 版本 | 测试结果 |
|---------|----------|
| UE 5.5+ | ✅ 正确检测为 `5.5` |
| UE 5.0+ | ✅ 正确检测为 `5.0` |
| UE 4.26+ | ✅ 正确检测为 `4.26` |

### 功能测试

| 功能 | UE 4.26+ | UE 5.0+ | UE 5.5+ |
|------|----------|---------|---------|
| 视频显示 | ✅ | ✅ | ✅ |
| 鼠标交互 | ✅ | ✅ | ✅ |
| 命令发送 | ✅ | ✅ | ✅ |
| 命令超时 | ✅ | ✅ | ✅ |
| 响应路由 | ✅ | ✅ | ✅ |
| 自动重连 | ✅ | ✅ | ✅ |

---

## 技术难点与解决方案

### 1. UE 版本无法区分

**问题**：UE 4.x 和 UE 5.0 初始握手消息相同

**解决**：主动发送 `listStreamers` 探测消息
- UE 5.x 响应 `streamerList`
- UE 4.x 返回 1008 错误

### 2. 响应路由混乱

**问题**：前端调用命令时响应也发送到 MCP Bridge

**解决**：引入 `pendingCommandSource` 追踪命令来源

### 3. 重复超时响应

**问题**：Vue 组件和 Service 都有超时检查

**解决**：移除 Vue 组件超时检查，统一由 Service 处理

### 4. 视频自动播放失败

**问题**：浏览器阻止非静音视频自动播放

**解决**：确保 `video.muted = true`

---

## 后续优化建议

1. **单元测试**：添加版本检测、响应路由的单元测试
2. **错误恢复**：增强断线重连的状态恢复
3. **性能监控**：添加视频帧率、延迟等指标
4. **配置验证**：添加配置参数的 schema 验证

---

## 文件清单

| 文件 | 职责 |
|------|------|
| `service.ts` | 核心服务，协调适配器和 SSE |
| `version-detect.ts` | 版本检测逻辑 |
| `adapters/modern.ts` | UE 5.x 适配器 |
| `adapters/legacy.ts` | UE 4.x 适配器 |
| `types.ts` | 类型定义 |
| `constants.ts` | 常量配置 |
| `config.ts` | 配置合并 |
| `errors.ts` | 错误处理 |
| `utils/logger.ts` | 日志工具 |
| `utils/sse-client.ts` | SSE 客户端 |
| `PixelStreaming.vue` | Vue 组件 |

---

## 更新日志

### 2026-04-27

- ✅ 实现三版本自动检测 (UE 5.5+/5.0+/4.26+)
- ✅ 修复响应路由，前端命令不发送到 MCP Bridge
- ✅ 修复重复超时响应问题
- ✅ 修复 UE 4.x 视频自动播放
- ✅ 修复 UE 4.x 鼠标交互问题
- ✅ 统一配置参数结构
- ✅ 简化调试日志输出
