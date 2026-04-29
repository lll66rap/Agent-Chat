// E:/Git/claude/chat/src/components/qwenpaw-chat/src/pixelstreaming/version-detect.ts

import { UEVersion } from './types';
import { createLogger } from './utils/logger';
import { TIMEOUTS, PROTOCOL } from './constants';

const logger = createLogger('VersionDetector');

/**
 * 检测结果
 */
export interface DetectionResult {
  version: UEVersion;
  protocolVersion: string;
  method: 'websocket' | 'fallback';
}

/**
 * 检测 UE 版本
 * 只使用 WebSocket 方式检测（避免 CORS 问题）
 * 返回版本：'5.5' (UE5.5+), '5.0' (UE5.0-5.4), '4.26' (UE4.26+)
 *
 * ========== UE 版本与协议版本对照表 ==========
 *
 * | UE 版本      | 协议版本   | majorProtocolVersion | 消息特征                    |
 * |-------------|-----------|---------------------|---------------------------|
 * | UE 4.26     | 1.0       | 无                  | config + peerConnectionOptions, 2条消息后关闭 |
 * | UE 5.0-5.2  | 无/1.x    | 无                  | config + playerCount + streamerList |
 * | UE 5.3-5.4  | 1.3       | 1                   | streamerList (有 id)        |
 * | UE 5.5+     | 1.3.0+    | 2+                  | streamerList (有 id)        |
 *
 * 关键区分点：
 * - protocolVersion 三段式 (如 "1.3.0") = UE 5.5+
 * - majorProtocolVersion >= 2 = UE 5.5+
 * - 收到 2 条消息后连接关闭 = UE 4.x
 * - 其他情况 = UE 5.0-5.4
 *
 * 检测顺序：
 * 1. majorProtocolVersion >= 2 → UE 5.5+
 * 2. protocolVersion 三段式 (如 "1.3.0") → UE 5.5+
 * 3. streamerList + id → UE 5.0+
 * 4. config + peerConnectionOptions + protocolVersion 两段式 1.x → UE 4.x
 * 5. 收到 3+ 条消息 → UE 5.0+
 * 6. 收到 2 条消息后连接关闭 → UE 4.x
 * 7. 超时 → 默认 UE 5.0+
 */
export async function detectUEVersion(signallingUrl: string): Promise<DetectionResult> {
  logger.info(`Detecting UE version from: ${signallingUrl}`);

  // 如果没有信令 URL，直接返回默认值
  if (!signallingUrl) {
    logger.warn('No signalling URL provided, using default version (UE 5.0+)');
    return {
      version: '5.0',
      protocolVersion: '3.5',
      method: 'fallback',
    };
  }

  try {
    // 通过 WebSocket 握手检测（WebSocket 不受 CORS 限制）
    const wsResult = await detectViaWebSocket(signallingUrl);
    if (wsResult) {
      logger.info(`Version detected via WebSocket: ${wsResult.version}`);
      return wsResult;
    }
  } catch (error) {
    logger.warn('WebSocket detection failed', error);
  }

  // 默认回退到 UE 5.0+
  logger.warn('Version detection failed, using default (UE 5.0+)');
  return {
    version: '5.0',
    protocolVersion: '3.5',
    method: 'fallback',
  };
}

/**
 * 通过 WebSocket 握手检测版本
 */
async function detectViaWebSocket(signallingUrl: string): Promise<DetectionResult | null> {
  return new Promise((resolve) => {
    let resolved = false;
    let messageCount = 0;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        logger.warn('Version detection timeout, defaulting to UE 5.0+');
        resolve({
          version: '5.0',
          protocolVersion: PROTOCOL.DEFAULT_VERSION,
          method: 'websocket',
        });
      }
    }, TIMEOUTS.VERSION_DETECT);

    let ws: WebSocket;
    try {
      ws = new WebSocket(signallingUrl);
    } catch (error) {
      clearTimeout(timeout);
      resolve(null);
      return;
    }

    ws.onopen = () => {
      if (resolved) {
        ws.close();
        return;
      }
      logger.debug('WebSocket connected for version detection');

      // 主动发送消息触发服务器响应差异
      // UE 5.x 支持 listStreamers，UE 4.x 可能不支持
      try {
        const listStreamersMsg = JSON.stringify({ type: 'listStreamers' });
        logger.info(`Sending listStreamers message to probe version...`);
        ws.send(listStreamersMsg);
      } catch (e) {
        logger.debug('Failed to send listStreamers message', e);
      }
    };

    ws.onmessage = (event) => {
      if (resolved) return;
      messageCount++;

      try {
        const data = JSON.parse(event.data);
        // 使用 debug 级别记录收到的消息
        logger.debug(`Received message #${messageCount}:`, JSON.stringify(data, null, 2));

        // 获取协议版本字段
        const majorProtocolVersion = data.majorProtocolVersion;
        const minorProtocolVersion = data.minorProtocolVersion;
        const protocolVersion = data.protocolVersion || data.protocol_version || data.ProtocolVersion;

        // ========== 版本检测条件对比（调试日志） ==========
        logger.debug('--- Version Detection Conditions ---');
        logger.debug(`  majorProtocolVersion: ${majorProtocolVersion} (type: ${typeof majorProtocolVersion})`);
        logger.debug(`  minorProtocolVersion: ${minorProtocolVersion}`);
        logger.debug(`  protocolVersion: ${protocolVersion}`);
        logger.debug(`  data.type: ${data.type}`);
        logger.debug(`  data.id: ${data.id}`);
        logger.debug(`  data.peerConnectionOptions: ${data.peerConnectionOptions !== undefined ? 'present' : 'absent'}`);
        logger.debug(`  data.compat: ${data.compat !== undefined ? 'present' : 'absent'}`);
        logger.debug('-------------------------------------');

        // ========== 核心版本检测逻辑 ==========

        // 1. 检查 majorProtocolVersion（UE 5.5+ 可靠）
        if (majorProtocolVersion !== undefined && majorProtocolVersion !== null) {
          const major = parseInt(String(majorProtocolVersion)) || 0;
          logger.debug(`[Check 1] majorProtocolVersion check: major=${major}, >=2 ? ${major >= 2}`);
          // UE 5.5+ 使用 majorProtocolVersion >= 2
          // UE 4.x 和早期 UE 5.x 使用 majorProtocolVersion = 1 或没有这个字段
          if (major >= 2) {
            logger.info(`Version detected: UE 5.5+ (majorProtocolVersion >= 2)`);
            resolved = true;
            clearTimeout(timeout);
            ws.close();
            resolve({
              version: '5.5',
              protocolVersion: `${majorProtocolVersion}.${minorProtocolVersion || 0}`,
              method: 'websocket',
            });
            return;
          }
        } else {
          logger.debug('[Check 1] majorProtocolVersion is undefined/null, skipping');
        }

        // 2. 检查消息类型 - UE 5.x 特有的消息
        logger.debug(`[Check 2] streamerList check: type=${data.type}, hasId=${data.id !== undefined}`);
        if (data.type === 'streamerList') {
          // UE 5.x 会响应 listStreamers 并返回 streamerList
          // UE 4.x 不会响应这个消息
          logger.info('Version detected: UE 5.0+ (streamerList response)');
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve({
            version: '5.0',
            protocolVersion: protocolVersion || '2.0',
            method: 'websocket',
          });
          return;
        }

        // 3. 检查 UE 4.x / UE 5.x 特有的消息格式
        logger.debug(`[Check 3] config check: type=${data.type}, hasPeerConnectionOptions=${data.peerConnectionOptions !== undefined}`);
        if (data.type === 'config' && data.peerConnectionOptions !== undefined) {
          // 检查是否是 UE 5.5+（通过 protocolVersion 格式判断）
          // UE 5.5+ 使用三段式版本号如 "1.3.0"
          if (protocolVersion !== undefined) {
            const parts = String(protocolVersion).split('.');
            logger.debug(`[Check 3] protocolVersion parts: ${parts.length} (${parts.join('.')})`);
            // 三段式版本号 = UE 5.5+
            if (parts.length >= 3) {
              logger.info(`Version detected: UE 5.5+ (protocolVersion: ${protocolVersion})`);
              resolved = true;
              clearTimeout(timeout);
              ws.close();
              resolve({
                version: '5.5',
                protocolVersion: String(protocolVersion),
                method: 'websocket',
              });
              return;
            }
            // 两段式版本号 1.x = UE 4.x
            const major = parseInt(parts[0]) || 0;
            if (major === 1 && parts.length === 2) {
              logger.info(`Version detected: UE 4.x (protocolVersion: ${protocolVersion})`);
              resolved = true;
              clearTimeout(timeout);
              ws.close();
              resolve({
                version: '4.26',
                protocolVersion: String(protocolVersion),
                method: 'websocket',
              });
              return;
            }
          }

          // 没有 protocolVersion，等待更多消息（可能是 UE 5.0-5.4 或 UE 4.x）
          logger.debug('[Check 3] config without clear protocolVersion, waiting for more messages');
        }

        // 4. 检查 electus-streamer-list（UE 5.0-5.1 特有）
        logger.debug(`[Check 4] electus-streamer-list check: type=${data.type}`);
        if (data.type === 'electus-streamer-list') {
          logger.info('Version detected: UE 5.0+ (electus-streamer-list)');
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve({
            version: '5.0',
            protocolVersion: '2.0',
            method: 'websocket',
          });
          return;
        }

        // 5. 检查 compat 字段（UE 5.0-5.1 特有）
        logger.debug(`[Check 5] compat check: ${data.compat !== undefined || data.Compat !== undefined}`);
        if (data.compat !== undefined || data.Compat !== undefined) {
          logger.info('Version detected: UE 5.0+ (compat field)');
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve({
            version: '5.0',
            protocolVersion: '2.0',
            method: 'websocket',
          });
          return;
        }

        // 6. 如果有 majorProtocolVersion = 1，需要更多上下文
        logger.debug(`[Check 6] majorProtocolVersion=1 check: ${majorProtocolVersion === 1}`);
        if (majorProtocolVersion === 1) {
          // 如果同时有 streamerList 或其他 UE 5.x 特征，判断为 UE 5.x
          if (data.type === 'streamerList' || data.type === 'playerCount') {
            logger.info('Version detected: UE 5.0+ (majorProtocolVersion=1 with UE 5.x message)');
            resolved = true;
            clearTimeout(timeout);
            ws.close();
            resolve({
              version: '5.0',
              protocolVersion: `1.${minorProtocolVersion || 0}`,
              method: 'websocket',
            });
            return;
          }
        }

        // 7. 检查 protocolVersion 字段
        logger.debug(`[Check 7] protocolVersion check: ${protocolVersion}`);
        if (protocolVersion !== undefined && protocolVersion !== null) {
          const parts = String(protocolVersion).split('.');
          const major = parseInt(parts[0]) || 0;

          logger.debug(`[Check 7] protocolVersion major=${major}, >=2 ? ${major >= 2}`);
          if (major >= 2) {
            logger.info(`Version detected: UE 5.0+ (protocolVersion: ${protocolVersion})`);
            resolved = true;
            clearTimeout(timeout);
            ws.close();
            resolve({
              version: '5.0',
              protocolVersion: String(protocolVersion),
              method: 'websocket',
            });
            return;
          }
        }

        // 8. 收到足够多的消息后，根据消息类型判断
        // 注意：UE 4.x 和 UE 5.0 都会发送 config + playerCount
        // 但 UE 5.x 会继续发送 streamerList，UE 4.x 不会
        // 所以不要急于判断，等待更多消息或连接关闭
        logger.debug(`[Check 8] message count check: ${messageCount}`);
        if (messageCount >= 3 && !resolved) {
          // 收到 3+ 条消息，说明连接保持活跃，很可能是 UE 5.x
          logger.info(`Version detected: UE 5.0+ (${messageCount} messages received)`);
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve({
            version: '5.0',
            protocolVersion: PROTOCOL.DEFAULT_VERSION,
            method: 'websocket',
          });
        } else if (messageCount === 2 && !resolved) {
          // 只收到 2 条消息，等待连接关闭来区分 UE 4.x 和 UE 5.x
          logger.debug('Received 2 messages, waiting for connection close or more messages...');
        }

      } catch (error) {
        logger.error('Failed to parse WebSocket message', error);
      }
    };

    ws.onerror = (error) => {
      logger.debug('WebSocket error during version detection', error);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(null);
      }
    };

    ws.onclose = (event) => {
      logger.debug(`WebSocket closed: code=${event.code}, reason=${event.reason}, messages received=${messageCount}`);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);

        // 关闭码 1008 + "Unsupported message type" = UE 4.x 不支持 listStreamers
        if (event.code === 1008 && event.reason?.includes('Unsupported')) {
          logger.info('Version detected: UE 4.26 (server rejected listStreamers)');
          resolve({
            version: '4.26',
            protocolVersion: '1.0',
            method: 'websocket',
          });
        } else if (event.code === 1008) {
          // 其他 1008 错误，默认 UE 5.0+
          logger.warn('Connection rejected (1008) - defaulting to UE 5.0+');
          resolve({
            version: '5.0',
            protocolVersion: PROTOCOL.DEFAULT_VERSION,
            method: 'websocket',
          });
        } else if ((event.code === 1000 || event.code === 1001) && messageCount <= 2) {
          // 连接正常关闭但只收到少量消息 - UE 4.x 的行为
          logger.info('Version detected: UE 4.26 (connection closed early)');
          resolve({
            version: '4.26',
            protocolVersion: '1.0',
            method: 'websocket',
          });
        } else {
          resolve(null);
        }
      }
    };
  });
}
