/**
 * @name Index 节点统一管理服务
 * @description 提供 Index 节点的统一数据源、测试、事件订阅能力
 *   - 预置公共 Index 节点（PUBLIC_INDEX_NODES）始终可用
 *   - 用户自定义 Index 节点存储在 localStorage
 *   - 测试结果（在线/离线/延迟）也存储在 localStorage
 *   - 提供订阅机制，让其他页面（Lite 配置）实时同步变化
 */
import { PUBLIC_INDEX_NODES } from '@/constants';
import { indexNodeService } from '@/services/gnb';

/** Index 节点信息 */
export interface IndexNode {
  id: string;
  name: string;
  address: string;
  port: number;
  /** 是否为预置公共节点 */
  isPreset: boolean;
  /** 是否为本地 Index 服务 */
  isLocal: boolean;
  /** 节点状态 */
  status: 'online' | 'offline' | 'unknown' | 'testing';
  /** 延迟（毫秒），-1 表示超时 */
  latency?: number;
  /** 状态信息 */
  statusMessage?: string;
  /** 最后测试时间 */
  lastTestedAt?: number;
}

const STORAGE_KEY = 'opengnb-index-nodes';
const STORAGE_VERSION = 1;
const STORAGE_VERSION_KEY = 'opengnb-index-nodes-version';

/** 存储格式（含版本号） */
interface StorageData {
  version: number;
  /** 用户自定义的 Index 节点 */
  customNodes: IndexNode[];
}

/**
 * @name 从 localStorage 读取数据
 */
function readStorage(): StorageData {
  try {
    const version = localStorage.getItem(STORAGE_VERSION_KEY);
    if (version !== String(STORAGE_VERSION)) {
      return { version: STORAGE_VERSION, customNodes: [] };
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { version: STORAGE_VERSION, customNodes: [] };
    }
    const data = JSON.parse(raw) as StorageData;
    return {
      version: STORAGE_VERSION,
      customNodes: Array.isArray(data.customNodes) ? data.customNodes : [],
    };
  } catch {
    return { version: STORAGE_VERSION, customNodes: [] };
  }
}

/**
 * @name 写入 localStorage
 */
function writeStorage(data: StorageData): void {
  localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * @name 生成节点 ID
 */
function genId(): string {
  return `custom-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * @name Index 节点统一管理服务
 */
class IndexNodeManager {
  /** 预置节点（不可变） */
  private presetNodes: IndexNode[] = PUBLIC_INDEX_NODES.map((node, idx) => ({
    id: `preset-${idx + 1}`,
    name: node.name,
    address: node.address,
    port: node.port,
    isPreset: true,
    isLocal: false,
    status: 'unknown' as const,
  }));

  /** 预置节点状态缓存（不持久化到 localStorage） */
  private presetStatusMap: Map<string, { status: IndexNode['status']; latency?: number; message?: string }> = new Map();

  /** 订阅者列表 */
  private subscribers: Set<() => void> = new Set();

  /**
   * @name 获取所有 Index 节点（含运行时状态）
   */
  getAllWithStatus(): IndexNode[] {
    const custom = readStorage().customNodes;
    return [
      ...this.presetNodes.map((n) => {
        const s = this.presetStatusMap.get(n.id);
        return s ? { ...n, status: s.status, latency: s.latency, statusMessage: s.message } : n;
      }),
      ...custom,
    ];
  }

  /**
   * @name 添加自定义 Index 节点
   */
  add(node: Omit<IndexNode, 'id' | 'isPreset' | 'isLocal' | 'status'>): IndexNode {
    const newNode: IndexNode = {
      ...node,
      id: genId(),
      isPreset: false,
      isLocal: false,
      status: 'unknown',
    };
    const data = readStorage();
    data.customNodes.push(newNode);
    writeStorage(data);
    this.notify();
    return newNode;
  }

  /**
   * @name 删除自定义 Index 节点
   */
  remove(id: string): boolean {
    const data = readStorage();
    const idx = data.customNodes.findIndex((n) => n.id === id);
    if (idx < 0) return false;
    data.customNodes.splice(idx, 1);
    writeStorage(data);
    this.notify();
    return true;
  }

  /**
   * @name 更新自定义节点状态
   */
  private updateCustomStatus(id: string, status: IndexNode['status'], latency?: number, message?: string): void {
    const data = readStorage();
    const node = data.customNodes.find((n) => n.id === id);
    if (!node) return;
    node.status = status;
    node.latency = latency;
    node.statusMessage = message;
    node.lastTestedAt = Date.now();
    writeStorage(data);
  }

  /**
   * @name 测试单个 Index 节点连通性
   */
  async testOne(node: IndexNode): Promise<{ success: boolean; latency: number; message: string }> {
    if (node.isPreset) {
      this.presetStatusMap.set(node.id, { status: 'testing' });
      this.notify();
    } else {
      this.updateCustomStatus(node.id, 'testing');
      this.notify();
    }
    try {
      const result = await indexNodeService.ping(node.address, node.port);
      if (node.isPreset) {
        this.presetStatusMap.set(node.id, {
          status: result.success ? 'online' : 'offline',
          latency: result.latency,
          message: result.message,
        });
      } else {
        this.updateCustomStatus(node.id, result.success ? 'online' : 'offline', result.latency, result.message);
      }
      this.notify();
      return result;
    } catch (err: any) {
      if (node.isPreset) {
        this.presetStatusMap.set(node.id, { status: 'offline', message: err.message });
      } else {
        this.updateCustomStatus(node.id, 'offline', -1, err.message);
      }
      this.notify();
      return { success: false, latency: -1, message: err.message };
    }
  }

  /**
   * @name 批量测试所有 Index 节点
   */
  async testAll(): Promise<Record<string, { success: boolean; latency: number; message: string }>> {
    const all = this.getAllWithStatus();
    // 先标记所有为 testing
    all.forEach((n) => {
      if (n.isPreset) {
        this.presetStatusMap.set(n.id, { status: 'testing' });
      } else {
        this.updateCustomStatus(n.id, 'testing');
      }
    });
    this.notify();

    const nodeList = all.map((n) => ({ address: n.address, port: n.port }));
    const results = await indexNodeService.pingAll(nodeList);

    Object.entries(results).forEach(([key, result]) => {
      const node = all.find((n) => `${n.address}:${n.port}` === key);
      if (!node) return;
      if (node.isPreset) {
        this.presetStatusMap.set(node.id, {
          status: result.success ? 'online' : 'offline',
          latency: result.latency,
          message: result.message,
        });
      } else {
        this.updateCustomStatus(node.id, result.success ? 'online' : 'offline', result.latency, result.message);
      }
    });
    this.notify();
    return results;
  }

  /**
   * @name 订阅变化
   * @returns 取消订阅的函数
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * @name 通知所有订阅者
   */
  private notify(): void {
    this.subscribers.forEach((cb) => cb());
  }
}

export const indexNodeManager = new IndexNodeManager();
