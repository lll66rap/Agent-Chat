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
 * 全局 window 扩展
 */
declare global {
  interface Window {
    webRtcPlayer: new (options: { peerConnectionOptions?: RTCConfiguration }) => WebRtcPlayer;
    adapter: unknown;
    inputOptions?: {
      controlScheme?: number;
      suppressBrowserKeys?: boolean;
      fakeMouseWithTouches?: boolean;
    };
    ControlSchemeType?: {
      LockedMouse: number;
      HoveringMouse: number;
    };
  }
}

/**
 * Legacy 适配器
 * 支持 UE 4.26 - 4.27
 *
 * 使用官方 webRtcPlayer.js 处理 WebRTC 连接
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
   * 动态加载 webRtcPlayer.js 脚本
   */
  private async loadWebRtcPlayerScript(): Promise<void> {
    if (this.scriptLoaded && typeof window.webRtcPlayer === 'function') {
      this.logger.debug('webRtcPlayer.js already loaded');
      return;
    }

    return new Promise((resolve, reject) => {
      // 先加载 adapter.js（webRtcPlayer.js 依赖）
      const adapterScript = document.createElement('script');
      adapterScript.src = '/libs/adapter.js';
      adapterScript.type = 'text/javascript';

      adapterScript.onload = () => {
        this.logger.info('adapter.js loaded');

        // 然后加载 webRtcPlayer.js
        const script = document.createElement('script');
        script.src = '/libs/webRtcPlayer.js';
        script.type = 'text/javascript';

        script.onload = () => {
          this.scriptLoaded = true;
          this.logger.info('webRtcPlayer.js loaded successfully');
          resolve();
        };

        script.onerror = () => {
          const error = new Error('Failed to load webRtcPlayer.js from /libs/webRtcPlayer.js');
          this.logger.error('Script load failed', error);
          reject(error);
        };

        document.head.appendChild(script);
      };

      adapterScript.onerror = () => {
        const error = new Error('Failed to load adapter.js from /libs/adapter.js');
        this.logger.error('adapter.js load failed', error);
        reject(error);
      };

      document.head.appendChild(adapterScript);
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
      // 1. 加载 webRtcPlayer.js
      await this.loadWebRtcPlayerScript();

      // 2. 创建 WebSocket 连接
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
        this.logger.info(`Auto reconnect check: autoReconnect=${this.autoReconnect}, intentionallyClosed=${this.intentionallyClosed}, isReconnecting=${this.isReconnecting}`);
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

    // 注册输入事件（使用官方方式的简化版）
    this.registerInputEvents(this.webRtcPlayer.video);

    // 创建 offer
    this.webRtcPlayer.createOffer();
  }

  /**
   * 注册输入事件（基于官方 app.js 的逻辑）
   */
  private registerInputEvents(videoElement: HTMLVideoElement): void {
    const hoverMouse = this.config.mouseInteraction.HoveringMouse;

    this.logger.info('Registering input events, HoveringMouse:', hoverMouse);

    if (hoverMouse) {
      this.registerHoveringMouseEvents(videoElement);
    } else {
      this.registerLockedMouseEvents(videoElement);
    }

    this.registerKeyboardEvents();
    this.registerTouchEvents(videoElement);
  }

  /**
   * 发送输入数据
   */
  private sendInputData(data: ArrayBuffer): void {
    if (this.webRtcPlayer) {
      this.webRtcPlayer.send(data);
    }
  }

  /**
   * 注册悬停鼠标事件（基于官方 app.js）
   */
  private registerHoveringMouseEvents(playerElement: HTMLVideoElement): void {
    // 悬停模式下显示默认光标
    playerElement.style.cursor = 'default';

    const emitMouseMove = (x: number, y: number, deltaX: number, deltaY: number) => {
      const coord = this.normalizeAndQuantizeUnsigned(playerElement, x, y);
      const delta = this.normalizeAndQuantizeSigned(playerElement, deltaX, deltaY);

      const data = new DataView(new ArrayBuffer(9));
      data.setUint8(0, MessageType.MouseMove);
      data.setUint16(1, coord.x, true);
      data.setUint16(3, coord.y, true);
      data.setInt16(5, delta.x, true);
      data.setInt16(7, delta.y, true);
      this.sendInputData(data.buffer);
    };

    const emitMouseDown = (button: number, x: number, y: number) => {
      const coord = this.normalizeAndQuantizeUnsigned(playerElement, x, y);
      const data = new DataView(new ArrayBuffer(6));
      data.setUint8(0, MessageType.MouseDown);
      data.setUint8(1, button);
      data.setUint16(2, coord.x, true);
      data.setUint16(4, coord.y, true);
      this.sendInputData(data.buffer);
    };

    const emitMouseUp = (button: number, x: number, y: number) => {
      const coord = this.normalizeAndQuantizeUnsigned(playerElement, x, y);
      const data = new DataView(new ArrayBuffer(6));
      data.setUint8(0, MessageType.MouseUp);
      data.setUint8(1, button);
      data.setUint16(2, coord.x, true);
      data.setUint16(4, coord.y, true);
      this.sendInputData(data.buffer);
    };

    const emitMouseWheel = (delta: number, x: number, y: number) => {
      const coord = this.normalizeAndQuantizeUnsigned(playerElement, x, y);
      const data = new DataView(new ArrayBuffer(7));
      data.setUint8(0, MessageType.MouseWheel);
      // UE 期望的滚轮方向与浏览器相反
      data.setInt16(1, -delta, true);
      data.setUint16(3, coord.x, true);
      data.setUint16(5, coord.y, true);
      this.sendInputData(data.buffer);
    };

    playerElement.onmouseenter = () => {
      const data = new Uint8Array([MessageType.MouseEnter]);
      this.sendInputData(data.buffer);
    };

    playerElement.onmouseleave = () => {
      const data = new Uint8Array([MessageType.MouseLeave]);
      this.sendInputData(data.buffer);
    };

    playerElement.onmousemove = (e) => {
      emitMouseMove(e.offsetX, e.offsetY, e.movementX, e.movementY);
    };

    playerElement.onmousedown = (e) => {
      emitMouseDown(e.button, e.offsetX, e.offsetY);
    };

    playerElement.onmouseup = (e) => {
      emitMouseUp(e.button, e.offsetX, e.offsetY);
    };

    playerElement.onwheel = (e) => {
      e.preventDefault();
      emitMouseWheel(e.deltaY, e.offsetX, e.offsetY);
    };

    playerElement.oncontextmenu = (e) => {
      e.preventDefault();
    };
  }

  /**
   * 注册锁定鼠标事件
   */
  private registerLockedMouseEvents(playerElement: HTMLVideoElement): void {
    playerElement.onclick = () => {
      playerElement.requestPointerLock();
    };

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === playerElement) {
        const data = new Uint8Array([MessageType.MouseEnter]);
        this.sendInputData(data.buffer);
      } else {
        const data = new Uint8Array([MessageType.MouseLeave]);
        this.sendInputData(data.buffer);
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== playerElement) return;

      const data = new DataView(new ArrayBuffer(9));
      data.setUint8(0, MessageType.MouseMove);
      data.setUint16(1, 0, true);
      data.setUint16(3, 0, true);
      data.setInt16(5, e.movementX, true);
      data.setInt16(7, e.movementY, true);
      this.sendInputData(data.buffer);
    });

    document.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== playerElement) return;

      const data = new DataView(new ArrayBuffer(6));
      data.setUint8(0, MessageType.MouseDown);
      data.setUint8(1, e.button);
      data.setUint16(2, 0, true);
      data.setUint16(4, 0, true);
      this.sendInputData(data.buffer);
    });

    document.addEventListener('mouseup', (e) => {
      if (document.pointerLockElement !== playerElement) return;

      const data = new DataView(new ArrayBuffer(6));
      data.setUint8(0, MessageType.MouseUp);
      data.setUint8(1, e.button);
      data.setUint16(2, 0, true);
      data.setUint16(4, 0, true);
      this.sendInputData(data.buffer);
    });
  }

  /**
   * 注册键盘事件
   */
  private registerKeyboardEvents(): void {
    const getKeyCode = (e: KeyboardEvent): number => {
      if (e.keyCode === 16 && e.location === 2) return 25; // RightShift
      if (e.keyCode === 17 && e.location === 2) return 26; // RightControl
      if (e.keyCode === 18 && e.location === 2) return 27; // RightAlt
      return e.keyCode;
    };

    const isBrowserKey = (keyCode: number): boolean => {
      return (keyCode >= 112 && keyCode <= 123) || keyCode === 9;
    };

    document.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!this.webRtcPlayer) return;

      const keyCode = getKeyCode(e);
      const data = new Uint8Array([MessageType.KeyDown, keyCode, e.repeat ? 1 : 0]);
      this.sendInputData(data.buffer);

      if (isBrowserKey(keyCode)) {
        e.preventDefault();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!this.webRtcPlayer) return;

      const keyCode = getKeyCode(e);
      const data = new Uint8Array([MessageType.KeyUp, keyCode]);
      this.sendInputData(data.buffer);

      if (isBrowserKey(keyCode)) {
        e.preventDefault();
      }
    });

    document.addEventListener('keypress', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!this.webRtcPlayer) return;

      const data = new DataView(new ArrayBuffer(3));
      data.setUint8(0, MessageType.KeyPress);
      data.setUint16(1, e.charCode, true);
      this.sendInputData(data.buffer);
    });
  }

  /**
   * 注册触摸事件
   */
  private registerTouchEvents(playerElement: HTMLVideoElement): void {
    playerElement.ontouchstart = (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const coord = this.normalizeAndQuantizeUnsigned(playerElement, touch.clientX, touch.clientY);
        const data = new DataView(new ArrayBuffer(8));
        data.setUint8(0, MessageType.TouchStart);
        data.setUint8(1, i);
        data.setUint16(2, coord.x, true);
        data.setUint16(4, coord.y, true);
        data.setUint8(6, e.touches.length);
        data.setUint8(7, e.changedTouches.length);
        this.sendInputData(data.buffer);
      }
    };

    playerElement.ontouchend = (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const coord = this.normalizeAndQuantizeUnsigned(playerElement, touch.clientX, touch.clientY);
        const data = new DataView(new ArrayBuffer(8));
        data.setUint8(0, MessageType.TouchEnd);
        data.setUint8(1, i);
        data.setUint16(2, coord.x, true);
        data.setUint16(4, coord.y, true);
        data.setUint8(6, e.touches.length);
        data.setUint8(7, e.changedTouches.length);
        this.sendInputData(data.buffer);
      }
    };

    playerElement.ontouchmove = (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const coord = this.normalizeAndQuantizeUnsigned(playerElement, touch.clientX, touch.clientY);
        const data = new DataView(new ArrayBuffer(8));
        data.setUint8(0, MessageType.TouchMove);
        data.setUint8(1, i);
        data.setUint16(2, coord.x, true);
        data.setUint16(4, coord.y, true);
        data.setUint8(6, e.touches.length);
        data.setUint8(7, e.changedTouches.length);
        this.sendInputData(data.buffer);
      }
    };
  }

  /**
   * 归一化并量化无符号坐标
   */
  private normalizeAndQuantizeUnsigned(playerElement: HTMLElement, x: number, y: number): { x: number; y: number } {
    const playerAspectRatio = playerElement.clientHeight / playerElement.clientWidth;
    const video = playerElement.querySelector('video');
    const videoAspectRatio = video ? video.videoHeight / video.videoWidth : playerAspectRatio;

    if (playerAspectRatio > videoAspectRatio) {
      // 竖向黑边
      const ratio = playerAspectRatio / videoAspectRatio;
      const normalizedX = x / playerElement.clientWidth;
      const normalizedY = (y / playerElement.clientHeight - 0.5 * (ratio - 1)) / videoAspectRatio;
      return {
        x: Math.floor(normalizedX * 65536),
        y: Math.floor(normalizedY * 65536),
      };
    } else {
      // 横向黑边
      const ratio = videoAspectRatio / playerAspectRatio;
      const normalizedX = (x / playerElement.clientWidth - 0.5 * (ratio - 1)) / videoAspectRatio;
      const normalizedY = y / playerElement.clientHeight;
      return {
        x: Math.floor(normalizedX * 65536),
        y: Math.floor(normalizedY * 65536),
      };
    }
  }

  /**
   * 归一化并量化有符号坐标
   */
  private normalizeAndQuantizeSigned(playerElement: HTMLElement, x: number, y: number): { x: number; y: number } {
    return {
      x: Math.floor(x / playerElement.clientWidth * 32767),
      y: Math.floor(y / playerElement.clientHeight * 32767),
    };
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

/**
 * UE 4.x 输入消息类型（与官方 app.js 一致）
 */
const MessageType = {
  // Control Messages
  IFrameRequest: 0,
  RequestQualityControl: 1,
  MaxFpsRequest: 2,
  AverageBitrateRequest: 3,
  StartStreaming: 4,
  StopStreaming: 5,
  LatencyTest: 6,
  RequestInitialSettings: 7,

  // Generic Input Messages
  UIInteraction: 50,
  Command: 51,

  // Keyboard Input Messages
  KeyDown: 60,
  KeyUp: 61,
  KeyPress: 62,

  // Mouse Input Messages
  MouseEnter: 70,
  MouseLeave: 71,
  MouseDown: 72,
  MouseUp: 73,
  MouseMove: 74,
  MouseWheel: 75,

  // Touch Input Messages
  TouchStart: 80,
  TouchEnd: 81,
  TouchMove: 82,

  // Gamepad Input Messages
  GamepadButtonPressed: 90,
  GamepadButtonReleased: 91,
  GamepadAnalog: 92,
} as const;
