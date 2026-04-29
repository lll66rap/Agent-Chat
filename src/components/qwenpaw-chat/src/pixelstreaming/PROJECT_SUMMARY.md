# Pixel Streaming 多版本适配器 - 项目总结

## 项目概述

本项目实现了一个生产级的像素流（Pixel Streaming）多版本适配方案，支持 Unreal Engine 4.26+ 和 UE 5.0+ 项目，通过 MCP Bridge 实现与 AI 系统的双向通信。

---

## 技术架构

### 核心模块

| 模块 | 文件 | 职责 |
|------|------|------|
| **服务层** | `service.ts` | 统一入口，协调适配器和 SSE |
| **适配器** | `adapters/` | 版本适配，连接管理 |
| **错误处理** | `errors.ts` | 结构化错误，错误码管理 |
| **配置** | `config.ts` + `constants.ts` | 默认配置，常量管理 |
| **版本检测** | `version-detect.ts` | 自动检测 UE 版本 |
| **日志** | `utils/logger.ts` | 可扩展日志系统 |
| **SSE 客户端** | `utils/sse-client.ts` | MCP Bridge 通信 |

### 设计模式

```
┌─────────────────────────────────────────────────────────┐
│                    设计模式应用                          │
├─────────────────────────────────────────────────────────┤
│  Factory Pattern     │ AdapterFactory 创建适配器实例    │
│  Strategy Pattern    │ 不同版本使用不同连接策略          │
│  Observer Pattern    │ 事件订阅，状态变化通知            │
│  Singleton Pattern   │ 全局日志传输                      │
└─────────────────────────────────────────────────────────┘
```

---

## 关键技术决策

### 1. 版本检测策略

**问题**: UE 4.x 和 UE 5.x 的信令协议差异，如何自动选择适配器？

**方案**: WebSocket 握手检测 + 默认回退
- 连接信令服务器，解析 `protocolVersion` 字段
- UE 5.x 也使用 protocolVersion 1.x，因此默认使用 ModernAdapter
- 仅在明确检测到旧版特征时使用 LegacyAdapter

### 2. 重连机制

**问题**: 网络不稳定时如何保证连接可靠性？

**方案**: 指数退避 + 抖动
```typescript
delay = baseDelay * 2^(attempt-1) + jitter(±25%)
```
- 防止重连风暴（惊群效应）
- 最大延迟 30 秒，最大重连 10 次
- 用户主动断开不触发自动重连

### 3. 事件驱动架构

**问题**: 如何高效检测视频就绪状态？

**方案**: 移除轮询，改用事件订阅
```typescript
// 之前: 每 500ms 轮询
setInterval(() => checkVideoReady(), 500)

// 之后: 事件驱动
adapter.onStatusChange(status => {
  if (status.videoReady) onVideoReady()
})
```

### 4. 错误处理标准化

**问题**: 字符串错误难以追踪和处理？

**方案**: 结构化错误类型
```typescript
class PixelStreamingError {
  code: ErrorCode        // 'E001'
  message: string        // '连接超时'
  recoverable: boolean   // 是否可恢复
  context: object        // 附加上下文
  timestamp: number      // 时间戳
}
```

---

## 性能优化

| 优化项 | 之前 | 之后 | 提升 |
|--------|------|------|------|
| 视频就绪检测 | 500ms 轮询 | 事件驱动 | CPU ↓ 100% |
| 版本检测超时 | 10s | 5s | 等待 ↓ 50% |
| 状态栏显示 | 常显 | 智能显隐 | 体验 ↑ |

---

## 文件结构

```
pixelstreaming/
├── index.ts              # 统一导出入口
├── types.ts              # TypeScript 类型定义
│   ├── UEVersion
│   ├── PixelStreamingConfig
│   ├── MCPCommand / MCPResponse
│   ├── ConnectionStatus
│   ├── ConnectionState
│   └── ConnectionStateLabels
│
├── constants.ts          # 常量配置
│   ├── TIMEOUTS          # 超时常量
│   ├── RECONNECT         # 重连参数
│   ├── DEFAULT_URLS      # 默认URL
│   └── calculateReconnectDelay()
│
├── errors.ts             # 错误处理
│   ├── ErrorCodes        # 错误码枚举
│   ├── PixelStreamingError
│   ├── createError       # 便捷创建
│   ├── isRecoverable     # 可恢复判断
│   └── isErrorCode       # 错误码检查
│
├── config.ts             # 配置管理
│   ├── DEFAULT_CONFIG
│   └── mergeConfig()
│
├── service.ts            # 核心服务
│   ├── start()
│   ├── stop()
│   ├── sendCommand()
│   └── 状态管理
│
├── version-detect.ts     # 版本检测
│   └── detectUEVersion()
│
├── adapters/
│   ├── index.ts          # 工厂模式
│   ├── base.ts           # 抽象基类
│   ├── modern.ts         # UE 5.0+ (lib-pixelstreamingfrontend)
│   ├── legacy.ts         # UE 4.26+ (原生 WebSocket)
│   └── simulate.ts       # 模拟测试
│
├── utils/
│   ├── logger.ts         # 日志系统
│   │   ├── Logger
│   │   ├── ConsoleTransport
│   │   ├── NullTransport
│   │   ├── setGlobalTransport
│   │   └── getGlobalTransport
│   │
│   └── sse-client.ts     # SSE 客户端
│       ├── 连接管理
│       ├── 心跳机制
│       └── 重连策略
│
└── README.md             # 文档
```

---

## Vue 组件特性

### UI 设计

| 元素 | 行为 |
|------|------|
| **状态栏** | 悬浮顶部，渐变背景，毛玻璃效果 |
| **调试面板** | 悬浮底部，命令/响应一一对应显示 |
| **状态指示器** | 像素流/MCP/视频 三色指示 |
| **固定按钮** | 图钉图标，固定状态栏显示 |

### 智能显示逻辑

```
调试模式 (debug=true)
  └→ 状态栏常显

生产模式 (debug=false)
  ├→ 连接中 → 显示
  ├→ 连接成功 → 2s 后隐藏
  ├→ 视频就绪 → 1.5s 后隐藏
  ├→ 断开/错误 → 显示
  └→ 鼠标悬停 + 有问题 → 显示
```

### 调试面板日志

命令和响应一一对应显示：
```
┌─────────────────────────────────────────┐
│ 14:30:15  CMD  camera.setPosition      │  ← 命令
│   14:30:16  OK   成功                   │  ← 对应响应
├─────────────────────────────────────────┤
│ 14:30:20  CMD  scene.loadLevel         │  ← 命令
│   --:--:--  等待  等待响应...           │  ← 等待中
└─────────────────────────────────────────┘
```

老版本兼容：无 `commandId` 时按时间顺序匹配响应。

### provide/inject 支持

通过 `usePixelStreaming` composable 在任意后代组件中访问像素流服务：

```typescript
// 在 PixelStreaming 的后代组件中
const ps = usePixelStreaming()

// 发送命令
ps.sendCommand({ commandId, category, action_name, action_data })

// 监听响应
ps.onResponse((response) => { ... })

// 查询状态
ps.isConnected.value
ps.isVideoReady.value
```

组件支持 `<slot>` 插槽，允许子组件访问上下文：

```vue
<PixelStreaming>
  <CustomControlPanel />
</PixelStreaming>
```

---

## 使用场景

### 1. 游戏直播/云游戏
```vue
<PixelStreaming
  signalling-url="wss://game-server:8888"
  :mouse-interaction="{ HoveringMouse: true }"
/>
```

### 2. 数字孪生/工业仿真
```vue
<PixelStreaming
  signalling-url="ws://twin-server:8888"
  mcp-bridge-url="http://ai-bridge:8080"
  @command="handleAICommand"
/>
```

### 3. 开发调试
```vue
<PixelStreaming
  :debug="true"
  :show-debug-panel="true"
  :simulate-mode="isDevelopment"
/>
```

---

## 后续规划

### 短期 (v1.1)
- [ ] 添加单元测试覆盖（vitest）
- [ ] 支持多路视频流切换
- [ ] 自适应码率调整
- [ ] 添加更多 MCP 命令示例

### 中期 (v1.2)
- [ ] WebRTC 统计信息收集
- [ ] 延迟监控和告警
- [ ] 录制和回放功能
- [ ] 支持音频双向通信

### 长期 (v2.0)
- [ ] WebCodecs 硬件加速
- [ ] P2P 直连模式
- [ ] 跨平台 SDK（Electron/移动端）
- [ ] AI 驱动的视频质量优化

---

## 依赖

| 包 | 版本 | 用途 |
|---|---|---|
| `@epicgames-ps/lib-pixelstreamingfrontend-ue5.7` | latest | UE 5.0+ 像素流库 |
| `vue` | ^3.x | Vue 3 组件 |

---

## 更新日志

### 2026-04-23
- ✅ 添加 `usePixelStreaming` composable（provide/inject）
- ✅ 组件支持 slot 插槽，允许子组件访问上下文
- ✅ 调试面板：命令/响应一一对应显示
- ✅ 调试面板：添加滚动条支持
- ✅ 老版本兼容：无 commandId 时按时间顺序匹配响应
- ✅ 清理无用文件（pixelStreamingService.ts、index.d.ts、assets/）
- ✅ 创建 PixelStreamingDemo 演示组件

### 2026-04-22
- ✅ 统一错误处理类型
- ✅ 提取常量配置
- ✅ 移除视频就绪轮询，改用事件驱动
- ✅ ModernAdapter 添加重连机制
- ✅ 版本检测超时优化 (10s → 5s)
- ✅ 日志系统支持自定义传输
- ✅ Vue 组件 UI 优化（悬浮状态栏、调试面板）
- ✅ 智能状态栏显示/隐藏逻辑
- ✅ 添加可拖拽聊天窗口支持
- ✅ 完善文档和类型定义
- ✅ 添加 Chat 错误处理模块
- ✅ 添加性能优化工具（throttle、debounce）

### 2026-04-20
- ✅ 初始架构设计
- ✅ ModernAdapter 实现
- ✅ LegacyAdapter 实现
- ✅ 版本自动检测
- ✅ SSE 客户端集成
- ✅ Vue 组件基础功能
