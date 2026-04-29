/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_QWENPAW_API_URL: string
  readonly VITE_QWENPAW_API_KEY: string
  readonly VITE_QWENPAW_AGENT_ID: string
  readonly VITE_QWENPAW_SESSION_ID: string
  readonly VITE_QWENPAW_TIMEOUT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
