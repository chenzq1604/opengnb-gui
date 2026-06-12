/**
 * @name Electron API 类型声明
 * @description 渲染进程中 window.electronAPI 的类型定义
 */

/** 节点运行状态 */
export interface NodeStatus {
  nodeId: string;
  running: boolean;
  pid?: number;
  startTime?: number;
  mode?: 'lite' | 'safe';
  /** 入站流量（字节） */
  inBytes?: number;
  /** 出站流量（字节） */
  outBytes?: number;
  /** 保存启动参数，用于重启 */
  startOptions?: NodeStartOptions;
  /** 对端节点状态列表（从 gnb_ctl 解析） */
  peerNodes?: PeerNodeStatus[];
}

/** 对端节点状态（从 gnb_ctl -c -s 输出解析） */
export interface PeerNodeStatus {
  /** 对端节点 ID */
  nodeId: string;
  /** 对端虚拟 IPv4 */
  tunIPv4: string;
  /** 连接类型：Direct Point to Point / InDirect / Local node */
  ipv4Type: string;
  /** IPv4 延迟（微秒） */
  latencyUsec: number;
  /** 对端公网地址 */
  wanIPv4: string;
  /** 入站流量（字节） */
  inBytes: number;
  /** 出站流量（字节） */
  outBytes: number;
  /** 探测计数 */
  detectCount: number;
}

/** 节点启动选项 */
export interface NodeStartOptions {
  nodeId: string;
  mode: 'lite' | 'safe';
  lite?: {
    indexAddress: string;
    passcode: string;
    /** 对端节点ID，逗号分隔，如 "1002" 或 "1002,1003" */
    peerNodeId?: string;
  };
  safe?: {
    configDir: string;
  };
  extraArgs?: string[];
}

/** 密钥信息 */
export interface KeyInfo {
  name: string;
  path: string;
  type: 'public' | 'private';
  size: number;
  modifiedTime: string;
}

/** 通用操作结果 */
export interface OperationResult {
  success: boolean;
  message: string;
}

/** 配置读取结果 */
export interface ConfigReadResult extends OperationResult {
  content?: string;
}

/** 配置目录列表结果 */
export interface ConfigDirsResult extends OperationResult {
  dirs?: string[];
}

/** 密钥列表结果 */
export interface KeyListResult extends OperationResult {
  keys?: KeyInfo[];
}

/** 密钥生成结果 */
export interface KeyGenerateResult extends OperationResult {
  keys?: string[];
}

/** 文件/目录选择结果 */
export interface SelectPathResult {
  success: boolean;
  message: string;
  path: string;
}

/** 快速启动历史记录 */
export interface QuickStartHistory {
  id: string;
  nodeId: string;
  indexAddress: string;
  passcode: string;
  lastUsedAt: number;
  createdAt: number;
}

/** node.conf 键值对 */
export interface NodeConfData {
  [key: string]: string | undefined;
  nodeid?: string;
  listen?: string;
  'multi-socket'?: string;
  passcode?: string;
  'if-drv'?: string;
  'address-secure'?: string;
  'pf-crypto'?: string;
  'console-log-level'?: string;
  'index-log-level'?: string;
  'node-log-level'?: string;
  'if-dump'?: string;
}

/** address.conf 条目 */
export interface AddressEntry {
  type: 'i' | 'n';
  index?: number;
  nodeId?: string;
  address: string;
  port: number;
}

/** route.conf 条目 */
export interface RouteEntry {
  nodeId: string;
  virtualIP: string;
  subnetMask: string;
}

/** Safe 配置密钥文件信息 */
export interface SafeKeyFileInfo {
  name: string;
  path: string;
  type: 'public' | 'private';
  size: number;
  modifiedTime: string;
}

/** Safe 配置摘要（列表展示用） */
export interface SafeConfigSummary {
  dirName: string;
  nodeId: string;
  listen: string;
  passcode: string;
  multiSocket: string;
  pfCrypto: string;
  addressSecure: string;
  peerNodes: string[];
  indexNodes: string[];
  routeCount: number;
  hasSecurityKey: boolean;
  hasEd25519Key: boolean;
}

/** Safe 配置详情（编辑用） */
export interface SafeConfigDetail {
  dirName: string;
  dirPath: string;
  nodeConf: NodeConfData;
  addressConf: AddressEntry[];
  routeConf: RouteEntry[];
  securityKeys: SafeKeyFileInfo[];
  ed25519Keys: SafeKeyFileInfo[];
}

/** 保存 Safe 配置的参数 */
export interface SaveSafeConfigData {
  nodeConf?: NodeConfData;
  addressConf?: AddressEntry[];
  routeConf?: RouteEntry[];
}

/** Safe 配置列表结果 */
export interface SafeConfigListResult extends OperationResult {
  configs?: SafeConfigSummary[];
}

/** Safe 配置详情结果 */
export interface SafeConfigDetailResult extends OperationResult {
  detail?: SafeConfigDetail;
}

/** Safe 配置创建结果 */
export interface SafeConfigCreateResult extends OperationResult {
  dirName?: string;
}

/** Electron API 接口 */
export interface ElectronAPI {
  gnb: {
    start: (options: NodeStartOptions) => Promise<OperationResult>;
    stop: (nodeId: string) => Promise<OperationResult>;
    restart: (nodeId: string) => Promise<OperationResult>;
    getStatus: (nodeId: string) => Promise<NodeStatus | null>;
    getAllStatus: () => Promise<NodeStatus[]>;
    remove: (nodeId: string) => Promise<OperationResult>;
  };
  config: {
    read: (configPath: string) => Promise<ConfigReadResult>;
    write: (configPath: string, content: string) => Promise<OperationResult>;
    listDirs: () => Promise<ConfigDirsResult>;
    createDir: (dirName: string) => Promise<OperationResult>;
    deleteDir: (dirName: string) => Promise<OperationResult>;
  };
  crypto: {
    generateKey: (outputDir: string) => Promise<KeyGenerateResult>;
    listKeys: (dir: string) => Promise<KeyListResult>;
    importPublicKey: (srcPath: string, destDir: string) => Promise<OperationResult>;
    exportPublicKey: (keyPath: string, destPath: string) => Promise<OperationResult>;
  };
  safeConfig: {
    list: () => Promise<SafeConfigListResult>;
    get: (dirName: string) => Promise<SafeConfigDetailResult>;
    save: (dirName: string, data: SaveSafeConfigData) => Promise<OperationResult>;
    create: (nodeId: string, options?: Partial<NodeConfData>, indexAddress?: string) => Promise<SafeConfigCreateResult>;
    delete: (dirName: string) => Promise<OperationResult>;
    genKey: (dirName: string, nodeId: string) => Promise<KeyGenerateResult>;
    /** 读取密钥文件内容 */
    readKey: (keyPath: string) => Promise<{ success: boolean; content?: string; message: string }>;
    /** 写入密钥文件内容 */
    writeKey: (keyPath: string, content: string) => Promise<OperationResult>;
    /** 删除密钥文件 */
    deleteKey: (keyPath: string) => Promise<OperationResult>;
    /** 检查密钥是否已存在 */
    hasExistingKeys: (dirName: string) => Promise<{ security: boolean; ed25519: boolean }>;
  };
  app: {
    getVersion: () => Promise<string>;
    getGnbBinPath: () => Promise<string>;
    setGnbBinPath: (binPath: string) => Promise<OperationResult>;
    /** 获取系统设置（穿透策略等） */
    getSettings: () => Promise<Record<string, any>>;
    /** 保存系统设置 */
    setSettings: (settings: Record<string, any>) => Promise<OperationResult>;
    selectDirectory: () => Promise<SelectPathResult>;
    selectFile: (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<SelectPathResult>;
  };
  logs: {
    subscribe: (nodeId: string) => Promise<OperationResult>;
    unsubscribe: (nodeId: string) => Promise<OperationResult>;
    onData: (callback: (data: { nodeId: string; data: string }) => void) => () => void;
  };
  history: {
    get: () => Promise<QuickStartHistory[]>;
    add: (nodeId: string, indexAddress: string, passcode: string) => Promise<QuickStartHistory>;
    remove: (id: string) => Promise<void>;
    clear: () => Promise<void>;
  };
  indexNode: {
    ping: (address: string, port: number) => Promise<{ success: boolean; latency: number; message: string }>;
    pingAll: (nodeList: Array<{ address: string; port: number }>) => Promise<Record<string, { success: boolean; latency: number; message: string }>>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
