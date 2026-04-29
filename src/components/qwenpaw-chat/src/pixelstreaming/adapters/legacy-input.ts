// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/legacy-input.ts

/**
 * UE 4.x 输入消息类型
 */
export const MessageType = {
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

/**
 * 鼠标按钮
 */
export const MouseButton = {
  MainButton: 0,      // Left
  AuxiliaryButton: 1, // Wheel
  SecondaryButton: 2, // Right
  FourthButton: 3,    // Browser Back
  FifthButton: 4,     // Browser Forward
} as const;

/**
 * 特殊键码
 */
export const SpecialKeyCodes = {
  BackSpace: 8,
  Shift: 16,
  Control: 17,
  Alt: 18,
  RightShift: 25,
  RightControl: 26,
  RightAlt: 27,
} as const;

/**
 * 输入处理器配置
 */
export interface InputHandlerConfig {
  videoElement: HTMLVideoElement;
  sendData: (data: ArrayBuffer) => void;
  hoverMouse?: boolean;  // true = 悬停模式，false = 锁定模式
}

/**
 * UE 4.x 输入处理器
 */
export class LegacyInputHandler {
  private videoElement: HTMLVideoElement;
  private sendData: (data: ArrayBuffer) => void;
  private hoverMouse: boolean;
  private videoWidth = 0;
  private videoHeight = 0;

  // 键盘状态
  private pressedKeys = new Set<number>();

  constructor(config: InputHandlerConfig) {
    this.videoElement = config.videoElement;
    this.sendData = config.sendData;
    this.hoverMouse = config.hoverMouse ?? true;

    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 视频元数据加载后获取尺寸
    this.videoElement.addEventListener('loadedmetadata', () => {
      this.videoWidth = this.videoElement.videoWidth;
      this.videoHeight = this.videoElement.videoHeight;
    });

    // 鼠标事件
    if (this.hoverMouse) {
      this.setupHoverMouseEvents();
    } else {
      this.setupLockedMouseEvents();
    }

    // 键盘事件
    this.setupKeyboardEvents();

    // 触摸事件
    this.setupTouchEvents();
  }

  /**
   * 设置悬停鼠标模式
   */
  private setupHoverMouseEvents(): void {
    this.videoElement.addEventListener('mouseenter', () => {
      const data = new Uint8Array([MessageType.MouseEnter]);
      this.sendMessage(data.buffer);
    });

    this.videoElement.addEventListener('mouseleave', () => {
      const data = new Uint8Array([MessageType.MouseLeave]);
      this.sendMessage(data.buffer);
    });

    this.videoElement.addEventListener('mousemove', (e) => {
      const coord = this.normalizeAndQuantizeUnsigned(e.offsetX, e.offsetY);
      const delta = this.normalizeAndQuantizeSigned(e.movementX, e.movementY);

      const data = new DataView(new ArrayBuffer(9));
      data.setUint8(0, MessageType.MouseMove);
      data.setUint16(1, coord.x, true);
      data.setUint16(3, coord.y, true);
      data.setInt16(5, delta.x, true);
      data.setInt16(7, delta.y, true);
      this.sendMessage(data.buffer);
    });

    this.videoElement.addEventListener('mousedown', (e) => {
      const coord = this.normalizeAndQuantizeUnsigned(e.offsetX, e.offsetY);
      const data = new DataView(new ArrayBuffer(6));
      data.setUint8(0, MessageType.MouseDown);
      data.setUint8(1, e.button);
      data.setUint16(2, coord.x, true);
      data.setUint16(4, coord.y, true);
      this.sendMessage(data.buffer);
    });

    this.videoElement.addEventListener('mouseup', (e) => {
      const coord = this.normalizeAndQuantizeUnsigned(e.offsetX, e.offsetY);
      const data = new DataView(new ArrayBuffer(6));
      data.setUint8(0, MessageType.MouseUp);
      data.setUint8(1, e.button);
      data.setUint16(2, coord.x, true);
      data.setUint16(4, coord.y, true);
      this.sendMessage(data.buffer);
    });

    this.videoElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const coord = this.normalizeAndQuantizeUnsigned(e.offsetX, e.offsetY);
      const data = new DataView(new ArrayBuffer(7));
      data.setUint8(0, MessageType.MouseWheel);
      data.setInt16(1, e.deltaY, true);
      data.setUint16(3, coord.x, true);
      data.setUint16(5, coord.y, true);
      this.sendMessage(data.buffer);
    });

    // 阻止右键菜单
    this.videoElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  /**
   * 设置锁定鼠标模式
   */
  private setupLockedMouseEvents(): void {
    this.videoElement.addEventListener('click', () => {
      this.videoElement.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.videoElement) {
        const data = new Uint8Array([MessageType.MouseEnter]);
        this.sendMessage(data.buffer);
      } else {
        const data = new Uint8Array([MessageType.MouseLeave]);
        this.sendMessage(data.buffer);
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.videoElement) return;

      const data = new DataView(new ArrayBuffer(9));
      data.setUint8(0, MessageType.MouseMove);
      data.setUint16(1, 0, true); // x position not used in locked mode
      data.setUint16(3, 0, true); // y position not used in locked mode
      data.setInt16(5, e.movementX, true);
      data.setInt16(7, e.movementY, true);
      this.sendMessage(data.buffer);
    });

    document.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== this.videoElement) return;

      const data = new DataView(new ArrayBuffer(6));
      data.setUint8(0, MessageType.MouseDown);
      data.setUint8(1, e.button);
      data.setUint16(2, 0, true);
      data.setUint16(4, 0, true);
      this.sendMessage(data.buffer);
    });

    document.addEventListener('mouseup', (e) => {
      if (document.pointerLockElement !== this.videoElement) return;

      const data = new DataView(new ArrayBuffer(6));
      data.setUint8(0, MessageType.MouseUp);
      data.setUint8(1, e.button);
      data.setUint16(2, 0, true);
      data.setUint16(4, 0, true);
      this.sendMessage(data.buffer);
    });

    document.addEventListener('wheel', (e) => {
      if (document.pointerLockElement !== this.videoElement) return;
      e.preventDefault();

      const data = new DataView(new ArrayBuffer(7));
      data.setUint8(0, MessageType.MouseWheel);
      data.setInt16(1, e.deltaY, true);
      data.setUint16(3, 0, true);
      data.setUint16(5, 0, true);
      this.sendMessage(data.buffer);
    });
  }

  /**
   * 设置键盘事件
   */
  private setupKeyboardEvents(): void {
    document.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const keyCode = this.getKeyCode(e);
      if (!this.pressedKeys.has(keyCode)) {
        this.pressedKeys.add(keyCode);
        const data = new Uint8Array([MessageType.KeyDown, keyCode, e.repeat ? 1 : 0]);
        this.sendMessage(data.buffer);
      }

      // 阻止浏览器快捷键
      if (this.isBrowserKey(keyCode)) {
        e.preventDefault();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const keyCode = this.getKeyCode(e);
      this.pressedKeys.delete(keyCode);
      const data = new Uint8Array([MessageType.KeyUp, keyCode]);
      this.sendMessage(data.buffer);

      if (this.isBrowserKey(keyCode)) {
        e.preventDefault();
      }
    });

    document.addEventListener('keypress', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const data = new DataView(new ArrayBuffer(3));
      data.setUint8(0, MessageType.KeyPress);
      data.setUint16(1, e.charCode, true);
      this.sendMessage(data.buffer);
    });
  }

  /**
   * 设置触摸事件
   */
  private setupTouchEvents(): void {
    this.videoElement.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const coord = this.normalizeAndQuantizeUnsigned(
          touch.clientX - this.videoElement.getBoundingClientRect().left,
          touch.clientY - this.videoElement.getBoundingClientRect().top
        );
        const data = new DataView(new ArrayBuffer(8));
        data.setUint8(0, MessageType.TouchStart);
        data.setUint8(1, i);
        data.setUint16(2, coord.x, true);
        data.setUint16(4, coord.y, true);
        data.setUint8(6, 1); // numTouches
        data.setUint8(7, 1); // numChangedTouches
        this.sendMessage(data.buffer);
      }
    });

    this.videoElement.addEventListener('touchend', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const coord = this.normalizeAndQuantizeUnsigned(
          touch.clientX - this.videoElement.getBoundingClientRect().left,
          touch.clientY - this.videoElement.getBoundingClientRect().top
        );
        const data = new DataView(new ArrayBuffer(8));
        data.setUint8(0, MessageType.TouchEnd);
        data.setUint8(1, i);
        data.setUint16(2, coord.x, true);
        data.setUint16(4, coord.y, true);
        data.setUint8(6, e.touches.length);
        data.setUint8(7, e.changedTouches.length);
        this.sendMessage(data.buffer);
      }
    });

    this.videoElement.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const coord = this.normalizeAndQuantizeUnsigned(
          touch.clientX - this.videoElement.getBoundingClientRect().left,
          touch.clientY - this.videoElement.getBoundingClientRect().top
        );
        const data = new DataView(new ArrayBuffer(8));
        data.setUint8(0, MessageType.TouchMove);
        data.setUint8(1, i);
        data.setUint16(2, coord.x, true);
        data.setUint16(4, coord.y, true);
        data.setUint8(6, e.touches.length);
        data.setUint8(7, e.changedTouches.length);
        this.sendMessage(data.buffer);
      }
    });
  }

  /**
   * 发送消息
   */
  private sendMessage(data: ArrayBuffer): void {
    try {
      this.sendData(data);
    } catch (error) {
      console.error('Failed to send input message:', error);
    }
  }

  /**
   * 归一化并量化无符号坐标 (0.0..1.0 -> 0..65536)
   */
  private normalizeAndQuantizeUnsigned(x: number, y: number): { x: number; y: number } {
    if (this.videoWidth === 0 || this.videoHeight === 0) {
      return { x: 0, y: 0 };
    }

    const normalizedX = x / this.videoElement.clientWidth;
    const normalizedY = y / this.videoElement.clientHeight;

    return {
      x: Math.floor(normalizedX * 65536),
      y: Math.floor(normalizedY * 65536),
    };
  }

  /**
   * 归一化并量化有符号坐标 (-1.0..1.0 -> -32767..32767)
   */
  private normalizeAndQuantizeSigned(x: number, y: number): { x: number; y: number } {
    if (this.videoWidth === 0 || this.videoHeight === 0) {
      return { x: 0, y: 0 };
    }

    const normalizedX = x / this.videoElement.clientWidth;
    const normalizedY = y / this.videoElement.clientHeight;

    return {
      x: Math.floor(normalizedX * 32767),
      y: Math.floor(normalizedY * 32767),
    };
  }

  /**
   * 获取键码
   */
  private getKeyCode(e: KeyboardEvent): number {
    // 特殊键处理
    if (e.keyCode === SpecialKeyCodes.Shift && e.location === 2) {
      return SpecialKeyCodes.RightShift;
    }
    if (e.keyCode === SpecialKeyCodes.Control && e.location === 2) {
      return SpecialKeyCodes.RightControl;
    }
    if (e.keyCode === SpecialKeyCodes.Alt && e.location === 2) {
      return SpecialKeyCodes.RightAlt;
    }
    return e.keyCode;
  }

  /**
   * 判断是否为浏览器快捷键
   */
  private isBrowserKey(keyCode: number): boolean {
    // F1-F12, Tab, etc.
    return (keyCode >= 112 && keyCode <= 123) || keyCode === 9;
  }

  /**
   * 发送 UI 交互消息
   */
  emitUIInteraction(descriptor: unknown): void {
    const descriptorStr = JSON.stringify(descriptor);
    const data = new DataView(new ArrayBuffer(1 + 2 + 2 * descriptorStr.length));
    let byteIdx = 0;
    data.setUint8(byteIdx, MessageType.UIInteraction);
    byteIdx++;
    data.setUint16(byteIdx, descriptorStr.length, true);
    byteIdx += 2;
    for (let i = 0; i < descriptorStr.length; i++) {
      data.setUint16(byteIdx, descriptorStr.charCodeAt(i), true);
      byteIdx += 2;
    }
    this.sendMessage(data.buffer);
  }

  /**
   * 发送命令消息
   */
  emitCommand(descriptor: unknown): void {
    const descriptorStr = JSON.stringify(descriptor);
    const data = new DataView(new ArrayBuffer(1 + 2 + 2 * descriptorStr.length));
    let byteIdx = 0;
    data.setUint8(byteIdx, MessageType.Command);
    byteIdx++;
    data.setUint16(byteIdx, descriptorStr.length, true);
    byteIdx += 2;
    for (let i = 0; i < descriptorStr.length; i++) {
      data.setUint16(byteIdx, descriptorStr.charCodeAt(i), true);
      byteIdx += 2;
    }
    this.sendMessage(data.buffer);
  }

  /**
   * 销毁
   */
  destroy(): void {
    // 移除所有事件监听器（通过替换元素的方式）
    this.pressedKeys.clear();
  }
}
