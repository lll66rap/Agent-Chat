// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/modern.ts

import { PixelStreaming, Config, Logger, LogLevel } from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.7';
import { BaseAdapter } from './base';
import { PixelStreamingConfig, ConnectionStatus, MCPCommand } from '../types';
import { RECONNECT, calculateReconnectDelay } from '../constants';

/**
 * Modern 适配器（UE 5.5+）
 * 使用 @epicgames-ps/lib-pixelstreamingfrontend-ue5.7 库
 */
export class ModernAdapter extends BaseAdapter {
  private pixelStreaming: PixelStreaming | null = null;
  private connected = false;
  private videoReady = false;

  // 重连机制
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private autoReconnect = true;

  // Bound event handlers for cleanup
  private boundOnDataChannelOpen: (e: Event) => void;
  private boundOnDataChannelClose: (e: Event) => void;
  private boundOnVideoInitialized: () => void;
  private boundOnResponse: (response: string) => void;
  private boundOnWebRtcDisconnected: (e: Event & { data: { eventString: string; allowClickToReconnect: boolean } }) => void;
  private boundOnStreamDisconnect: () => void;
  private boundOnStreamReconnect: () => void;

  constructor(config: PixelStreamingConfig) {
    super(config);

    // Bind handlers once for proper cleanup
    this.boundOnDataChannelOpen = (_e: Event) => {
      this.connected = true;
      this.logger.info('DataChannel opened');
      this.emitStatusChange(this.getConnectionStatus());
    };

    this.boundOnDataChannelClose = (_e: Event) => {
      this.connected = false;
      this.videoReady = false;
      this.logger.info('DataChannel closed');
      this.emitStatusChange(this.getConnectionStatus());
    };

    this.boundOnVideoInitialized = () => {
      this.videoReady = true;
      this.logger.info('Video initialized, videoReady = true');
      this.emitStatusChange(this.getConnectionStatus());
    };

    this.boundOnResponse = (response: string) => {
      this.logger.info('Received response from UE5:', response);
      this.emitResponse(response);
    };

    // WebRTC 断开事件（信令服务器断开等）
    this.boundOnWebRtcDisconnected = (e: Event & { data: { eventString: string; allowClickToReconnect: boolean } }) => {
      this.connected = false;
      this.videoReady = false;
      this.logger.warn(`WebRTC disconnected: ${e.data.eventString}, canReconnect: ${e.data.allowClickToReconnect}`);
      this.emitStatusChange(this.getConnectionStatus());

      // 自动重连（如果不是主动关闭）
      if (this.autoReconnect && !this.intentionallyClosed && e.data.allowClickToReconnect) {
        this.scheduleReconnect();
      }
    };

    // 视频流断开事件
    this.boundOnStreamDisconnect = () => {
      this.logger.info('Stream disconnected');
      this.emitStatusChange(this.getConnectionStatus());
    };

    // 视频流重连事件
    this.boundOnStreamReconnect = () => {
      this.logger.info('Stream reconnecting...');
    };
  }

  protected getAdapterName(): string {
    return 'ModernAdapter';
  }

  async connect(): Promise<void> {
    this.logger.info('Connecting with ModernAdapter (UE 5.5+)');
    this.intentionallyClosed = false;
    this.reconnectAttempts = 0;

    // 配置 PixelStreaming 库的日志级别
    // 只显示警告和错误，不显示 info 和 debug
    Logger.InitLogging(LogLevel.Warning, false);

    try {
      // 使用新的 Config API
      // 注意：5.7 库的 initialSettings 直接使用属性名，不需要 Flags 静态属性
      const initialSettings = {
        AutoConnect: this.config.initialSettings.AutoConnect ?? false,
        AutoPlayVideo: this.config.initialSettings.AutoPlayVideo ?? true,
        StartVideoMuted: this.config.initialSettings.StartVideoMuted ?? true,
        UseMic: this.config.initialSettings.UseMic ?? false,
        UseCamera: this.config.initialSettings.UseCamera ?? false,
        // 鼠标交互配置
        HoveringMouse: this.config.mouseInteraction?.HoveringMouse ?? true,
        FakeMouseWithTouches: this.config.mouseInteraction?.FakeMouseWithTouches ?? false,
        // 视口配置
        MatchViewportRes: this.config.initialSettings.MatchViewportResolution ?? true,
        // 重连配置
        MaxReconnectAttempts: 10,
        // 等待 streamer
        WaitForStreamer: true,
      };

      this.logger.info('Initial settings:', initialSettings);

      const config = new Config({
        initialSettings,
        useUrlParams: false,
      });

      this.pixelStreaming = new PixelStreaming(config, {
        videoElementParent: this.config.videoContainer,
      });

      this.pixelStreaming.setSignallingUrlBuilder(() => this.config.signallingUrl);

      // Use bound handlers for proper cleanup
      this.pixelStreaming.addEventListener('dataChannelOpen', this.boundOnDataChannelOpen);
      this.pixelStreaming.addEventListener('dataChannelClose', this.boundOnDataChannelClose);
      this.pixelStreaming.addEventListener('videoInitialized', this.boundOnVideoInitialized);
      this.pixelStreaming.addResponseEventListener('mcp-response-handler', this.boundOnResponse);

      // 添加 WebRTC 断开事件监听
      this.pixelStreaming.addEventListener('webRtcDisconnected', this.boundOnWebRtcDisconnected);
      this.pixelStreaming.addEventListener('streamDisconnect', this.boundOnStreamDisconnect);
      this.pixelStreaming.addEventListener('streamReconnect', this.boundOnStreamReconnect);

      this.pixelStreaming.connect();
      this.logger.info('ModernAdapter connect() called, waiting for connection events...');
    } catch (error) {
      this.logger.error('Failed to connect with ModernAdapter', error);
      throw error;
    }
  }

  disconnect(): void {
    this.logger.info('Disconnecting...');
    this.intentionallyClosed = true;

    // 清理重连定时器
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.pixelStreaming) {
      // Remove event listeners for proper cleanup
      this.pixelStreaming.removeEventListener('dataChannelOpen', this.boundOnDataChannelOpen);
      this.pixelStreaming.removeEventListener('dataChannelClose', this.boundOnDataChannelClose);
      this.pixelStreaming.removeEventListener('videoInitialized', this.boundOnVideoInitialized);
      this.pixelStreaming.removeResponseEventListener('mcp-response-handler');
      this.pixelStreaming.removeEventListener('webRtcDisconnected', this.boundOnWebRtcDisconnected);
      this.pixelStreaming.removeEventListener('streamDisconnect', this.boundOnStreamDisconnect);
      this.pixelStreaming.removeEventListener('streamReconnect', this.boundOnStreamReconnect);
      this.pixelStreaming.disconnect();
      this.pixelStreaming = null;
    }
    this.connected = false;
    this.videoReady = false;
    this.logger.info('ModernAdapter disconnected');
  }

  /**
   * 调度自动重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= RECONNECT.MAX_ATTEMPTS) {
      this.logger.error(`Max reconnect attempts (${RECONNECT.MAX_ATTEMPTS}) reached`);
      return;
    }

    this.reconnectAttempts++;
    const delay = calculateReconnectDelay(this.reconnectAttempts);

    this.logger.info(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${RECONNECT.MAX_ATTEMPTS})`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        // 清理旧连接
        if (this.pixelStreaming) {
          this.pixelStreaming.disconnect();
          this.pixelStreaming = null;
        }

        // 重新连接
        await this.connect();
        this.logger.info('Reconnect successful');
        this.reconnectAttempts = 0;
      } catch (error) {
        this.logger.error('Reconnect failed', error);
        // connect 失败会触发 webRtcDisconnected，进而触发下一次 scheduleReconnect
      }
    }, delay);
  }

  async reconnect(): Promise<void> {
    this.logger.info('Reconnecting...');
    this.intentionallyClosed = true;  // 防止断开时触发自动重连

    // 清理重连定时器
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // 先断开现有连接
    this.disconnect();

    // 重置状态
    this.intentionallyClosed = false;
    this.reconnectAttempts = 0;

    // 重新连接
    await this.connect();
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionStatus(): ConnectionStatus {
    return {
      pixelStreaming: this.connected,
      sse: false,
      videoReady: this.videoReady,
    };
  }

  sendCommand(command: MCPCommand): boolean {
    if (!this.pixelStreaming || !this.connected) {
      this.logger.warn('Cannot send command: not connected');
      return false;
    }

    const ue5Command = {
      commandId: command.commandId,
      category: command.category,
      action_name: command.action_name,
      action_data: command.action_data,
    };

    this.logger.info('Sending command to UE5:', ue5Command);
    return this.pixelStreaming.emitUIInteraction(ue5Command);
  }
}
