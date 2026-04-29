import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    // 测试环境
    environment: 'jsdom',
    // 全局变量
    globals: true,
    // 测试文件匹配模式
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // 排除目录
    exclude: ['node_modules', 'dist'],
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // 覆盖率目标：80%
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      },
      // 包含的文件
      include: [
        'src/components/qwenpaw-chat/src/**/*.ts',
        'src/components/qwenpaw-chat/src/**/*.vue'
      ],
      // 排除的文件
      exclude: [
        'src/components/qwenpaw-chat/src/**/*.d.ts',
        'src/components/qwenpaw-chat/src/**/index.ts',
        'src/components/qwenpaw-chat/src/**/*-types.ts'
      ]
    },
    // 设置超时时间
    testTimeout: 10000,
    // 设置钩子超时时间
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
