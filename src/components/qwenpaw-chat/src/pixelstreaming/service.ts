// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/service.ts

import {
  PixelStreamingConfig,
  PixelStreamingCallbacks,
  UEVersion,
  MCPCommand,
} from './types';
import { AdapterFactory } from './adapters';
import { SSEClient } from './utils/sse-client';
import { createLogger } from './utils/logger';
import { detectUEVersion } from './version-detect';
import { mergeConfig } from './config';

/**
 * 统一像素流服务
 */
export class PixelStreamingService {
  private config: Required<PixelStreamingConfig>;
  private callbacks: PixelStreamingCallbacks;
  private logger: ReturnType<typeof createLogger>;

  private adapter: ReturnType<typeof AdapterFactory.create> | null = null;
  private sseClient: SSEClient | null = null;
  private currentVersion: UEVersion | null = null;
  private sseConnected = false;
  private pendingCommandId: string | null = null;  // 当前待响应的命令ID
  private pendingCommandTimer: ReturnType<typeof setTimeout> | null = null;  // 命令超时定时器
  private pendingCommandSource: 'mcp' | 'frontend' | null = null;  // 命令来源
  private statusUnsubscribe: (() => void) | null = null;  // 状态变化订阅取消函数
  private hasNotifiedConnected = false;  // 是否已通知连接成功
  private commandTimeout: number;  // 命令超时时间（毫秒）

  constructor(config: PixelStreamingConfig, callbacks: PixelStreamingCallbacks = {}) {
    // 使用 mergeConfig 合并配置
    this.config = mergeConfig(config);
    this.callbacks = callbacks;
    this.logger = createLogger('PixelStreamingService', this.config.logLevel);
    this.commandTimeout = this.config.commandTimeout;
  }

  /**
   * 启动服务
   */
  async start(): Promise<void> {
    this.logger.info('Starting Pixel Streaming service...');
    this.hasNotifiedConnected = false;

    // 1. 检测或使用指定的 UE 版本
    if (this.config.ueVersion) {
      this.currentVersion = this.config.ueVersion;
      this.logger.info(`Using specified UE version: ${this.currentVersion}`);
      // 即使是手动指定版本，也通知回调
      this.callbacks.onVersionDetected?.(this.currentVersion);
    } else {
      try {
        const detectionResult = await detectUEVersion(this.config.signallingUrl);
        this.currentVersion = detectionResult.version;
        this.logger.info(`Detected UE version: ${this.currentVersion} (${detectionResult.method})`);
        this.callbacks.onVersionDetected?.(this.currentVersion);
      } catch (error) {
        this.logger.warn('Version detection failed, using default', error);
        this.currentVersion = '5.0';
        this.callbacks.onVersionDetected?.(this.currentVersion);
      }
    }

    // 2. 创建并连接适配器（使用检测到的版本）
    const configWithVersion = {
      ...this.config,
      ueVersion: this.currentVersion,
    };
    this.adapter = AdapterFactory.create(configWithVersion);
    this.logger.info(`Created adapter: ${this.adapter.constructor.name}`);
    this.adapter.onResponse((response) => this.handleAdapterResponse(response));

    // 监听适配器状态变化（事件驱动，替代轮询）
    if (this.adapter.onStatusChange) {
      this.statusUnsubscribe = this.adapter.onStatusChange((status) => {
        this.logger.info('Adapter status changed:', status);

        // 通知像素流状态变化
        this.callbacks.onPixelStreamingStatusChange?.(status.pixelStreaming);

        // 通知视频状态变化
        if (status.videoReady) {
          this.callbacks.onVideoReady?.();
        }

        // 只在像素流连接成功时触发 onConnected（首次）
        if (status.pixelStreaming && !this.hasNotifiedConnected) {
          this.hasNotifiedConnected = true;
          this.callbacks.onConnected?.();
          this.logger.info('Pixel Streaming connected successfully');
        }
      });
    }

    // 发起连接（不等待连接完成）
    this.adapter.connect().catch((error) => {
      this.logger.error('Adapter connection failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.callbacks.onError?.(errorMessage);
    });

    // 3. 连接 SSE（可选，用于接收 MCP 命令）
    if (this.config.mcpBridgeUrl) {
      this.connectSSE().catch((error) => {
        this.logger.warn('SSE connection failed:', error);
      });
    } else {
      this.logger.info('No MCP Bridge URL configured, skipping SSE connection');
    }

    this.logger.info('Pixel Streaming service start initiated');
  }

  /**
   * 连接 SSE（可选功能）
   */
  private async connectSSE(): Promise<void> {
    try {
      this.sseClient = new SSEClient(this.config.mcpBridgeUrl, {
        onConnected: () => {
          this.sseConnected = true;
          this.logger.info('SSE connected to MCP Bridge');
          this.callbacks.onSSEStatusChange?.(true);  // 通知状态变化
        },
        onDisconnected: () => {
          this.sseConnected = false;
          this.logger.info('SSE disconnected from MCP Bridge');
          this.callbacks.onSSEStatusChange?.(false);  // 通知状态变化
        },
        onError: (error) => {
          this.sseConnected = false;
          this.callbacks.onSSEStatusChange?.(false);  // 通知状态变化
          // SSE 连接失败不应该阻止整个服务
          this.logger.warn('SSE connection error (MCP Bridge may not be running):', error);
        },
        onCommandReceived: (command) => this.handleMCPCommand(command),
      });

      await this.sseClient.connect();
    } catch (error) {
      // SSE 连接失败不应该阻止像素流服务
      this.logger.warn('Failed to connect SSE (MCP Bridge may not be running):', error);
      this.logger.info('Pixel Streaming will continue without MCP Bridge integration');
      this.sseClient = null;
    }
  }

  /**
   * 停止服务
   */
  stop(): void {
    this.logger.info('Stopping Pixel Streaming service...');

    // 取消状态订阅
    if (this.statusUnsubscribe) {
      this.statusUnsubscribe();
      this.statusUnsubscribe = null;
    }

    // 取消命令超时定时器
    if (this.pendingCommandTimer) {
      clearTimeout(this.pendingCommandTimer);
      this.pendingCommandTimer = null;
    }

    if (this.adapter) {
      this.adapter.disconnect();
      this.adapter = null;
    }

    if (this.sseClient) {
      this.sseClient.disconnect();
      this.sseClient = null;
    }

    this.sseConnected = false;
    this.hasNotifiedConnected = false;
    this.pendingCommandId = null;
    this.pendingCommandSource = null;
    this.callbacks.onDisconnected?.();
    this.logger.info('Pixel Streaming service stopped');
  }

  /**
   * 重连
   */
  async reconnect(): Promise<void> {
    this.stop();
    await this.start();
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus() {
    return {
      adapter: this.adapter?.getConnectionStatus() || { pixelStreaming: false, sse: false },
      sse: this.sseConnected,
      version: this.currentVersion,
    };
  }

  /**
   * 发送命令到 UE（内部方法）
   * @param command MCP 命令
   * @param source 命令来源：'mcp' 或 'frontend'
   */
  private sendCommandInternal(command: MCPCommand, source: 'mcp' | 'frontend'): boolean {
    if (!this.adapter) {
      this.logger.error('Adapter not initialized');
      return false;
    }

    // 清除之前的超时定时器
    if (this.pendingCommandTimer) {
      clearTimeout(this.pendingCommandTimer);
      this.pendingCommandTimer = null;
    }

    // 保存 commandId 和来源用于响应匹配和超时处理
    this.pendingCommandId = command.commandId;
    this.pendingCommandSource = source;

    // 设置超时定时器
    const currentCommandId = command.commandId;
    this.pendingCommandTimer = setTimeout(() => {
      // 只有当前命令ID匹配时才触发超时
      if (this.pendingCommandId === currentCommandId) {
        this.logger.warn(`Command ${currentCommandId} timed out after ${this.commandTimeout}ms`);
        // 清理状态
        this.pendingCommandId = null;
        this.pendingCommandSource = null;
        this.pendingCommandTimer = null;
        // 发送超时响应
        this.callbacks.onResponseSent?.({
          commandId: currentCommandId,
          error: 'UE 响应超时',
        });
      }
    }, this.commandTimeout);

    return this.adapter.sendCommand(command);
  }

  /**
   * 发送命令到 UE（来自 MCP Bridge）
   */
  sendCommand(command: MCPCommand): boolean {
    return this.sendCommandInternal(command, 'mcp');
  }

  /**
   * 发送命令到 UE（来自前端）
   */
  sendCommandFromFrontend(command: MCPCommand): boolean {
    return this.sendCommandInternal(command, 'frontend');
  }

  /**
   * 处理适配器响应
   */
  private handleAdapterResponse(response: string): void {
    this.logger.info('Handling adapter response:', response);

    // 清除超时定时器（收到响应后取消超时）
    if (this.pendingCommandTimer) {
      clearTimeout(this.pendingCommandTimer);
      this.pendingCommandTimer = null;
    }

    // UE 4.x 可能返回非 JSON 数据（如简单的数字标识符）
    // 尝试解析为 JSON，如果失败则作为原始字符串处理
    let data: Record<string, unknown>;
    let isRawResponse = false;

    try {
      data = JSON.parse(response) as Record<string, unknown>;
    } catch {
      // 不是 JSON，作为原始响应处理
      isRawResponse = true;
      data = { raw: response };
    }

    // UE5 返回的响应可能不包含 commandId，使用保存的 pendingCommandId
    const commandId = (data.commandId || data.CommandId || data.command_id || this.pendingCommandId || '') as string;
    const result = isRawResponse ? response : (data.result || data.Result || data.data || data);
    const error = data.error as string | undefined;

    // 只对来自 MCP Bridge 的命令发送响应回 MCP Bridge
    if (this.sseClient && this.sseConnected && this.pendingCommandSource === 'mcp') {
      this.logger.info('Sending response to MCP Bridge:', { commandId, result, error });

      this.sseClient.sendResponse({
        commandId,
        result,
        error,
      });
    }

    // 清除 pending command
    this.pendingCommandId = null;
    this.pendingCommandSource = null;

    // 通知响应已发送
    this.callbacks.onResponseSent?.({ commandId, result, error });
  }

  /**
   * 处理 MCP 命令
   */
  private handleMCPCommand(command: MCPCommand): void {
    this.logger.info('Received MCP command:', command);
    this.callbacks.onCommandReceived?.(command);

    // 发送到 UE（标记来源为 MCP）
    this.sendCommandInternal(command, 'mcp');
  }
}
