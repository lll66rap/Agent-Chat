// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/config.ts

import { PixelStreamingConfig, UEVersion } from './types';
import { TIMEOUTS, DEFAULT_URLS, LOG } from './constants';

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: Required<Omit<PixelStreamingConfig, 'ueVersion'>> & { ueVersion?: UEVersion } = {
  signallingUrl: DEFAULT_URLS.SIGNALLING,
  mcpBridgeUrl: DEFAULT_URLS.MCP_BRIDGE,
  videoContainer: document.body,
  ueVersion: undefined,  // 不设置默认值，让版本检测来决定
  connectionTimeout: TIMEOUTS.CONNECTION,
  commandTimeout: TIMEOUTS.COMMAND,
  initialSettings: {
    AutoConnect: true,
    AutoPlayVideo: true,
    StartVideoMuted: true,
    UseMic: false,
    UseCamera: false,
    MatchViewportResolution: true,  // 默认匹配视口分辨率
  },
  mouseInteraction: {
    HoveringMouse: true,  // 默认启用悬停鼠标模式
    FakeMouseWithTouches: false,
  },
  debugMode: false,
  logLevel: LOG.DEFAULT_LEVEL,
  simulateMode: false,
};

/**
 * 合并用户配置与默认配置
 */
export function mergeConfig(userConfig: PixelStreamingConfig): Required<PixelStreamingConfig> {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    initialSettings: {
      ...DEFAULT_CONFIG.initialSettings,
      ...userConfig.initialSettings,
    },
    mouseInteraction: {
      ...DEFAULT_CONFIG.mouseInteraction,
      ...userConfig.mouseInteraction,
    },
  } as Required<PixelStreamingConfig>;
}

/**
 * 获取指定 UE 版本的 npm 包名
 */
export function getNpmPackageForVersion(version: string): string {
  const majorVersion = version.split('.')[0];
  if (majorVersion === '5') {
    return `@epicgames-ps/lib-pixelstreamingfrontend-ue5.7`;
  }
  // 默认使用 ue5.7
  return '@epicgames-ps/lib-pixelstreamingfrontend-ue5.7';
}
