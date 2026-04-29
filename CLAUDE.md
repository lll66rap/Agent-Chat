# Claude 开发指南

本项目是一个基于 Vue 3 + TypeScript 的智能体聊天组件库，支持 Pixel Streaming 多版本适配和完整的智能体交互功能。

## 📁 项目结构

```
chat/
├── src/
│   ├── components/
│   │   └── qwenpaw-chat/          # 智能体聊天组件库
│   │       ├── index.ts           # 导出入口
│   │       ├── src/
│   │       │   ├── QwenPawChat.vue     # 聊天主组件
│   │       │   ├── PixelStreaming.vue  # 像素流组件
│   │       │   ├── api.ts              # API 工具函数
│   │       │   ├── composables/        # Composables
│   │       │   │   ├── useDrag.ts
│   │       │   │   ├── useChat.ts
│   │       │   │   └── usePixelStreaming.ts
│   │       │   └── pixelstreaming/     # 像素流模块
│   │       │       ├── service.ts      # 核心服务
│   │       │       ├── adapters/       # 适配器
│   │       │       └── utils/          # 工具
│   │       ├── README.md
│   │       └── PROJECT_SUMMARY.md
│   └── styles/
└── .claude/rules/                  # 开发规则
```

## 🎯 技术栈

- **前端**: Vue 3 + TypeScript + Vite
- **样式**: CSS 变量 + CSS Modules
- **Pixel Streaming**: 支持 UE 4.26+, UE 5.0+, UE 5.5+ 全版本
- **智能体通信**: SSE 流式响应 + MCP Bridge
- **Markdown 渲染**: markdown-it + KaTeX 数学公式

## 📋 开发规范

### 代码风格

#### TypeScript
- 所有导出的函数、组件 props 必须显式定义类型
- 避免使用 `any`，优先使用 `unknown` 或泛型
- 优先使用 `interface` 定义对象结构
- 使用命名常量代替魔法数字

```typescript
// ✅ 正确
interface UserConfig {
  apiUrl: string
  timeout: number
}

function createClient(config: UserConfig): ApiClient {
  // ...
}

// ❌ 错误
function createClient(config) { // 缺少类型
  // ...
}
```

#### Vue 3 组件
- 使用 Composition API + `<script setup>`
- Props 使用 TypeScript 接口定义
- 组件命名使用 PascalCase
- 自定义 hook 使用 `use` 前缀

```vue
<script setup lang="ts">
interface Props {
  title: string
  disabled?: boolean
}

const props = defineProps<Props>()
</script>
```

#### CSS
- 使用 CSS 变量定义设计令牌
- 组件样式使用 `scoped` 属性
- 避免深度选择器 `>>>` 或 `/deep/`
- 优先使用 flexbox 布局

```css
:root {
  --chat-brand-start: oklch(62% 0.2 250);
  --chat-brand-end: oklch(58% 0.24 260);
  --chat-border-radius: 20px;
}

.chat-component {
  border-radius: var(--chat-border-radius);
  background: linear-gradient(135deg, 
    var(--chat-brand-start) 0%, 
    var(--chat-brand-end) 100%);
}
```

### 文件组织
- 按功能模块组织文件，而非按文件类型
- 单个组件目录包含：`.vue`、`.css`、`.ts` 文件
- 工具函数按功能分组在 `utils/` 目录
- 每个文件不超过 800 行

### 命名约定
- **组件**: PascalCase (`QwenPawChat`, `PixelStreaming`)
- **Composables**: `use` 前缀 + camelCase (`useChat`, `useDrag`)
- **CSS 类**: kebab-case 或 BEM 命名
- **常量**: UPPER_SNAKE_CASE (`MAX_HISTORY`, `CHAT_CONFIG`)
- **类型/接口**: PascalCase (`MessageItem`, `PixelStreamingConfig`)

## 🔧 开发工作流

### 1. 创建开发分支
```bash
git checkout -b feat/stop-session-button
```

### 2. 实现前规划
- 复杂功能必须先创建实现计划
- 使用 `EnterPlanMode` 规划架构和实现步骤
- 创建任务列表跟踪进度

### 3. 测试驱动开发
- 新功能必须添加单元测试
- 关键用户流程添加 E2E 测试
- 测试覆盖率保持在 80% 以上

### 4. 代码审查
- 所有更改必须经过代码审查
- 使用 `code-reviewer` 代理进行检查
- 安全相关代码必须通过 `security-reviewer`

### 5. 提交规范
使用约定式提交格式：
```
<type>: <description>

<optional body>
```

类型:
- `feat`: 新功能
- `fix`: Bug 修复
- `refactor`: 重构（不改变行为）
- `docs`: 文档更新
- `test`: 测试相关
- `chore`: 构建/工具/配置更新

示例:
```
feat: 添加会话停止按钮

- ChatInput 组件支持双状态按钮（发送/停止）
- useChat composable 添加 stop() 方法
- API 层添加 stopChat() 函数调用后端
```

## 🚫 禁止事项

### 安全性禁止
- ❌ 永远不要在源代码中硬编码密钥、API 令牌
- ❌ 禁止使用 `innerHTML` 插入未经验证的 HTML
- ❌ 禁止在错误消息中泄露敏感信息
- ❌ 禁止跳过输入验证

### 代码质量禁止
- ❌ 禁止函数超过 50 行代码
- ❌ 禁止文件超过 800 行代码
- ❌ 禁止嵌套深度超过 4 层
- ❌ 禁止生产环境中保留 `console.log`
- ❌ 禁止使用 `any` 类型逃避类型检查

### 性能禁止
- ❌ 禁止 N+1 数据库查询
- ❌ 禁止无界循环和递归
- ❌ 禁止无限制的 DOM 操作
- ❌ 禁止大文件直接嵌入 bundle

## 🛠️ 构建与测试

### 可用命令
```bash
# 开发
npm run dev          # 启动开发服务器
npm run type-check   # TypeScript 类型检查

# 构建
npm run build        # 生产构建
npm run preview      # 预览生产构建

# 代码质量
npm run lint         # ESLint 检查（需安装 ESLint）
npm run format       # Prettier 格式化（需安装 Prettier）

# 测试
npm test             # 运行测试（Vitest）
npm run test:run     # 单次运行测试
npm run test:watch   # 测试监视模式
npm run test:coverage # 测试覆盖率报告
```

### 环境变量
创建 `.env.local` 文件：
```env
# QwenPaw API 配置
VITE_QWENPAW_API_URL=/api/console/chat
VITE_QWENPAW_API_KEY=your-api-key
VITE_QWENPAW_AGENT_ID=default
VITE_QWENPAW_TIMEOUT=60000

# Pixel Streaming 配置
VITE_PIXEL_STREAMING_URL=ws://localhost:8888
VITE_MCP_BRIDGE_URL=http://localhost:8080
```

## 📦 QwenPaw Chat 组件库

### 快速开始
```bash
# 安装依赖
npm install markdown-it @epicgames-ps/lib-pixelstreamingfrontend-ue5.7

# 使用组件
import { QwenPawChat, PixelStreaming } from '@/components/qwenpaw-chat'
```

### 核心功能
1. **聊天功能**: SSE 流式响应、Markdown 渲染、历史记录管理
2. **像素流**: UE 全版本支持、智能版本检测、MCP Bridge 集成
3. **UI 组件**: 可拖拽窗口、响应式设计、主题支持
4. **工具函数**: API 封装、错误处理、本地存储

### 开发组件库时注意
- 保持 API 向后兼容
- 文档示例代码必须可运行
- 组件 props 必须充分类型化
- 避免组件间紧密耦合

## 🤖 Agent 使用指南

本项目已配置多个专业 agent，应主动使用：

### 必须使用的 Agent
| Agent | 用途 | 触发条件 |
|-------|------|----------|
| **planner** | 功能规划 | 复杂功能、重构 |
| **code-reviewer** | 代码审查 | 所有代码更改后 |
| **security-reviewer** | 安全检查 | 涉及用户输入、API 调用 |
| **tdd-guide** | TDD 开发 | 新功能、Bug 修复 |
| **build-error-resolver** | 构建修复 | 构建失败时 |

### 并行任务执行
多个独立任务应使用并行执行：
```javascript
// ✅ 正确：并行启动 agent
const agent1 = new Agent({ task: '安全分析' })
const agent2 = new Agent({ task: '性能检查' })
const agent3 = new Agent({ task: '类型检查' })

// ❌ 错误：不必要的顺序执行
await agent1.run()
await agent2.run()
await agent3.run()
```

## 📚 文档要求

### 组件文档必须包含
1. **Props 接口定义** - 完整的 TypeScript 接口
2. **使用示例** - 可运行的 Vue 组件示例
3. **API 文档** - 所有导出函数和类型
4. **版本兼容性** - 依赖版本和浏览器兼容性

### 代码注释规范
```typescript
/**
 * 发送消息到 QwenPaw API
 * @param message - 用户消息内容
 * @param sessionId - 会话 ID（可选，自动获取）
 * @param userId - 用户 ID（可选，自动生成）
 * @returns AbortController 用于取消请求
 * @throws {ChatError} 当网络错误或 API 错误时
 * @example
 * const controller = await qwenPawGenerateSse(
 *   '你好',
 *   'session_123',
 *   'user_456',
 *   { onMessage: (data) => console.log(data.text) }
 * )
 */
export async function qwenPawGenerateSse(
  message: string,
  sessionId?: string,
  userId?: string,
  callbacks?: QwenPawCallbacks
): Promise<AbortController>
```

## 🔍 调试与排查

### 常见问题
1. **UE 版本检测失败**: 检查 WebSocket 连接，查看 `version-detect.ts` 日志
2. **SSE 流式响应中断**: 检查网络连接和后端 API 状态
3. **组件不渲染**: 检查 Vue DevTools，确认 props 传递正确
4. **类型错误**: 运行 `npm run type-check` 查看详细错误

### 日志级别
组件支持调试模式：
```typescript
// 启用调试日志
import { setDebugMode } from '@/components/qwenpaw-chat'
setDebugMode(true)

// 或通过组件 prop
<QwenPawChat :debug="true" />
```

## ✅ PR 检查清单

提交 PR 前必须完成：

- [ ] 代码通过所有测试
- [ ] TypeScript 类型检查通过
- [ ] ESLint 检查通过
- [ ] 添加/更新了单元测试
- [ ] 更新了相关文档
- [ ] 代码已通过 `code-reviewer`
- [ ] 安全相关代码通过 `security-reviewer`
- [ ] 提交消息符合规范
- [ ] 不包含调试代码和 `console.log`

---

*最后更新: 2026-04-29*  
*维护者: QwenPaw Chat 团队*