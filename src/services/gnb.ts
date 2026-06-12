/**
 * @name GNB 服务层
 * @description 封装 Electron IPC 调用，提供渲染进程使用的 API
 *              在非 Electron 环境下提供 mock 数据用于开发调试
 */
import type {
  NodeStatus,
  NodeStartOptions,
  KeyInfo,
  OperationResult,
  ConfigReadResult,
  ConfigDirsResult,
  KeyListResult,
  KeyGenerateResult,
  SelectPathResult,
  QuickStartHistory,
  SafeConfigSummary,
  SafeConfigDetail,
  SafeConfigListResult,
  SafeConfigDetailResult,
  SafeConfigCreateResult,
  SaveSafeConfigData,
  NodeConfData,
} from '@/typings';

/** 是否在 Electron 环境中运行 */
const isElectron = typeof window !== 'undefined' && window.electronAPI;

/**
 * @name GNB 进程管理服务
 */
export const gnbService = {
  /** 启动节点 */
  async start(options: NodeStartOptions): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.gnb.start(options);
    }
    // Mock 数据
    console.log('[Mock] gnb.start', options);
    return { success: true, message: `节点 ${options.nodeId} 启动成功 (Mock)` };
  },

  /** 停止节点 */
  async stop(nodeId: string): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.gnb.stop(nodeId);
    }
    console.log('[Mock] gnb.stop', nodeId);
    return { success: true, message: `节点 ${nodeId} 已停止 (Mock)` };
  },

  /** 重启节点 */
  async restart(nodeId: string): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.gnb.restart(nodeId);
    }
    console.log('[Mock] gnb.restart', nodeId);
    return { success: true, message: `节点 ${nodeId} 已重启 (Mock)` };
  },

  /** 获取节点状态 */
  async getStatus(nodeId: string): Promise<NodeStatus | null> {
    if (isElectron) {
      return window.electronAPI.gnb.getStatus(nodeId);
    }
    return { nodeId, running: false, mode: 'lite' };
  },

  /** 获取所有节点状态 */
  async getAllStatus(): Promise<NodeStatus[]> {
    if (isElectron) {
      return window.electronAPI.gnb.getAllStatus();
    }
    return [
      { nodeId: '1001', running: true, pid: 12345, startTime: Date.now() - 3600000, mode: 'lite' },
      { nodeId: '1002', running: false, mode: 'safe' },
    ];
  },

  /** 删除节点 */
  async remove(nodeId: string): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.gnb.remove(nodeId);
    }
    console.log('[Mock] gnb.remove', nodeId);
    return { success: true, message: `节点 ${nodeId} 已删除 (Mock)` };
  },
};

/**
 * @name 配置管理服务
 */
export const configService = {
  /** 读取配置文件 */
  async read(configPath: string): Promise<ConfigReadResult> {
    if (isElectron) {
      return window.electronAPI.config.read(configPath);
    }
    return { success: true, content: '# 示例配置\nnodeid=1001\n', message: '读取成功 (Mock)' };
  },

  /** 写入配置文件 */
  async write(configPath: string, content: string): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.config.write(configPath, content);
    }
    console.log('[Mock] config.write', configPath, content);
    return { success: true, message: '写入成功 (Mock)' };
  },

  /** 获取配置目录列表 */
  async listDirs(): Promise<ConfigDirsResult> {
    if (isElectron) {
      return window.electronAPI.config.listDirs();
    }
    return { success: true, dirs: ['node_1001', 'node_1002'], message: '获取成功 (Mock)' };
  },

  /** 创建配置目录 */
  async createDir(dirName: string): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.config.createDir(dirName);
    }
    return { success: true, message: `目录 ${dirName} 已创建 (Mock)` };
  },

  /** 删除配置目录 */
  async deleteDir(dirName: string): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.config.deleteDir(dirName);
    }
    return { success: true, message: `目录 ${dirName} 已删除 (Mock)` };
  },
};

/**
 * @name 密钥管理服务
 */
export const cryptoService = {
  /** 生成密钥对 */
  async generateKey(outputDir: string): Promise<KeyGenerateResult> {
    if (isElectron) {
      return window.electronAPI.crypto.generateKey(outputDir);
    }
    return { success: true, message: '密钥生成成功 (Mock)', keys: ['public.key', 'private.key'] };
  },

  /** 获取密钥列表 */
  async listKeys(dir: string): Promise<KeyListResult> {
    if (isElectron) {
      return window.electronAPI.crypto.listKeys(dir);
    }
    return {
      success: true,
      keys: [
        { name: 'public.key', path: '/keys/public.key', type: 'public', size: 64, modifiedTime: new Date().toISOString() },
        { name: 'private.key', path: '/keys/private.key', type: 'private', size: 128, modifiedTime: new Date().toISOString() },
      ],
      message: '获取成功 (Mock)',
    };
  },

  /** 导入公钥 */
  async importPublicKey(srcPath: string, destDir: string): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.crypto.importPublicKey(srcPath, destDir);
    }
    return { success: true, message: '公钥已导入 (Mock)' };
  },

  /** 导出公钥 */
  async exportPublicKey(keyPath: string, destPath: string): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.crypto.exportPublicKey(keyPath, destPath);
    }
    return { success: true, message: '公钥已导出 (Mock)' };
  },
};

/**
 * @name 应用设置服务
 */
export const appService = {
  /** 获取应用版本 */
  async getVersion(): Promise<string> {
    if (isElectron) {
      return window.electronAPI.app.getVersion();
    }
    return '1.0.0-dev';
  },

  /** 获取 GNB 二进制路径 */
  async getGnbBinPath(): Promise<string> {
    if (isElectron) {
      return window.electronAPI.app.getGnbBinPath();
    }
    return 'D:\\gnb\\bin\\gnb.exe';
  },

  /** 设置 GNB 二进制路径 */
  async setGnbBinPath(binPath: string): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.app.setGnbBinPath(binPath);
    }
    return { success: true, message: '路径已更新 (Mock)' };
  },

  /** 获取系统设置（穿透策略等） */
  async getSettings(): Promise<Record<string, any>> {
    if (isElectron) {
      return window.electronAPI.app.getSettings();
    }
    // 浏览器环境返回 Mock（保留默认）
    return {
      networkDriver: 'wintun',
      mtu: 1400,
      encryption: 'aes256',
      upnp: true,
      autoStart: false,
      logLevel: 'info',
      extremeNatTraversal: false,
      safeIndex: false,
      portDetect: true,
      multiSocket: true,
    };
  },

  /** 保存系统设置 */
  async setSettings(settings: Record<string, any>): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.app.setSettings(settings);
    }
    return { success: true, message: '设置已保存 (Mock)' };
  },

  /** 打开目录选择对话框 */
  async selectDirectory(): Promise<SelectPathResult> {
    if (isElectron) {
      return window.electronAPI.app.selectDirectory();
    }
    return { success: true, message: '选择成功 (Mock)', path: 'D:\\gnb\\bin' };
  },

  /** 打开文件选择对话框 */
  async selectFile(options?: { title?: string; filters?: { name: string; extensions: string[] }[] }): Promise<SelectPathResult> {
    if (isElectron) {
      return window.electronAPI.app.selectFile(options);
    }
    return { success: true, message: '选择成功 (Mock)', path: 'D:\\gnb\\bin\\gnb.exe' };
  },
};

/**
 * @name 日志服务
 */
export const logService = {
  /** 订阅日志 */
  async subscribe(nodeId: string): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.logs.subscribe(nodeId);
    }
    return { success: true, message: '已订阅日志 (Mock)' };
  },

  /** 取消订阅日志 */
  async unsubscribe(nodeId: string): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.logs.unsubscribe(nodeId);
    }
    return { success: true, message: '已取消订阅 (Mock)' };
  },

  /** 监听日志数据 */
  onData(callback: (data: { nodeId: string; data: string }) => void): () => void {
    if (isElectron) {
      return window.electronAPI.logs.onData(callback);
    }
    // Mock: 定时发送模拟日志
    const timer = setInterval(() => {
      callback({
        nodeId: '1001',
        data: `[${new Date().toISOString()}] GNB 节点运行中...\n`,
      });
    }, 3000);
    return () => clearInterval(timer);
  },
};

/**
 * @name Index 节点测试服务
 */
export const indexNodeService = {
  /** 测试单个 Index 节点连通性 */
  async ping(address: string, port: number): Promise<{ success: boolean; latency: number; message: string }> {
    if (isElectron) {
      return window.electronAPI.indexNode.ping(address, port);
    }
    // Mock: 随机返回在线/离线
    const online = Math.random() > 0.3;
    return online
      ? { success: true, latency: Math.floor(Math.random() * 200) + 10, message: `在线 (Mock)` }
      : { success: false, latency: -1, message: '连接超时 (Mock)' };
  },

  /** 批量测试 Index 节点连通性 */
  async pingAll(nodeList: Array<{ address: string; port: number }>): Promise<Record<string, { success: boolean; latency: number; message: string }>> {
    if (isElectron) {
      return window.electronAPI.indexNode.pingAll(nodeList);
    }
    // Mock
    const results: Record<string, { success: boolean; latency: number; message: string }> = {};
    nodeList.forEach((node) => {
      const key = `${node.address}:${node.port}`;
      const online = Math.random() > 0.3;
      results[key] = online
        ? { success: true, latency: Math.floor(Math.random() * 200) + 10, message: `在线 (Mock)` }
        : { success: false, latency: -1, message: '连接超时 (Mock)' };
    });
    return results;
  },
};

/**
 * @name 快速启动历史记录服务
 */
export const historyService = {
  /** 获取历史记录 */
  async get(): Promise<QuickStartHistory[]> {
    if (isElectron) {
      return window.electronAPI.history.get();
    }
    // Mock
    return [
      { id: '1', nodeId: '1001', indexAddress: '101.32.178.3/9001', passcode: '999001', lastUsedAt: Date.now() - 3600000, createdAt: Date.now() - 86400000 },
      { id: '2', nodeId: '1003', indexAddress: '101.32.178.3/9001', passcode: '0xFFFCFFFE', lastUsedAt: Date.now() - 7200000, createdAt: Date.now() - 172800000 },
    ];
  },

  /** 添加历史记录 */
  async add(nodeId: string, indexAddress: string, passcode: string): Promise<QuickStartHistory> {
    if (isElectron) {
      return window.electronAPI.history.add(nodeId, indexAddress, passcode);
    }
    return { id: `${Date.now()}`, nodeId, indexAddress, passcode, lastUsedAt: Date.now(), createdAt: Date.now() };
  },

  /** 删除历史记录 */
  async remove(id: string): Promise<void> {
    if (isElectron) {
      return window.electronAPI.history.remove(id);
    }
  },

  /** 清空历史记录 */
  async clear(): Promise<void> {
    if (isElectron) {
      return window.electronAPI.history.clear();
    }
  },
};

/**
 * @name Safe 配置管理服务
 */
export const safeConfigService = {
  /** 列出所有 Safe 配置 */
  async list(): Promise<SafeConfigListResult> {
    if (isElectron) {
      return window.electronAPI.safeConfig.list();
    }
    // Mock
    return {
      success: true,
      configs: [
        {
          dirName: 'safe/conf/1002',
          nodeId: '1002',
          listen: '9002',
          passcode: '999001',
          multiSocket: 'off',
          pfCrypto: 'off',
          addressSecure: 'off',
          peerNodes: ['1001'],
          indexNodes: ['101.32.178.3'],
          routeCount: 6,
          hasSecurityKey: true,
          hasEd25519Key: true,
        },
      ],
      message: '获取成功 (Mock)',
    };
  },

  /** 获取 Safe 配置详情 */
  async get(dirName: string): Promise<SafeConfigDetailResult> {
    if (isElectron) {
      return window.electronAPI.safeConfig.get(dirName);
    }
    // Mock
    return {
      success: true,
      detail: {
        dirName,
        dirPath: `D:\\gnb\\safe\\conf\\${dirName}`,
        nodeConf: { nodeid: '1002', listen: '9002', passcode: '999001', 'multi-socket': 'off', 'pf-crypto': 'off' },
        addressConf: [
          { type: 'i', index: 0, address: '101.32.178.3', port: 9001 },
          { type: 'n', nodeId: '1001', address: '101.32.178.3', port: 9001 },
        ],
        routeConf: [
          { nodeId: '1001', virtualIP: '172.31.0.1', subnetMask: '255.255.0.0' },
          { nodeId: '1002', virtualIP: '172.31.0.2', subnetMask: '255.255.0.0' },
        ],
        securityKeys: [],
        ed25519Keys: [],
      },
      message: '获取成功 (Mock)',
    };
  },

  /** 保存 Safe 配置 */
  async save(dirName: string, data: SaveSafeConfigData): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.safeConfig.save(dirName, data);
    }
    return { success: true, message: '配置已保存 (Mock)' };
  },

  /** 创建 Safe 配置 */
  async create(nodeId: string, options?: Partial<NodeConfData>, indexAddress?: string): Promise<SafeConfigCreateResult> {
    if (isElectron) {
      return window.electronAPI.safeConfig.create(nodeId, options, indexAddress);
    }
    return { success: true, dirName: nodeId, message: `配置已创建 (Mock)` };
  },

  /** 删除 Safe 配置 */
  async delete(dirName: string): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.safeConfig.delete(dirName);
    }
    return { success: true, message: `配置已删除 (Mock)` };
  },

  /** 生成密钥对 */
  async genKey(dirName: string, nodeId: string): Promise<KeyGenerateResult> {
    if (isElectron) {
      return window.electronAPI.safeConfig.genKey(dirName, nodeId);
    }
    return { success: true, message: '密钥生成成功 (Mock)', keys: [`${nodeId}.public`, `${nodeId}.private`] };
  },

  /** 读取密钥文件内容 */
  async readKey(keyPath: string): Promise<{ success: boolean; content?: string; message: string }> {
    if (isElectron) {
      return window.electronAPI.safeConfig.readKey(keyPath);
    }
    return { success: true, content: 'MOCK_PUBLIC_KEY_CONTENT_BASE64==', message: '读取成功 (Mock)' };
  },

  /** 写入密钥文件内容 */
  async writeKey(keyPath: string, content: string): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.safeConfig.writeKey(keyPath, content);
    }
    return { success: true, message: '写入成功 (Mock)' };
  },

  /** 删除密钥文件 */
  async deleteKey(keyPath: string): Promise<OperationResult> {
    if (isElectron) {
      return window.electronAPI.safeConfig.deleteKey(keyPath);
    }
    return { success: true, message: '删除成功 (Mock)' };
  },

  /** 检查密钥是否已存在 */
  async hasExistingKeys(dirName: string): Promise<{ security: boolean; ed25519: boolean }> {
    if (isElectron) {
      return window.electronAPI.safeConfig.hasExistingKeys(dirName);
    }
    return { security: true, ed25519: false };
  },
};
