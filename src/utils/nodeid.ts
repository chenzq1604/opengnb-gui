/**
 * @name nodeid 工具函数
 * @description 提供 nodeid 的校验、规范化、比较等功能
 *   OpenGNB 源码（gnb_argv.c, gnb_conf_file.c）使用 strtoull(..., 10) 和 sscanf %llu
 *   解析 nodeid，因此：
 *   - 仅接受十进制数字（0-9）
 *   - 范围 0 ~ 18446744073709551615 (2^64-1)
 *   - 前导零被忽略（"00001" 和 "1" 是同一个）
 *   - 不接受负数、字母、十六进制
 *
 *   GUI 业务限制：
 *   - 长度 4-10 位数字
 *   - 不能有前导 0
 *   - 不能全 0
 */

const MAX_NODE_ID = BigInt('18446744073709551615'); // 2^64 - 1
const MIN_DIGITS = 4;  // 最短 4 位
const MAX_DIGITS = 10; // 最长 10 位

export interface NodeIdValidationResult {
  valid: boolean;
  normalized?: string;
  message?: string;
}

/**
 * @name 规范化 nodeid 字符串
 * @description 去除前导零，返回纯数字字符串
 * @param input 用户输入
 * @returns 规范化后的字符串（如 "00001" -> "1"）
 */
export function normalizeNodeId(input: string | number | undefined | null): string {
  if (input === null || input === undefined) return '';
  const s = String(input).trim();
  if (s === '') return '';
  // 去掉前导零
  const stripped = s.replace(/^0+(\d)/, '$1');
  return stripped;
}

/**
 * @name 校验 nodeid 字符串
 * @description 校验用户输入的 nodeid 是否合法（4-10 位数字，无前导 0）
 * @param input 用户输入
 * @returns 校验结果
 */
export function validateNodeId(input: string | number | undefined | null): NodeIdValidationResult {
  if (input === null || input === undefined || input === '') {
    return { valid: false, message: '请输入节点 ID' };
  }
  const s = String(input).trim();
  if (s === '') {
    return { valid: false, message: '请输入节点 ID' };
  }
  // 只接受数字字符
  if (!/^\d+$/.test(s)) {
    return { valid: false, message: '节点 ID 只能包含数字（0-9），不能含字母或特殊字符' };
  }
  // 长度限制 4-10 位
  if (s.length < MIN_DIGITS) {
    return { valid: false, message: `节点 ID 至少需要 ${MIN_DIGITS} 位数字` };
  }
  if (s.length > MAX_DIGITS) {
    return { valid: false, message: `节点 ID 最多 ${MAX_DIGITS} 位数字` };
  }
  // 不能有前导 0
  if (s[0] === '0') {
    return { valid: false, message: '节点 ID 不能以 0 开头（如 "00001" 与 "1" 在系统中是同一个 ID）' };
  }
  // 不能全 0（已在前面拦掉，但保险起见）
  if (/^0+$/.test(s)) {
    return { valid: false, message: '节点 ID 不能为 0' };
  }
  // 范围限制
  try {
    const value = BigInt(s);
    if (value < BigInt(0) || value > MAX_NODE_ID) {
      return { valid: false, message: `节点 ID 范围应为 0 ~ ${MAX_NODE_ID.toString()}` };
    }
  } catch {
    return { valid: false, message: '节点 ID 格式错误' };
  }
  return { valid: true, normalized: s };
}

/**
 * @name 比较两个 nodeid 是否相同（规范化后比较）
 * @description "00001" 和 "1" 视为相同
 */
export function isSameNodeId(a: string, b: string): boolean {
  return normalizeNodeId(a) === normalizeNodeId(b);
}

/**
 * @name 在 nodeid 列表中检测冲突
 * @param nodeId 待检查的 nodeid
 * @param existing 已有的 nodeid 列表
 * @returns 冲突的 nodeid，没有则返回 null
 */
export function findNodeIdConflict(nodeId: string, existing: string[]): string | null {
  const target = normalizeNodeId(nodeId);
  if (!target) return null;
  for (const item of existing) {
    if (normalizeNodeId(item) === target) {
      return item;
    }
  }
  return null;
}

/**
 * @name 安全地将 nodeid 转为数字（用于前导零比较场景）
 */
export function nodeIdToNumber(nodeId: string): number {
  const normalized = normalizeNodeId(nodeId);
  if (!normalized) return 0;
  return Number(normalized);
}
