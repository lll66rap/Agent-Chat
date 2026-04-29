// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/legacy.ts

import { BaseAdapter } from './base';
import {
  PixelStreamingConfig,
  ConnectionStatus,
  MCPCommand,
  UEVersion,
  PROTOCOL_VERSION_MAP,
} from '../types';
import { RECONNECT, calculateReconnectDelay } from '../constants';

/**
 * WebSocket 信令消息类型
 */
interface SignallingMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * webRtcPlayer 全局对象类型（来自官方 webRtcPlayer.js）
 */
interface WebRtcPlayer {
  video: HTMLVideoElement;
  createOffer: () => void;
  receiveAnswer: (answer: RTCSessionDescriptionInit) => void;
  handleCandidateFromServer: (candidate: RTCIceCandidateInit) => void;
  send: (data: string | ArrayBuffer) => void;
  close: () => void;
  onWebRtcOffer: ((offer: RTCSessionDescriptionInit) => void) | null;
  onWebRtcCandidate: ((candidate: RTCIceCandidate) => void) | null;
  onVideoInitialised: (() => void) | null;
  onDataChannelConnected: (() => void) | null;
  onDataChannelMessage: ((data: string) => void) | null;
}

/**
 * 全局 window 扩展（来自官方 app.js）
 */
declare global {
  interface Window {
    webRtcPlayer: new (options: { peerConnectionOptions?: RTCConfiguration }) => WebRtcPlayer;
    adapter: unknown;
    // 官方 app.js 的全局变量和函数
    webRtcPlayerObj: WebRtcPlayer | null;
    inputOptions?: {
      controlScheme?: number;
      suppressBrowserKeys?: boolean;
      fakeMouseWithTouches?: boolean;
      hideBrowserCursor?: boolean;
    };
    ControlSchemeType?: {
      LockedMouse: number;
      HoveringMouse: number;
    };
    // 官方函数
    setupNormalizeAndQuantize: () => void;
    registerHoveringMouseEvents: (playerElement: HTMLElement) => void;
    registerLockedMouseEvents: (playerElement: HTMLElement) => void;
    registerTouchEvents: (playerElement: HTMLElement) => void;
    registerKeyboardEvents: () => void;
    registerMouseEnterAndLeaveEvents: (playerElement: HTMLElement) => void;
    sendInputData: (data: ArrayBuffer) => void;
    toStreamerMessages: Map<string, { id: number; byteLength: number; structure: string[] }>;
    toStreamerHandlers: Map<string, (...args: unknown[]) => void>;
    emitCommand: (descriptor: unknown) => void;
    emitUIInteraction: (descriptor: unknown) => void;
    print_inputs: boolean;
  }
}

/**
 * Legacy 适配器
 * 支持 UE 4.26 - 4.27
 *
 * 使用官方 webRtcPlayer.js 和 app.js 处理 WebRTC 连接和输入
 */
export class LegacyAdapter extends BaseAdapter {
  private webSocket: WebSocket | null = null;
  private webRtcPlayer: WebRtcPlayer | null = null;
  private connectionStatus: ConnectionStatus = {
    pixelStreaming: false,
    sse: false,
    videoReady: false,
  };
  private reconnectAttempts = 0;
  private autoReconnect = true;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private isReconnecting = false;
  private scriptLoaded = false;

  constructor(config: PixelStreamingConfig) {
    super(config);
  }

  protected getAdapterName(): string {
    return 'LegacyAdapter';
  }

  /**
   * 动态加载官方脚本
   */
  private async loadScripts(): Promise<void> {
    if (this.scriptLoaded && typeof window.webRtcPlayer === 'function') {
      this.logger.debug('Scripts already loaded');
      return;
    }

    return new Promise((resolve, reject) => {
      // 1. 加载 adapter.js
      const adapterScript = document.createElement('script');
      adapterScript.src = '/libs/adapter.js';
      adapterScript.type = 'text/javascript';

      adapterScript.onload = () => {
        this.logger.info('adapter.js loaded');

        // 2. 加载 webRtcPlayer.js
        const webRtcScript = document.createElement('script');
        webRtcScript.src = '/libs/webRtcPlayer.js';
        webRtcScript.type = 'text/javascript';

        webRtcScript.onload = () => {
          this.logger.info('webRtcPlayer.js loaded');

          // 3. 加载 app.js（包含输入处理）
          const appScript = document.createElement('script');
          appScript.src = '/libs/app.js';
          appScript.type = 'text/javascript';

          appScript.onload = () => {
            this.scriptLoaded = true;
            this.logger.info('app.js loaded successfully');
            resolve();
          };

          appScript.onerror = () => {
            const error = new Error('Failed to load app.js');
            this.logger.error('app.js load failed', error);
            reject(error);
          };

          document.head.appendChild(appScript);
        };

        webRtcScript.onerror = () => {
          const error = new Error('Failed to load webRtcPlayer.js');
          this.logger.error('webRtcPlayer.js load failed', error);
          reject(error);
        };

        document.head.appendChild(webRtcScript);
      };

      adapterScript.onerror = () => {
        const error = new Error('Failed to load adapter.js');
        this.logger.error('adapter.js load failed', error);
        reject(error);
      };

      document.head.appendChild(adapterScript);
    });
  }

  /**
   * 初始化官方 app.js 的全局配置
   */
  private initAppJsGlobals(): void {
    // 设置控制方案
    if (!window.ControlSchemeType) {
      window.ControlSchemeType = {
        LockedMouse: 0,
        HoveringMouse: 1,
      };
    }

    // 设置输入选项
    if (!window.inputOptions) {
      window.inputOptions = {
        controlScheme: this.config.mouseInteraction.HoveringMouse ? 1 : 0,
        suppressBrowserKeys: true,
        fakeMouseWithTouches: this.config.mouseInteraction.FakeMouseWithTouches ?? false,
        hideBrowserCursor: false,
      };
    } else {
      // 更新现有配置
      window.inputOptions.controlScheme = this.config.mouseInteraction.HoveringMouse ? 1 : 0;
    }

    // 设置调试输出
    window.print_inputs = this.config.debugMode ?? false;

    this.logger.info('Initialized app.js globals:', {
      controlScheme: window.inputOptions.controlScheme,
      HoveringMouse: this.config.mouseInteraction.HoveringMouse,
    });
  }

  /**
   * 连接到信令服务器
   */
  async connect(): Promise<void> {
    this.logger.info('Connecting with LegacyAdapter (UE 4.26-4.27)');
    this.intentionallyClosed = false;
    this.reconnectAttempts = 0;

    try {
      // 1. 加载官方脚本
      await this.loadScripts();

      // 2. 初始化全局配置
      this.initAppJsGlobals();

      // 3. 创建 WebSocket 连接
      await this.connectWebSocket();

      this.logger.info('Legacy adapter connected, waiting for signalling...');
    } catch (error) {
      this.logger.error('Connection failed', error);
      throw error;
    }
  }

  /**
   * 创建 WebSocket 连接
   */
  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const { signallingUrl, connectionTimeout } = this.config;

      this.logger.info(`Connecting to signalling server: ${signallingUrl}`);

      const ws = new WebSocket(signallingUrl);
      this.webSocket = ws;

      // 设置连接超时
      const timeoutId = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error(`Connection timeout after ${connectionTimeout}ms`));
        }
      }, connectionTimeout);

      ws.onopen = () => {
        clearTimeout(timeoutId);
        this.logger.info('WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      };

      ws.onmessage = (event) => {
        this.handleSignallingMessage(event.data);
      };

      ws.onerror = (error) => {
        clearTimeout(timeoutId);
        this.logger.error('WebSocket error', error);
      };

      ws.onclose = (event) => {
        clearTimeout(timeoutId);
        this.logger.info(`WebSocket closed: ${event.code} - ${event.reason}`);

        // 重置所有连接状态
        this.connectionStatus.pixelStreaming = false;
        this.connectionStatus.videoReady = false;
        this.emitStatusChange(this.connectionStatus);

        // 清理 WebSocket 引用
        this.webSocket = null;

        // 自动重连
        if (this.autoReconnect && !this.intentionallyClosed) {
          this.scheduleReconnect();
        }
      };
    });
  }

  /**
   * 处理信令消息
   */
  private handleSignallingMessage(data: string): void {
    try {
      const message: SignallingMessage = JSON.parse(data);
      this.logger.debug('Received signalling message:', message.type);

      switch (message.type) {
        case 'config':
          this.handleConfig(message);
          break;

        case 'answer':
          this.handleAnswer(message);
          break;

        case 'iceCandidate':
          this.handleIceCandidate(message);
          break;

        case 'playerCount':
          this.logger.debug(`Player count: ${message.count}`);
          break;

        case 'ping':
          this.sendPong();
          break;

        default:
          this.logger.debug(`Unhandled message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error('Failed to parse signalling message', error);
    }
  }

  /**
   * 处理 config 消息 - 创建 webRtcPlayer
   */
  private handleConfig(message: SignallingMessage): void {
    this.logger.info('Received config from server');

    // 创建 webRtcPlayer
    const peerConnectionOptions = message.peerConnectionOptions as RTCConfiguration || {};
    this.createWebRtcPlayer(peerConnectionOptions);
  }

  /**
   * 创建 webRtcPlayer（使用官方脚本）
   */
  private createWebRtcPlayer(options: RTCConfiguration): void {
    if (typeof window.webRtcPlayer !== 'function') {
      this.logger.error('webRtcPlayer is not available');
      return;
    }

    // 关闭现有的 player
    if (this.webRtcPlayer) {
      this.webRtcPlayer.close();
    }

    // 记录配置信息
    this.logger.info('Creating webRtcPlayer with config:', {
      autoPlayVideo: this.config.initialSettings.AutoPlayVideo,
      startVideoMuted: this.config.initialSettings.StartVideoMuted,
      hoveringMouse: this.config.mouseInteraction.HoveringMouse,
    });

    // 创建新的 webRtcPlayer
    this.webRtcPlayer = new window.webRtcPlayer({
      peerConnectionOptions: options,
    });

    // 设置全局引用（app.js 需要）
    window.webRtcPlayerObj = this.webRtcPlayer;

    this.logger.info('Created webRtcPlayer');

    // 设置回调
    this.webRtcPlayer.onWebRtcOffer = (offer: RTCSessionDescriptionInit) => {
      this.sendOffer(offer);
    };

    this.webRtcPlayer.onWebRtcCandidate = (candidate: RTCIceCandidate) => {
      this.sendIceCandidate(candidate);
    };

    this.webRtcPlayer.onVideoInitialised = () => {
      this.logger.info('Video initialized');
      this.connectionStatus.videoReady = true;
      this.emitStatusChange(this.connectionStatus);

      // 检查视频元素状态
      if (this.webRtcPlayer?.video) {
        const video = this.webRtcPlayer.video;
        this.logger.info('Video element state:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          paused: video.paused,
          muted: video.muted,
          srcObject: !!video.srcObject
        });

        // 静音视频应该可以自动播放
        video.play().then(() => {
          this.logger.info('Video playback started successfully');
        }).catch((err: Error) => {
          this.logger.warn('Video autoplay blocked:', err.message);
          // 添加点击事件监听，用户点击后播放
          const playOnInteraction = () => {
            video.play().then(() => {
              this.logger.info('Video playback started after user interaction');
            }).catch((e: Error) => {
              this.logger.error('Video play failed:', e.message);
            });
            video.removeEventListener('click', playOnInteraction);
          };
          video.addEventListener('click', playOnInteraction);
        });
      }

      // 视频初始化后，设置坐标归一化函数（官方 app.js）
      if (typeof window.setupNormalizeAndQuantize === 'function') {
        window.setupNormalizeAndQuantize();
        this.logger.info('setupNormalizeAndQuantize called');
      }

      // 注册输入事件（使用官方函数）
      this.registerInputEvents();
    };

    this.webRtcPlayer.onDataChannelConnected = () => {
      this.logger.info('Data channel connected');
      this.connectionStatus.pixelStreaming = true;
      this.emitStatusChange(this.connectionStatus);

      // 检查视频轨道状态
      if (this.webRtcPlayer?.video?.srcObject) {
        const streams = this.webRtcPlayer.video.srcObject as MediaStream;
        const tracks = streams.getTracks();
        this.logger.info('Media tracks:', tracks.map(t => ({
          kind: t.kind,
          id: t.id,
          readyState: t.readyState,
          enabled: t.enabled,
          muted: t.muted
        })));
      }
    };

    this.webRtcPlayer.onDataChannelMessage = (data: string | ArrayBuffer) => {
      // 数据通道消息可能是字符串或 ArrayBuffer
      // UE 4.x 会发送很多内部消息（统计、控制等），需要过滤掉
      if (data instanceof ArrayBuffer) {
        // ArrayBuffer 消息通常是 UE 的内部消息（统计、延迟测试等）
        // 不应该转发到 MCP Bridge
        this.logger.debug(`Data channel message (ArrayBuffer) - ignored: ${data.byteLength} bytes`);
      } else if (typeof data === 'string') {
        // 字符串消息：检查是否是有效的 JSON 响应
        // UE 发送的内部消息通常是简单的数字或短字符串
        if (data.length > 2 && (data.startsWith('{') || data.startsWith('['))) {
          // 可能是 JSON 响应
          this.logger.debug('Data channel message (JSON):', data);
          this.emitResponse(data);
        } else {
          // 短字符串或数字是内部消息，忽略
          this.logger.debug('Data channel message (internal) - ignored:', data);
        }
      }
    };

    // 将视频元素添加到容器
    if (this.config.videoContainer && this.webRtcPlayer.video) {
      this.webRtcPlayer.video.style.width = '100%';
      this.webRtcPlayer.video.style.height = '100%';
      this.webRtcPlayer.video.style.objectFit = 'contain';
      this.webRtcPlayer.video.style.backgroundColor = '#000';
      this.webRtcPlayer.video.setAttribute('playsinline', 'true');
      this.webRtcPlayer.video.setAttribute('autoplay', 'true');
      // 必须静音才能自动播放（浏览器策略）
      const autoPlayVideo = this.config.initialSettings.AutoPlayVideo ?? true;
      const startVideoMuted = this.config.initialSettings.StartVideoMuted ?? true;
      this.webRtcPlayer.video.muted = autoPlayVideo || startVideoMuted;
      this.config.videoContainer.appendChild(this.webRtcPlayer.video);
      this.logger.info('Video element added to container, muted:', this.webRtcPlayer.video.muted);
    } else {
      this.logger.warn('Video container not available or video element missing');
    }

    // 创建 offer
    this.webRtcPlayer.createOffer();
  }

  /**
   * 注册输入事件（使用官方 app.js 函数）
   */
  private registerInputEvents(): void {
    if (!this.webRtcPlayer?.video) {
      this.logger.warn('Cannot register input events: video not ready');
      return;
    }

    const videoElement = this.webRtcPlayer.video;
    const hoverMouse = this.config.mouseInteraction.HoveringMouse;

    this.logger.info('Registering input events using official app.js functions, HoveringMouse:', hoverMouse);

    // 设置 sendInputData 函数（官方 app.js 需要）
    window.sendInputData = (data: ArrayBuffer) => {
      if (this.webRtcPlayer) {
        this.webRtcPlayer.send(data);
      }
    };

    // 注册鼠标进入/离开事件
    if (typeof window.registerMouseEnterAndLeaveEvents === 'function') {
      window.registerMouseEnterAndLeaveEvents(videoElement);
      this.logger.info('registerMouseEnterAndLeaveEvents called');
    }

    // 注册鼠标事件（悬停或锁定）
    if (hoverMouse) {
      if (typeof window.registerHoveringMouseEvents === 'function') {
        window.registerHoveringMouseEvents(videoElement);
        this.logger.info('registerHoveringMouseEvents called');
      }
    } else {
      if (typeof window.registerLockedMouseEvents === 'function') {
        window.registerLockedMouseEvents(videoElement);
        this.logger.info('registerLockedMouseEvents called');
      }
    }

    // 注册触摸事件
    if (typeof window.registerTouchEvents === 'function') {
      window.registerTouchEvents(videoElement);
      this.logger.info('registerTouchEvents called');
    }

    // 注册键盘事件
    if (typeof window.registerKeyboardEvents === 'function') {
      window.registerKeyboardEvents();
      this.logger.info('registerKeyboardEvents called');
    }
  }

  /**
   * 发送 offer
   */
  private sendOffer(offer: RTCSessionDescriptionInit): void {
    if (this.webSocket?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'offer',
        sdp: offer.sdp,
      };
      this.webSocket.send(JSON.stringify(message));
      this.logger.info('Sent offer to server');
    }
  }

  /**
   * 处理 answer 消息
   */
  private handleAnswer(message: SignallingMessage): void {
    this.logger.info('Received answer from server');

    if (this.webRtcPlayer && message.sdp) {
      this.webRtcPlayer.receiveAnswer({
        type: 'answer',
        sdp: message.sdp as string,
      });
    }
  }

  /**
   * 处理 ICE candidate
   */
  private handleIceCandidate(message: SignallingMessage): void {
    this.logger.debug('Received ICE candidate');

    if (this.webRtcPlayer) {
      const candidate = message.candidate as RTCIceCandidateInit;
      if (candidate) {
        this.webRtcPlayer.handleCandidateFromServer(candidate);
      }
    }
  }

  /**
   * 发送 ICE candidate
   */
  private sendIceCandidate(candidate: RTCIceCandidate): void {
    if (this.webSocket?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'iceCandidate',
        candidate: {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
        },
      };
      this.webSocket.send(JSON.stringify(message));
      this.logger.debug('Sent ICE candidate');
    }
  }

  /**
   * 发送 pong 响应
   */
  private sendPong(): void {
    if (this.webSocket?.readyState === WebSocket.OPEN) {
      this.webSocket.send(JSON.stringify({ type: 'pong' }));
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.logger.info('Disconnecting...');
    this.intentionallyClosed = true;

    // 清理重连定时器
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // 关闭 webRtcPlayer
    if (this.webRtcPlayer) {
      this.webRtcPlayer.close();
      if (this.webRtcPlayer.video && this.webRtcPlayer.video.parentNode) {
        this.webRtcPlayer.video.parentNode.removeChild(this.webRtcPlayer.video);
      }
      this.webRtcPlayer = null;
      window.webRtcPlayerObj = null;
    }

    // 关闭 WebSocket
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }

    // 重置状态
    this.connectionStatus = {
      pixelStreaming: false,
      sse: false,
      videoReady: false,
    };

    this.logger.info('Legacy adapter disconnected');
  }

  /**
   * 调度自动重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= RECONNECT.MAX_ATTEMPTS) {
      this.logger.error(`Max reconnect attempts (${RECONNECT.MAX_ATTEMPTS}) reached`);
      this.isReconnecting = false;
      return;
    }

    // 如果已经在重连中，跳过
    if (this.isReconnecting) {
      this.logger.debug('Already reconnecting, skip schedule');
      return;
    }

    this.reconnectAttempts++;
    const delay = calculateReconnectDelay(this.reconnectAttempts);

    this.logger.info(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${RECONNECT.MAX_ATTEMPTS})`);

    this.isReconnecting = true;

    this.reconnectTimeout = setTimeout(async () => {
      try {
        // 清理旧连接
        this.cleanup();

        // 重新连接
        await this.connect();
        this.logger.info('Reconnect successful');
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
      } catch (error) {
        this.logger.error('Reconnect failed:', error);
        this.isReconnecting = false;
        // 继续重试
        if (this.reconnectAttempts < RECONNECT.MAX_ATTEMPTS) {
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  /**
   * 清理连接资源
   */
  private cleanup(): void {
    if (this.webRtcPlayer) {
      this.webRtcPlayer.close();
      if (this.webRtcPlayer.video && this.webRtcPlayer.video.parentNode) {
        this.webRtcPlayer.video.parentNode.removeChild(this.webRtcPlayer.video);
      }
      this.webRtcPlayer = null;
      window.webRtcPlayerObj = null;
    }
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
  }

  /**
   * 重新连接
   */
  async reconnect(): Promise<void> {
    this.logger.info('Reconnecting...');
    this.intentionallyClosed = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.disconnect();
    this.intentionallyClosed = false;
    this.reconnectAttempts = 0;

    await this.connect();
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connectionStatus.pixelStreaming;
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * 发送命令
   */
  sendCommand(command: MCPCommand): boolean {
    if (!this.webRtcPlayer) {
      this.logger.warn('Cannot send command: webRtcPlayer not initialized');
      return false;
    }

    // 使用官方 emitCommand 函数
    if (typeof window.emitCommand === 'function') {
      window.emitCommand(command);
      this.logger.info('Sending command to UE4 via emitCommand:', command);
      return true;
    }

    // 回退：直接发送 JSON
    const message = JSON.stringify(command);
    this.webRtcPlayer.send(message);
    this.logger.info('Sending command to UE4:', command);
    return true;
  }

  /**
   * 获取支持的 UE 版本范围
   */
  getSupportedVersions(): UEVersion[] {
    return ['4.26'];
  }

  /**
   * 从协议版本检测 UE 版本
   */
  detectUEVersion(protocolVersion: string): UEVersion | undefined {
    return PROTOCOL_VERSION_MAP[protocolVersion];
  }
}
