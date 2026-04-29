# Agent Chat

一个基于 Vue 3 + TypeScript 的智能体聊天组件库，支持 SSE 流式响应和 Pixel Streaming 多版本适配。

## ✨ 特性

### 🤖 智能体聊天
- **SSE 流式响应** - 实时消息流，支持思考阶段显示
- **Markdown 渲染** - 支持标题、列表、代码块、表格、LaTeX 数学公式
- **会话管理** - 自动保存历史到 localStorage，支持 `/clear` 命令
- **停止生成** - 发送中可随时停止，保存已生成内容
- **响应式设计** - 移动端友好，自适应布局
- **主题系统** - 暗色/亮色模式支持
- **可拖拽窗口** - 自由拖动聊天窗口位置

### 🎮 Pixel Streaming 集成
- **全版本支持** - UE 4.26+、UE 5.0-5.4、UE 5.5+ 完整兼容
- **智能版本检测** - 自动识别 UE 版本并选择适配器
- **MCP Bridge 集成** - 通过 SSE 接收命令，HTTP 发送响应
- **响应路由** - 前端命令响应不发送到 MCP Bridge
- **命令超时** - 30 秒超时自动返回错误响应
- **自动重连** - 指数退避 + 抖动策略

## 🚀 快速开始

### 安装

```bash
npm install
```

### 配置环境

复制 `.env.example` 为 `.env` 并配置：

```env
VITE_QWENPAW_API_URL=/api/console/chat
VITE_QWENPAW_API_KEY=your-api-key
VITE_QWENPAW_AGENT_ID=default
```

### 开发

```bash
npm run dev
```

访问 http://localhost:5173

### 构建

```bash
npm run build
npm run preview
```

## 📦 组件使用

### QwenPawChat 聊天组件

```vue
<template>
  <QwenPawChat
    title="智能助手"
    :show-close="true"
    @close="handleClose"
  />
</template>

<script setup>
import QwenPawChat from '@/components/qwenpaw-chat'
</script>
```

### PixelStreaming 像素流组件

```vue
<template>
  <PixelStreaming
    signalling-url="ws://localhost:8888"
    mcp-bridge-url="http://localhost:8080"
    @connected="onConnected"
  />
</template>

<script setup>
import { PixelStreaming } from '@/components/qwenpaw-chat'
</script>
```

### 跨组件访问像素流

```vue
<template>
  <PixelStreaming>
    <ControlPanel />
  </PixelStreaming>
</template>

<script setup>
import { PixelStreaming, usePixelStreaming } from '@/components/qwenpaw-chat'

// 在子组件中
const ps = usePixelStreaming()
ps.sendCommand({ category: 'camera', action_name: 'move', ... })
</script>
```

## 📁 项目结构

```
src/components/qwenpaw-chat/
├── index.ts                    # 导出入口
├── src/
│   ├── QwenPawChat.vue         # 聊天主组件
│   ├── PixelStreaming.vue      # 像素流组件
│   ├── api.ts                  # API 工具函数
│   ├── composables/            # Composables
│   │   ├── useChat.ts          # 聊天功能
│   │   ├── useDrag.ts          # 拖拽功能
│   │   └── usePixelStreaming.ts # 像素流功能
│   └── pixelstreaming/         # 像素流模块
│       ├── service.ts          # 核心服务
│       ├── version-detect.ts   # 版本检测
│       └── adapters/           # 适配器
│           ├── modern.ts       # UE 5.x
│           └── legacy.ts       # UE 4.x
└── README.md                   # 详细文档
```

## 🛠️ 开发脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run type-check` | TypeScript 类型检查 |
| `npm test` | 运行测试 |
| `npm run test:coverage` | 测试覆盖率报告 |

## 📚 文档

- [组件使用文档](./src/components/qwenpaw-chat/README.md)
- [项目技术总结](./src/components/qwenpaw-chat/PROJECT_SUMMARY.md)
- [开发规范](./CLAUDE.md)

## 📄 许可证

MIT
