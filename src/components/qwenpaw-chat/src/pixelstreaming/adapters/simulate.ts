// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/adapters/simulate.ts

import { BaseAdapter } from './base';
import { PixelStreamingConfig, ConnectionStatus, MCPCommand } from '../types';

/**
 * Simulate 适配器（测试用）
 * 返回模拟响应，不实际连接
 */
export class SimulateAdapter extends BaseAdapter {
  private connected = false;
  private commandQueue: MCPCommand[] = [];

  constructor(config: PixelStreamingConfig) {
    super(config);
  }

  protected getAdapterName(): string {
    return 'SimulateAdapter';
  }

  async connect(): Promise<void> {
    this.logger.info('Connecting with SimulateAdapter (test mode)');

    // 模拟连接延迟
    await new Promise(resolve => setTimeout(resolve, 500));

    this.connected = true;
    this.logger.info('SimulateAdapter connected successfully');
    this.emitStatusChange(this.getConnectionStatus());
  }

  disconnect(): void {
    this.connected = false;
    this.commandQueue = [];
    this.logger.info('SimulateAdapter disconnected');
    this.emitStatusChange(this.getConnectionStatus());
  }

  async reconnect(): Promise<void> {
    this.disconnect();
    await this.connect();
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionStatus(): ConnectionStatus {
    return {
      pixelStreaming: this.connected,
      sse: this.connected,
    };
  }

  sendCommand(command: MCPCommand): boolean {
    if (!this.connected) {
      this.logger.warn('Cannot send command: not connected');
      return false;
    }

    this.logger.info('Simulating command:', command);

    // 记录命令到队列
    this.commandQueue.push(command);

    // 模拟延迟后返回响应
    setTimeout(() => {
      const response = JSON.stringify({
        commandId: command.commandId,
        result: {
          simulated: true,
          action: command.action_name,
          data: command.action_data,
        },
      });
      this.emitResponse(response);
      this.logger.debug('Simulated response sent');
    }, 100);

    return true;
  }

  /**
   * 获取已发送的命令队列（用于测试验证）
   */
  getCommandQueue(): MCPCommand[] {
    return [...this.commandQueue];
  }

  /**
   * 清空命令队列
   */
  clearCommandQueue(): void {
    this.commandQueue = [];
  }
}
