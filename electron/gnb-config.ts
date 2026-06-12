/**
 * @name GNB 配置管理器
 * @description 管理 GNB 节点配置文件的读写和配置目录管理
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

/** 配置文件类型 */
export type ConfigFileType = 'node' | 'address' | 'route';

/**
 * @class GnbConfigManager
 * @description 管理 GNB 配置文件和配置目录
 */
export class GnbConfigManager {
  /** 配置根目录 */
  private configRoot: string;

  /** GNB 二进制路径配置文件 */
  private settingsPath: string;

  /** 应用设置 */
  private settings: Record<string, string>;

  constructor() {
    // 配置目录放在用户数据目录下
    this.configRoot = path.join(app.getPath('userData'), 'gnb-config');
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
    this.settings = {};

    // 确保配置目录存在
    if (!fs.existsSync(this.configRoot)) {
      fs.mkdirSync(this.configRoot, { recursive: true });
    }

    // 加载设置
    this.loadSettings();
  }

  /**
   * @name 加载应用设置
   */
  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const content = fs.readFileSync(this.settingsPath, 'utf-8');
        this.settings = JSON.parse(content);
      }
    } catch {
      this.settings = {};
    }
  }

  /**
   * @name 保存应用设置
   */
  private saveSettings(): void {
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('保存设置失败:', err);
    }
  }

  /**
   * @name 获取 GNB 二进制路径
   */
  getGnbBinPath(): string {
    return this.settings.gnbBinPath || '';
  }

  /**
   * @name 获取 GNB 二进制文件所在目录
   */
  getGnbBinDir(): string {
    const binPath = this.getGnbBinPath();
    if (binPath) {
      return path.dirname(binPath);
    }
    // 兜底：生产环境 resources/bin 或开发环境项目 bin
    const prodBinDir = path.join(process.resourcesPath || '', 'bin');
    if (fs.existsSync(prodBinDir)) {
      return prodBinDir;
    }
    const devBinDir = path.join(__dirname, '..', 'bin');
    if (fs.existsSync(devBinDir)) {
      return devBinDir;
    }
    return '';
  }

  /**
   * @name 设置 GNB 二进制路径
   */
  setGnbBinPath(binPath: string): { success: boolean; message: string } {
    if (binPath && !fs.existsSync(binPath)) {
      return { success: false, message: '指定的路径不存在' };
    }
    this.settings.gnbBinPath = binPath;
    this.saveSettings();
    return { success: true, message: 'GNB 二进制路径已更新' };
  }

  /**
   * @name 读取配置文件
   * @param configPath 配置文件路径（相对于配置根目录或绝对路径）
   */
  readConfig(configPath: string): { success: boolean; content?: string; message: string } {
    try {
      const fullPath = this.resolveConfigPath(configPath);
      if (!fs.existsSync(fullPath)) {
        return { success: false, message: `配置文件不存在: ${configPath}` };
      }
      const content = fs.readFileSync(fullPath, 'utf-8');
      return { success: true, content, message: '读取成功' };
    } catch (err: any) {
      return { success: false, message: `读取失败: ${err.message}` };
    }
  }

  /**
   * @name 写入配置文件
   * @param configPath 配置文件路径
   * @param content 配置内容
   */
  writeConfig(configPath: string, content: string): { success: boolean; message: string } {
    try {
      const fullPath = this.resolveConfigPath(configPath);
      const dir = path.dirname(fullPath);

      // 确保目录存在
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, content, 'utf-8');
      return { success: true, message: '写入成功' };
    } catch (err: any) {
      return { success: false, message: `写入失败: ${err.message}` };
    }
  }

  /**
   * @name 获取配置目录列表
   * @description 扫描 userData/gnb-config 和 bin/safe/conf 两个位置，合并去重
   */
  listConfigDirs(): { success: boolean; dirs?: string[]; message: string } {
    try {
      const dirs: string[] = [];

      // 1. 扫描 userData/gnb-config（用户通过 GUI 创建的配置）
      if (fs.existsSync(this.configRoot)) {
        const entries = fs.readdirSync(this.configRoot, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            dirs.push(entry.name);
          }
        }
      }

      // 2. 扫描 bin/safe/conf（预置的 Safe 模式配置）
      const binDir = this.getGnbBinDir();
      const safeConfDir = path.join(binDir, 'safe', 'conf');
      if (fs.existsSync(safeConfDir)) {
        const entries = fs.readdirSync(safeConfDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !dirs.includes(entry.name)) {
            dirs.push(`safe/conf/${entry.name}`);
          }
        }
      }

      return { success: true, dirs, message: '获取成功' };
    } catch (err: any) {
      return { success: false, message: `获取失败: ${err.message}` };
    }
  }

  /**
   * @name 创建配置目录
   * @param dirName 目录名
   */
  createConfigDir(dirName: string): { success: boolean; message: string } {
    try {
      const dirPath = path.join(this.configRoot, dirName);
      if (fs.existsSync(dirPath)) {
        return { success: false, message: `目录已存在: ${dirName}` };
      }

      fs.mkdirSync(dirPath, { recursive: true });

      // 创建默认配置文件
      const defaultNodeConf = `# GNB 节点配置\n# nodeid 请设置为你的节点ID\n`;
      const defaultAddressConf = `# 地址配置\n# 格式: nodeid address port\n`;
      const defaultRouteConf = `# 路由配置\n# 格式: destination via_nodeid\n`;

      fs.writeFileSync(path.join(dirPath, 'node.conf'), defaultNodeConf, 'utf-8');
      fs.writeFileSync(path.join(dirPath, 'address.conf'), defaultAddressConf, 'utf-8');
      fs.writeFileSync(path.join(dirPath, 'route.conf'), defaultRouteConf, 'utf-8');

      return { success: true, message: `配置目录已创建: ${dirName}` };
    } catch (err: any) {
      return { success: false, message: `创建失败: ${err.message}` };
    }
  }

  /**
   * @name 删除配置目录
   * @param dirName 目录名
   */
  deleteConfigDir(dirName: string): { success: boolean; message: string } {
    try {
      const dirPath = path.join(this.configRoot, dirName);
      if (!fs.existsSync(dirPath)) {
        return { success: false, message: `目录不存在: ${dirName}` };
      }

      fs.rmSync(dirPath, { recursive: true, force: true });
      return { success: true, message: `配置目录已删除: ${dirName}` };
    } catch (err: any) {
      return { success: false, message: `删除失败: ${err.message}` };
    }
  }

  /**
   * @name 解析配置路径
   * @description 如果是相对路径则相对于配置根目录解析
   */
  private resolveConfigPath(configPath: string): string {
    if (path.isAbsolute(configPath)) {
      return configPath;
    }
    return path.join(this.configRoot, configPath);
  }

  /**
   * @name 获取配置根目录
   */
  getConfigRoot(): string {
    return this.configRoot;
  }

  // ==================== Safe 配置管理 ====================

  /**
   * @name 解析 Safe 配置目录的绝对路径
   * @param dirName 配置目录名（如 "1002" 或 "safe/conf/1002"）
   */
  resolveSafeConfigDir(dirName: string): string {
    // 如果是 safe/conf/ 前缀，指向 bin/safe/conf
    if (dirName.startsWith('safe/conf/')) {
      const binDir = this.getGnbBinDir();
      return path.join(binDir, dirName);
    }
    // 否则先检查 userData/gnb-config，再检查 bin/safe/conf
    const userDir = path.join(this.configRoot, dirName);
    if (fs.existsSync(userDir)) {
      return userDir;
    }
    const binDir = this.getGnbBinDir();
    const safeDir = path.join(binDir, 'safe', 'conf', dirName);
    if (fs.existsSync(safeDir)) {
      return safeDir;
    }
    // 默认返回 userData 下的路径（新建时用）
    return userDir;
  }

  /**
   * @name 列出所有 Safe 配置（含解析后的摘要信息）
   */
  listSafeConfigs(): { success: boolean; configs?: SafeConfigSummary[]; message: string } {
    try {
      const configs: SafeConfigSummary[] = [];
      const seenDirs = new Set<string>();

      // 1. 扫描 userData/gnb-config
      if (fs.existsSync(this.configRoot)) {
        const entries = fs.readdirSync(this.configRoot, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            seenDirs.add(entry.name);
            const dirPath = path.join(this.configRoot, entry.name);
            const summary = this.parseSafeConfigSummary(dirPath, entry.name);
            configs.push(summary);
          }
        }
      }

      // 2. 扫描 bin/safe/conf
      const binDir = this.getGnbBinDir();
      const safeConfDir = path.join(binDir, 'safe', 'conf');
      if (fs.existsSync(safeConfDir)) {
        const entries = fs.readdirSync(safeConfDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !seenDirs.has(entry.name)) {
            const dirPath = path.join(safeConfDir, entry.name);
            const summary = this.parseSafeConfigSummary(dirPath, `safe/conf/${entry.name}`);
            configs.push(summary);
          }
        }
      }

      return { success: true, configs, message: '获取成功' };
    } catch (err: any) {
      return { success: false, message: `获取失败: ${err.message}` };
    }
  }

  /**
   * @name 解析 Safe 配置目录的摘要信息
   */
  private parseSafeConfigSummary(dirPath: string, dirName: string): SafeConfigSummary {
    const nodeConf = this.parseNodeConf(dirPath);
    const addressConf = this.parseAddressConf(dirPath);
    const routeConf = this.parseRouteConf(dirPath);

    return {
      dirName,
      nodeId: nodeConf.nodeid || '',
      listen: nodeConf.listen || '',
      passcode: nodeConf.passcode || '',
      multiSocket: nodeConf['multi-socket'] || '',
      pfCrypto: nodeConf['pf-crypto'] || '',
      addressSecure: nodeConf['address-secure'] || '',
      peerNodes: addressConf.filter(a => a.type === 'n').map(a => a.nodeId && a.address ? `${a.nodeId}:${a.address}` : (a.nodeId || '')).filter((s): s is string => !!s),
      indexNodes: addressConf.filter(a => a.type === 'i').map(a => a.address),
      routeCount: routeConf.length,
      hasSecurityKey: fs.existsSync(path.join(dirPath, 'security')),
      hasEd25519Key: fs.existsSync(path.join(dirPath, 'ed25519')),
    };
  }

  /**
   * @name 获取 Safe 配置详情（所有配置文件内容）
   */
  getSafeConfigDetail(dirName: string): { success: boolean; detail?: SafeConfigDetail; message: string } {
    try {
      const dirPath = this.resolveSafeConfigDir(dirName);
      if (!fs.existsSync(dirPath)) {
        return { success: false, message: `配置目录不存在: ${dirName}` };
      }

      const nodeConf = this.parseNodeConf(dirPath);
      const addressConf = this.parseAddressConf(dirPath);
      const routeConf = this.parseRouteConf(dirPath);

      // 密钥信息
      const securityKeys = this.scanKeyDir(path.join(dirPath, 'security'));
      const ed25519Keys = this.scanKeyDir(path.join(dirPath, 'ed25519'));

      return {
        success: true,
        detail: {
          dirName,
          dirPath,
          nodeConf,
          addressConf,
          routeConf,
          securityKeys,
          ed25519Keys,
        },
        message: '获取成功',
      };
    } catch (err: any) {
      return { success: false, message: `获取失败: ${err.message}` };
    }
  }

  /**
   * @name 保存 Safe 配置（写入 node.conf / address.conf / route.conf）
   */
  saveSafeConfig(dirName: string, data: SaveSafeConfigData): { success: boolean; message: string } {
    try {
      const dirPath = this.resolveSafeConfigDir(dirName);

      // 确保目录存在
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // 写入 node.conf
      if (data.nodeConf) {
        const content = this.serializeNodeConf(data.nodeConf);
        fs.writeFileSync(path.join(dirPath, 'node.conf'), content, 'utf-8');
      }

      // 写入 address.conf
      if (data.addressConf !== undefined) {
        const content = this.serializeAddressConf(data.addressConf);
        fs.writeFileSync(path.join(dirPath, 'address.conf'), content, 'utf-8');
      }

      // 写入 route.conf
      if (data.routeConf !== undefined) {
        const content = this.serializeRouteConf(data.routeConf);
        fs.writeFileSync(path.join(dirPath, 'route.conf'), content, 'utf-8');
      }

      return { success: true, message: '配置已保存' };
    } catch (err: any) {
      return { success: false, message: `保存失败: ${err.message}` };
    }
  }

  /**
   * @name 创建新的 Safe 配置目录
   */
  createSafeConfig(nodeId: string, options?: Partial<NodeConfData>, indexAddress?: string): { success: boolean; dirName: string; message: string } {
    try {
      const dirName = nodeId;
      const dirPath = path.join(this.configRoot, dirName);

      if (fs.existsSync(dirPath)) {
        return { success: false, dirName: '', message: `配置目录已存在: ${dirName}` };
      }

      fs.mkdirSync(dirPath, { recursive: true });

      // 写入默认 node.conf
      const nodeConf: NodeConfData = {
        nodeid: nodeId,
        listen: options?.listen || `900${nodeId.slice(-1)}`,
        passcode: options?.passcode || '999001',
        'multi-socket': options?.['multi-socket'] || 'off',
        'pf-crypto': options?.['pf-crypto'] || 'off',
        'address-secure': options?.['address-secure'] || 'off',
        'if-drv': options?.['if-drv'] || 'wintun',
        'console-log-level': options?.['console-log-level'] || '2',
        'index-log-level': options?.['index-log-level'] || '2',
        'node-log-level': options?.['node-log-level'] || '2',
        'if-dump': options?.['if-dump'] || 'off',
      };
      fs.writeFileSync(path.join(dirPath, 'node.conf'), this.serializeNodeConf(nodeConf), 'utf-8');

      // 写入 address.conf（含 Index 节点地址）
      const addressEntries: AddressEntry[] = [];
      if (indexAddress) {
        const parts = indexAddress.split('/');
        const addr = parts[0];
        const port = parseInt(parts[1] || '9001', 10);
        addressEntries.push({ type: 'i', index: 0, address: addr, port });
      }
      fs.writeFileSync(path.join(dirPath, 'address.conf'), this.serializeAddressConf(addressEntries), 'utf-8');

      // 写入 route.conf（含本节点及默认对端节点路由）
      const routeEntries: RouteEntry[] = [];
      const localId = parseInt(nodeId, 10);
      const defaultNodeIds = [1001, 1002, 1003, 1004, 1005, 1006];
      for (const id of defaultNodeIds) {
        const lastDigit = String(id).slice(-1);
        routeEntries.push({
          nodeId: String(id),
          virtualIP: `172.31.0.${lastDigit}`,
          subnetMask: '255.255.0.0',
        });
      }
      // 如果本节点不在默认列表中，也加入
      if (!defaultNodeIds.includes(localId)) {
        routeEntries.push({
          nodeId,
          virtualIP: `172.31.0.${nodeId.slice(-1)}`,
          subnetMask: '255.255.0.0',
        });
      }
      fs.writeFileSync(path.join(dirPath, 'route.conf'), this.serializeRouteConf(routeEntries), 'utf-8');

      return { success: true, dirName, message: `配置目录已创建: ${dirName}` };
    } catch (err: any) {
      return { success: false, dirName: '', message: `创建失败: ${err.message}` };
    }
  }

  /**
   * @name 删除 Safe 配置目录
   */
  deleteSafeConfig(dirName: string): { success: boolean; message: string } {
    try {
      const dirPath = this.resolveSafeConfigDir(dirName);
      if (!fs.existsSync(dirPath)) {
        return { success: false, message: `配置目录不存在: ${dirName}` };
      }

      fs.rmSync(dirPath, { recursive: true, force: true });
      return { success: true, message: `配置目录已删除: ${dirName}` };
    } catch (err: any) {
      return { success: false, message: `删除失败: ${err.message}` };
    }
  }

  /**
   * @name 读取密钥文件内容
   * @param keyPath 密钥文件绝对路径
   */
  readKeyFile(keyPath: string): { success: boolean; content?: string; message: string } {
    try {
      if (!fs.existsSync(keyPath)) {
        return { success: false, message: '密钥文件不存在' };
      }
      const content = fs.readFileSync(keyPath, 'utf-8');
      return { success: true, content, message: '读取成功' };
    } catch (err: any) {
      return { success: false, message: `读取失败: ${err.message}` };
    }
  }

  /**
   * @name 写入密钥文件内容
   * @param keyPath 密钥文件绝对路径
   * @param content 文件内容
   */
  writeKeyFile(keyPath: string, content: string): { success: boolean; message: string } {
    try {
      const dir = path.dirname(keyPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(keyPath, content, 'utf-8');
      return { success: true, message: '写入成功' };
    } catch (err: any) {
      return { success: false, message: `写入失败: ${err.message}` };
    }
  }

  /**
   * @name 删除密钥文件
   * @param keyPath 密钥文件绝对路径
   */
  deleteKeyFile(keyPath: string): { success: boolean; message: string } {
    try {
      if (!fs.existsSync(keyPath)) {
        return { success: false, message: '密钥文件不存在' };
      }
      fs.unlinkSync(keyPath);
      return { success: true, message: '删除成功' };
    } catch (err: any) {
      return { success: false, message: `删除失败: ${err.message}` };
    }
  }

  /**
   * @name 检查密钥目录是否已有密钥
   * @param dirName 配置目录名
   */
  hasExistingKeys(dirName: string): { security: boolean; ed25519: boolean } {
    const dirPath = this.resolveSafeConfigDir(dirName);
    const securityDir = path.join(dirPath, 'security');
    const ed25519Dir = path.join(dirPath, 'ed25519');
    return {
      security: fs.existsSync(securityDir) && fs.readdirSync(securityDir).length > 0,
      ed25519: fs.existsSync(ed25519Dir) && fs.readdirSync(ed25519Dir).length > 0,
    };
  }

  // ==================== 配置文件解析/序列化 ====================

  /**
   * @name 解析 node.conf
   */
  parseNodeConf(dirPath: string): NodeConfData {
    const result: NodeConfData = {};
    const filePath = path.join(dirPath, 'node.conf');
    if (!fs.existsSync(filePath)) return result;

    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const spaceIdx = trimmed.indexOf(' ');
      if (spaceIdx > 0) {
        const key = trimmed.substring(0, spaceIdx);
        const value = trimmed.substring(spaceIdx + 1).trim();
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * @name 序列化 node.conf
   */
  serializeNodeConf(data: NodeConfData): string {
    const lines: string[] = ['# GNB Safe 模式节点配置'];
    // 按固定顺序输出
    const orderedKeys = [
      'nodeid', 'listen', 'multi-socket', 'passcode', 'if-drv',
      'address-secure', 'pf-crypto', 'console-log-level', 'index-log-level',
      'node-log-level', 'if-dump',
    ];
    for (const key of orderedKeys) {
      if (data[key] !== undefined) {
        lines.push(`${key} ${data[key]}`);
      }
    }
    // 输出其他未在固定顺序中的字段
    for (const [key, value] of Object.entries(data)) {
      if (!orderedKeys.includes(key)) {
        lines.push(`${key} ${value}`);
      }
    }
    return lines.join('\n') + '\n';
  }

  /**
   * @name 解析 address.conf
   */
  parseAddressConf(dirPath: string): AddressEntry[] {
    const entries: AddressEntry[] = [];
    const filePath = path.join(dirPath, 'address.conf');
    if (!fs.existsSync(filePath)) return entries;

    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('|');
      if (parts.length >= 4 && parts[0] === 'i') {
        entries.push({
          type: 'i',
          index: parseInt(parts[1], 10),
          address: parts[2],
          port: parseInt(parts[3], 10),
        });
      } else if (parts.length >= 4 && parts[0] === 'n') {
        entries.push({
          type: 'n',
          nodeId: parts[1],
          address: parts[2],
          port: parseInt(parts[3], 10),
        });
      }
    }
    return entries;
  }

  /**
   * @name 序列化 address.conf
   */
  serializeAddressConf(entries: AddressEntry[]): string {
    const lines: string[] = [];
    for (const entry of entries) {
      if (entry.type === 'i') {
        lines.push(`i|${entry.index}|${entry.address}|${entry.port}`);
      } else if (entry.type === 'n') {
        lines.push(`n|${entry.nodeId}|${entry.address}|${entry.port}`);
      }
    }
    return lines.join('\n') + (lines.length > 0 ? '\n' : '');
  }

  /**
   * @name 解析 route.conf
   */
  parseRouteConf(dirPath: string): RouteEntry[] {
    const entries: RouteEntry[] = [];
    const filePath = path.join(dirPath, 'route.conf');
    if (!fs.existsSync(filePath)) return entries;

    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('|');
      if (parts.length >= 3) {
        entries.push({
          nodeId: parts[0],
          virtualIP: parts[1],
          subnetMask: parts[2],
        });
      }
    }
    return entries;
  }

  /**
   * @name 序列化 route.conf
   */
  serializeRouteConf(entries: RouteEntry[]): string {
    const lines: string[] = [];
    for (const entry of entries) {
      lines.push(`${entry.nodeId}|${entry.virtualIP}|${entry.subnetMask}`);
    }
    return lines.join('\n') + (lines.length > 0 ? '\n' : '');
  }

  /**
   * @name 扫描密钥目录
   */
  private scanKeyDir(dirPath: string): KeyFileInfo[] {
    const keys: KeyFileInfo[] = [];
    if (!fs.existsSync(dirPath)) return keys;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(dirPath, entry.name);
          const stat = fs.statSync(filePath);
          let keyType: 'public' | 'private' = 'public';
          if (entry.name.includes('private') || entry.name.includes('sec') || entry.name.includes('seed')) {
            keyType = 'private';
          }
          keys.push({
            name: entry.name,
            path: filePath,
            type: keyType,
            size: stat.size,
            modifiedTime: stat.mtime.toISOString(),
          });
        }
      }
    } catch {
      // 忽略扫描错误
    }
    return keys;
  }
}

// ==================== 类型定义 ====================

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
  /** i 类型: 索引号; n 类型: 无用 */
  index?: number;
  /** n 类型: 节点 ID */
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

/** 密钥文件信息 */
export interface KeyFileInfo {
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
  securityKeys: KeyFileInfo[];
  ed25519Keys: KeyFileInfo[];
}

/** 保存 Safe 配置的参数 */
export interface SaveSafeConfigData {
  nodeConf?: NodeConfData;
  addressConf?: AddressEntry[];
  routeConf?: RouteEntry[];
}
