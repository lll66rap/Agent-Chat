// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/index.ts

import { PixelStreamingConfig, UEVersion, IPixelStreamingAdapter } from '../types';
import { ModernAdapter } from './modern';
import { Modern54Adapter } from './modern54';
import { LegacyAdapter } from './legacy';
import { SimulateAdapter } from './simulate';

/**
 * 适配器工厂
 */
export class AdapterFactory {
  /**
   * 根据配置创建适配器
   */
  static create(config: PixelStreamingConfig): IPixelStreamingAdapter {
    // 模拟模式
    if (config.simulateMode) {
      return new SimulateAdapter(config);
    }

    // 如果手动指定了版本
    if (config.ueVersion) {
      return this.createForVersion(config.ueVersion, config);
    }

    // 默认使用 Modern54 适配器（UE 5.0 ~ 5.4）
    return new Modern54Adapter(config);
  }

  /**
   * 根据 UE 版本创建适配器
   *
   * 适配器选择规则：
   * - UE 5.5+ 使用 Modern 适配器（@epicgames-ps/lib-pixelstreamingfrontend-ue5.7 库）
   * - UE 5.0 ~ 5.4 使用 Modern54 适配器（@epicgames-ps/lib-pixelstreamingfrontend-ue5.4 库）
   * - UE 4.26-4.27 使用 Legacy 适配器（原生 WebSocket + webRtcPlayer.js）
   *
   * 注意：
   * - @epicgames-ps/lib-pixelstreamingfrontend-ue5.7 库支持 UE 5.5+
   * - @epicgames-ps/lib-pixelstreamingfrontend-ue5.4 库支持 UE 5.0 ~ 5.4
   */
  static createForVersion(version: UEVersion, config: PixelStreamingConfig): IPixelStreamingAdapter {
    const versionNum = parseFloat(version);

    // UE 5.5+ 使用 Modern 适配器 (ue5.7)
    if (versionNum >= 5.5) {
      return new ModernAdapter(config);
    }

    // UE 5.0 ~ 5.4 使用 Modern54 适配器 (ue5.4)
    if (versionNum >= 5.0) {
      return new Modern54Adapter(config);
    }

    // UE 4.26-4.27 使用 Legacy 适配器
    return new LegacyAdapter(config);
  }

  /**
   * 判断是否可以使用 Modern 适配器
   */
  static canUseModernAdapter(version: UEVersion): boolean {
    const versionNum = parseFloat(version);
    return versionNum >= 5.0;
  }

  /**
   * 获取适配器类型名称
   */
  static getAdapterType(version: UEVersion | undefined, simulateMode: boolean): string {
    if (simulateMode) return 'SimulateAdapter';
    if (!version) return 'Modern54Adapter (default)';

    const versionNum = parseFloat(version);
    if (versionNum >= 5.5) return 'ModernAdapter';
    if (versionNum >= 5.0) return 'Modern54Adapter';
    return 'LegacyAdapter';
  }
}

// 导出所有适配器
export { BaseAdapter } from './base';
export { ModernAdapter } from './modern';
export { Modern54Adapter } from './modern54';
export { LegacyAdapter } from './legacy';
export { SimulateAdapter } from './simulate';
