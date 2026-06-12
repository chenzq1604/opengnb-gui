/**
 * @name GNB 协议层 Index 节点连通性测试
 * @description 模拟 GNB 客户端向 Index 服务器发送 POST_ADDR 帧，
 *              等待 ECHO_ADDR 响应来确认服务器在线。
 *              按照 GNB 源码 gnb_index_frame_type.h 中的帧结构构造协议包，
 *              所有整数字段使用网络字节序（大端序）。
 */
import * as dgram from 'node:dgram';
import * as crypto from 'node:crypto';

/** GNB 协议消息类型 */
const GNB_PAYLOAD_TYPE_INDEX = 0x8;

/** Index 协议子类型 */
const GNB_INDEX_SUB_TYPE_POST_ADDR = 0x1;
const GNB_INDEX_SUB_TYPE_ECHO_ADDR = 0x2;

/** ed25519 签名长度 */
const ED25519_SIGN_SIZE = 64;

/** UUID 长度 */
const UUID_SIZE = 8;

/**
 * POST_ADDR 帧数据部分大小（packed struct，与 C 源码一致）
 * arg0(1) + arg1(1) + arg2(1) + arg3(1) = 4
 * src_key512(64) = 64
 * src_uuid64(8) = 8
 * src_ts_usec(8) = 8
 * wan6_addr(16) + wan6_port(2) = 18
 * wan4_addr(4) + wan4_port(2) = 6
 * node_random_sequence(32) = 32
 * node_random_sequence_sign(64) = 64
 * text(32) = 32
 * attachment(132) = 132
 * 合计 = 4+64+8+8+18+6+32+64+32+132 = 368
 */
const POST_ADDR_DATA_SIZE = 368;

/**
 * post_addr_frame_t 总大小 = data(368) + src_sign(64) + node_uuid64(8) = 440
 */
const POST_ADDR_FRAME_SIZE = POST_ADDR_DATA_SIZE + ED25519_SIGN_SIZE + UUID_SIZE;

/**
 * gnb_payload16_t 头部大小 = 4
 */
const GNB_PAYLOAD16_HEAD_SIZE = 4;

/**
 * 整个 UDP 包大小 = 4 + 440 = 444
 */
const TOTAL_PACKET_SIZE = GNB_PAYLOAD16_HEAD_SIZE + POST_ADDR_FRAME_SIZE;

/** 测试结果 */
export interface PingResult {
  success: boolean;
  latency: number;
  message: string;
}

/**
 * 构造 GNB POST_ADDR 帧并发送到 Index 服务器
 * 模拟 GNB 客户端注册行为，等待 ECHO_ADDR 响应确认服务器在线
 * 帧格式严格按照 GNB 源码 gnb_index_frame_type.h 定义，
 * 所有整数字段使用网络字节序（大端序），与 gnb_payload16_set_data_len 中的 htons 一致
 * @param address Index 服务器地址
 * @param port Index 服务器端口
 * @param timeout 超时时间（毫秒）
 * @returns 测试结果
 */
export function pingIndexServer(address: string, port: number, timeout: number = 5000): Promise<PingResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let resolved = false;

    try {
      // 1. 生成临时 ed25519 密钥对
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
      const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
      // DER 格式的 ed25519 公钥，最后 32 字节是原始公钥
      const rawPublicKey = publicKeyDer.slice(-32);

      // 2. 生成随机 UUID（8字节）
      const srcUuid = crypto.randomBytes(UUID_SIZE);

      // 3. 生成随机序列并签名
      const randomSequence = crypto.randomBytes(32);
      const randomSequenceSign = crypto.sign(null, randomSequence, privateKey);

      // 4. 构造完整 UDP 数据包（444 字节）
      const packet = Buffer.alloc(TOTAL_PACKET_SIZE);
      let offset = 0;

      // ===== gnb_payload16_t 头部（4字节）=====
      // size = htons(4 + 440) = htons(444)，网络字节序（大端）
      packet.writeUInt16BE(TOTAL_PACKET_SIZE, offset); offset += 2;
      // type = 0x08 (GNB_PAYLOAD_TYPE_INDEX)
      packet.writeUInt8(GNB_PAYLOAD_TYPE_INDEX, offset); offset += 1;
      // sub_type = 0x01 (PAYLOAD_SUB_TYPE_POST_ADDR)
      packet.writeUInt8(GNB_INDEX_SUB_TYPE_POST_ADDR, offset); offset += 1;

      // ===== post_addr_frame_t.data（368字节）=====

      // arg0 = 'p' (0x70)
      packet.writeUInt8(0x70, offset); offset += 1;
      // arg1 = 'a' (0x61)
      packet.writeUInt8(0x61, offset); offset += 1;
      // arg2, arg3 = 0
      packet.writeUInt8(0, offset); offset += 1;
      packet.writeUInt8(0, offset); offset += 1;

      // src_key512 (64 bytes) - 前32字节为公钥，后32字节填充随机数（确保每次不同避免频率限制）
      rawPublicKey.copy(packet, offset); offset += 32;
      crypto.randomBytes(32).copy(packet, offset); offset += 32;

      // src_uuid64 (8 bytes) - 网络字节序（大端）
      srcUuid.copy(packet, offset); offset += 8;

      // src_ts_usec (8 bytes) - 微秒级时间戳，网络字节序（大端）
      const tsUsec = BigInt(Date.now()) * 1000n;
      packet.writeBigUInt64BE(tsUsec, offset); offset += 8;

      // wan6_addr (16 bytes) - 全0
      offset += 16;
      // wan6_port (2 bytes) - 0，网络字节序
      packet.writeUInt16BE(0, offset); offset += 2;
      // wan4_addr (4 bytes) - 全0
      offset += 4;
      // wan4_port (2 bytes) - 0，网络字节序
      packet.writeUInt16BE(0, offset); offset += 2;

      // node_random_sequence (32 bytes)
      randomSequence.copy(packet, offset); offset += 32;
      // node_random_sequence_sign (64 bytes)
      randomSequenceSign.copy(packet, offset); offset += 64;

      // text (32 bytes) - 全0
      offset += 32;
      // attachment (132 bytes) - 全0
      offset += 132;

      // ===== post_addr_frame_t 尾部 =====

      // src_sign (64 bytes) - ed25519 签名（服务端不验证，但填充以保持帧完整）
      const srcSign = crypto.sign(null, packet.slice(GNB_PAYLOAD16_HEAD_SIZE, GNB_PAYLOAD16_HEAD_SIZE + POST_ADDR_DATA_SIZE), privateKey);
      srcSign.copy(packet, offset); offset += ED25519_SIGN_SIZE;

      // node_uuid64 (8 bytes) - 与 src_uuid64 相同
      srcUuid.copy(packet, offset); offset += UUID_SIZE;

      // 5. 通过 UDP 发送并等待响应
      const socket = dgram.createSocket('udp4');

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.close();
          resolve({ success: false, latency: -1, message: '连接超时' });
        }
      }, timeout);

      socket.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          socket.close();
          resolve({ success: false, latency: -1, message: `连接失败: ${err.message}` });
        }
      });

      socket.on('message', (msg) => {
        if (!resolved && msg.length >= 4) {
          const msgType = msg.readUInt8(2);
          const msgSubType = msg.readUInt8(3);
          // 收到 Index 协议的任何响应都说明服务器在线
          if (msgType === GNB_PAYLOAD_TYPE_INDEX) {
            resolved = true;
            clearTimeout(timer);
            const latency = Date.now() - startTime;
            socket.close();
            resolve({ success: true, latency, message: `在线 (${latency}ms)` });
          }
        }
      });

      socket.send(packet, port, address, (err) => {
        if (err && !resolved) {
          resolved = true;
          clearTimeout(timer);
          socket.close();
          resolve({ success: false, latency: -1, message: `发送失败: ${err.message}` });
        }
      });

    } catch (err: any) {
      resolve({ success: false, latency: -1, message: `异常: ${err.message}` });
    }
  });
}

/**
 * 批量测试 Index 节点连通性（并发）
 * @param nodeList 节点列表
 * @param timeout 单个节点超时时间（毫秒）
 * @returns 以 "address:port" 为 key 的测试结果映射
 */
export async function pingAllIndexServers(
  nodeList: Array<{ address: string; port: number }>,
  timeout: number = 5000
): Promise<Record<string, PingResult>> {
  const results: Record<string, PingResult> = {};
  const promises = nodeList.map(async (node) => {
    const key = `${node.address}:${node.port}`;
    results[key] = await pingIndexServer(node.address, node.port, timeout);
  });
  await Promise.all(promises);
  return results;
}
