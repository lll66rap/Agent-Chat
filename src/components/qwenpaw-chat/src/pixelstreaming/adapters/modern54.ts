// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/modern54.ts

import { PixelStreaming, Config, Logger } from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.4';
import { BaseAdapter } from './base';
import { PixelStreamingConfig, ConnectionStatus, MCPCommand } from '../types';
import { RECONNECT, calculateReconnectDelay } from '../constants';

/**
 * Modern54 适配器（UE 5.0 ~ 5.4）
 * 使用 @epicgames-ps/lib-pixelstreamingfrontend-ue5.4 库
 */
export class Modern54Adapter extends BaseAdapter {
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
  private boundOnWebRtcDisconnected: (e: Event) => void;
  private boundOnStreamDisconnect: () => void;
  private boundOnStreamReconnect: () => void;
  private boundOnWebRtcConnected: () => void;
  private boundOnWebRtcFailed: () => void;

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

    // WebRTC 连接成功
    this.boundOnWebRtcConnected = () => {
      this.logger.info('WebRTC connected');
    };

    // WebRTC 连接失败
    this.boundOnWebRtcFailed = () => {
      this.logger.error('WebRTC connection failed');
      this.connected = false;
      this.videoReady = false;
      this.emitStatusChange(this.getConnectionStatus());
    };

    // WebRTC 断开事件（信令服务器断开等）
    this.boundOnWebRtcDisconnected = (e: Event) => {
      const event = e as Event & { data: { eventString: string; allowClickToReconnect: boolean } };
      this.connected = false;
      this.videoReady = false;
      this.logger.warn(`WebRTC disconnected: ${event.data?.eventString}, canReconnect: ${event.data?.allowClickToReconnect}`);
      this.emitStatusChange(this.getConnectionStatus());

      // 自动重连（如果不是主动关闭）
      if (this.autoReconnect && !this.intentionallyClosed && event.data?.allowClickToReconnect) {
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
    return 'Modern54Adapter';
  }

  async connect(): Promise<void> {
    this.logger.info('Connecting with Modern54Adapter (UE 5.0 ~ 5.4)');
    this.intentionallyClosed = false;
    this.reconnectAttempts = 0;

    // 配置 PixelStreaming 库的日志级别
    // ue5.4 使用 SetLoggerVerbosity，数值越小越少日志
    // 0 = NoLogging, 1 = Error, 2 = Warning, 3 = Info, 4 = Debug, 5 = Verbose
    // 注意：设置为 1 (Error) 以避免 MouseEnter/MouseLeave 协议不匹配的警告日志
    Logger.SetLoggerVerbosity(1); // Error level only

    try {
      // ue5.4 库的配置（注意：ue5.4 没有 UseCamera 标志）
      const initialSettings = {
        AutoConnect: false,
        AutoPlayVideo: this.config.initialSettings.AutoPlayVideo ?? true,
        StartVideoMuted: this.config.initialSettings.StartVideoMuted ?? true,
        UseMic: this.config.initialSettings.UseMic ?? false,
        // 鼠标交互配置
        HoveringMouse: this.config.mouseInteraction?.HoveringMouse ?? true,
        FakeMouseWithTouches: this.config.mouseInteraction?.FakeMouseWithTouches ?? false,
        // 视口配置
        MatchViewportRes: this.config.initialSettings.MatchViewportResolution ?? true,
        // 重连配置
        MaxReconnectAttempts: 10,
        // 等待 streamer
        WaitForStreamer: true,
        // 禁用浏览器键盘快捷键捕获（避免与页面交互冲突）
        SuppressBrowserKeys: false,
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

      // 注册所有事件监听器
      this.pixelStreaming.addEventListener('dataChannelOpen', this.boundOnDataChannelOpen);
      this.pixelStreaming.addEventListener('dataChannelClose', this.boundOnDataChannelClose);
      this.pixelStreaming.addEventListener('videoInitialized', this.boundOnVideoInitialized);
      this.pixelStreaming.addResponseEventListener('mcp-response-handler', this.boundOnResponse);

      // WebRTC 连接状态事件
      this.pixelStreaming.addEventListener('webRtcConnected', this.boundOnWebRtcConnected);
      this.pixelStreaming.addEventListener('webRtcFailed', this.boundOnWebRtcFailed);
      this.pixelStreaming.addEventListener('webRtcDisconnected', this.boundOnWebRtcDisconnected);

      // 流事件
      this.pixelStreaming.addEventListener('streamDisconnect', this.boundOnStreamDisconnect);
      this.pixelStreaming.addEventListener('streamReconnect', this.boundOnStreamReconnect);

      this.pixelStreaming.connect();
      this.logger.info('Modern54Adapter connect() called, waiting for connection events...');
    } catch (error) {
      this.logger.error('Failed to connect with Modern54Adapter', error);
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
      this.pixelStreaming.removeEventListener('webRtcConnected', this.boundOnWebRtcConnected);
      this.pixelStreaming.removeEventListener('webRtcFailed', this.boundOnWebRtcFailed);
      this.pixelStreaming.removeEventListener('webRtcDisconnected', this.boundOnWebRtcDisconnected);
      this.pixelStreaming.removeEventListener('streamDisconnect', this.boundOnStreamDisconnect);
      this.pixelStreaming.removeEventListener('streamReconnect', this.boundOnStreamReconnect);
      this.pixelStreaming.disconnect();
      this.pixelStreaming = null;
    }
    this.connected = false;
    this.videoReady = false;
    this.logger.info('Modern54Adapter disconnected');
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
