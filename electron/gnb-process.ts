/**
 * @name GNB 进程管理器
 * @description 管理 gnb.exe 子进程的启动、停止、状态监控和日志收集
 */
import { ChildProcess, spawn, execSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as gnbSettings from './gnb-settings';

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

/** 节点启动选项 */
export interface NodeStartOptions {
  nodeId: string;
  mode: 'lite' | 'safe';
  /** Lite 模式参数 */
  lite?: {
    indexAddress: string;
    passcode: string;
    /** 对端节点ID，逗号分隔 */
    peerNodeId?: string;
  };
  /** Safe 模式参数 */
  safe?: {
    configDir: string;
  };
  /** 额外参数 */
  extraArgs?: string[];
}

/** 快速启动历史记录 */
export interface QuickStartHistory {
  /** 唯一标识 */
  id: string;
  /** 节点 ID */
  nodeId: string;
  /** Index 地址 */
  indexAddress: string;
  /** Passcode */
  passcode: string;
  /** 最后使用时间 */
  lastUsedAt: number;
  /** 创建时间 */
  createdAt: number;
}

/** 日志回调函数类型 */
type LogCallback = (data: string) => void;

/**
 * @class GnbProcessManager
 * @description 管理 GNB 子进程的生命周期
 */
export class GnbProcessManager {
  /** 运行中的进程映射 */
  private processes: Map<string, ChildProcess> = new Map();

  /** 节点状态映射 */
  private statusMap: Map<string, NodeStatus> = new Map();

  /** 日志回调映射 */
  private logCallbacks: Map<string, LogCallback> = new Map();

  /** 日志缓冲区 */
  private logBuffers: Map<string, string[]> = new Map();

  /** 最大日志缓冲行数 */
  private readonly MAX_LOG_LINES = 5000;

  /** 历史记录文件路径 */
  private readonly HISTORY_FILE = path.join(
    process.env.APPDATA || process.env.HOME || '',
    'opengnb',
    'quick-start-history.json'
  );

  /** 最大历史记录条数 */
  private readonly MAX_HISTORY = 20;

  /**
   * @name 获取历史记录文件路径
   */
  private getHistoryFilePath(): string {
    // 生产环境放在 app 用户数据目录
    try {
      const { app } = require('electron');
      return path.join(app.getPath('userData'), 'quick-start-history.json');
    } catch {
      return this.HISTORY_FILE;
    }
  }

  /**
   * @name 读取历史记录
   */
  getHistory(): QuickStartHistory[] {
    try {
      const filePath = this.getHistoryFilePath();
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (_err) {
      // 读取失败返回空数组
    }
    return [];
  }

  /**
   * @name 保存历史记录
   * @param history 历史记录列表
   */
  private saveHistory(history: QuickStartHistory[]): void {
    try {
      const filePath = this.getHistoryFilePath();
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf-8');
    } catch (_err) {
      // 保存失败静默处理
    }
  }

  /**
   * @name 添加历史记录
   * @param nodeId 节点 ID
   * @param indexAddress Index 地址
   * @param passcode Passcode
   */
  addHistory(nodeId: string, indexAddress: string, passcode: string): QuickStartHistory {
    const history = this.getHistory();
    // 检查是否已存在相同配置（nodeId + indexAddress + passcode）
    const existingIdx = history.findIndex(
      h => h.nodeId === nodeId && h.indexAddress === indexAddress && h.passcode === passcode
    );
    const now = Date.now();
    if (existingIdx >= 0) {
      // 更新已有记录的时间
      history[existingIdx].lastUsedAt = now;
    } else {
      // 新增记录
      history.unshift({
        id: `${nodeId}-${indexAddress}-${now}`,
        nodeId,
        indexAddress,
        passcode,
        lastUsedAt: now,
        createdAt: now,
      });
    }
    // 限制最大条数
    if (history.length > this.MAX_HISTORY) {
      history.splice(this.MAX_HISTORY);
    }
    // 按最后使用时间倒序排列
    history.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
    this.saveHistory(history);
    // 返回刚添加或更新的记录
    return history.find(h => h.nodeId === nodeId && h.indexAddress === indexAddress && h.passcode === passcode) || history[0];
  }

  /**
   * @name 删除历史记录
   * @param id 记录 ID
   */
  removeHistory(id: string): void {
    const history = this.getHistory();
    const filtered = history.filter(h => h.id !== id);
    this.saveHistory(filtered);
  }

  /**
   * @name 清空历史记录
   */
  clearHistory(): void {
    this.saveHistory([]);
  }

  /**
   * @name 获取 GNB 二进制文件路径
   * @description 根据开发/生产环境获取 gnb.exe 的路径
   */
  private getGnbBinPath(): string {
    // 优先从环境变量读取
    const envPath = process.env.GNB_BIN_PATH;
    if (envPath && fs.existsSync(envPath)) {
      return envPath;
    }

    // 生产环境：优先使用 resources 目录下的 bin（extraResources 打包）
    const prodBinPath = path.join(process.resourcesPath, 'bin', 'gnb.exe');
    if (fs.existsSync(prodBinPath)) {
      return prodBinPath;
    }

    // 开发环境：项目根目录下的 bin
    const devBinPath = path.join(__dirname, '..', 'bin', 'gnb.exe');
    if (fs.existsSync(devBinPath)) {
      return devBinPath;
    }

    return 'gnb.exe';
  }

  /**
   * @name 获取 gnb_ctl.exe 路径
   */
  private getCtlBinPath(): string {
    const prodBinPath = path.join(process.resourcesPath, 'bin', 'gnb_ctl.exe');
    if (fs.existsSync(prodBinPath)) {
      return prodBinPath;
    }
    const devBinPath = path.join(__dirname, '..', 'bin', 'gnb_ctl.exe');
    if (fs.existsSync(devBinPath)) {
      return devBinPath;
    }
    return 'gnb_ctl.exe';
  }

  /**
   * @name 获取 map 文件路径
   * @description 在 gnb.exe 所在目录查找 gnb.*.map 文件
   */
  private getMapFilePath(): string {
    const gnbBin = this.getGnbBinPath();
    const binDir = path.dirname(gnbBin);
    try {
      const files = fs.readdirSync(binDir);
      const mapFile = files.find(f => /^gnb\.\d+\.map$/.test(f));
      if (mapFile) {
        return path.join(binDir, mapFile);
      }
    } catch {
      // 读取目录失败
    }
    return '';
  }

  /**
   * @name 获取 gnb_crypto.exe 路径
   */
  private getCryptoBinPath(): string {
    // 生产环境：优先使用 resources 目录下的 bin
    const prodBinPath = path.join(process.resourcesPath, 'bin', 'gnb_crypto.exe');
    if (fs.existsSync(prodBinPath)) {
      return prodBinPath;
    }
    // 开发环境：项目根目录下的 bin
    const devBinPath = path.join(__dirname, '..', 'bin', 'gnb_crypto.exe');
    if (fs.existsSync(devBinPath)) {
      return devBinPath;
    }
    return 'gnb_crypto.exe';
  }

  /**
   * @name 启动 GNB 节点
   * @param options 启动选项
   * @returns 启动结果
   */
  async start(options: NodeStartOptions): Promise<{ success: boolean; message: string }> {
    // 检查是否已在运行
    if (this.processes.has(options.nodeId)) {
      return { success: false, message: `节点 ${options.nodeId} 已在运行中` };
    }

    const gnbBin = this.getGnbBinPath();
    const args: string[] = [];

    if (options.mode === 'lite') {
      // Lite 模式: gnb -n nodeid -I index_address -p passcode -a peer_node_addr
      args.push('-n', options.nodeId);
      if (options.lite?.indexAddress) {
        args.push('-I', options.lite.indexAddress);
      }
      if (options.lite?.passcode) {
        args.push('-p', options.lite.passcode);
      }
      // 构造对端节点地址参数 (-a)
      // 格式: n|peerId1,n|peerId2 （n 表示 node 类型）
      // 如果用户指定了 peerNodeId，使用用户指定的；否则自动添加默认路由中的其他节点
      if (options.lite?.peerNodeId) {
        const peerIds = options.lite.peerNodeId.split(',').map(id => id.trim()).filter(id => id);
        if (peerIds.length > 0) {
          const peerAddr = peerIds.map(id => `n|${id}`).join(',');
          args.push('-a', peerAddr);
        }
      } else {
        // 自动添加默认路由中的其他节点作为对端（1001-1005）
        const localId = parseInt(options.nodeId, 10);
        const defaultIds = [1001, 1002, 1003, 1004, 1005];
        const peerIds = defaultIds.filter(id => id !== localId);
        if (peerIds.length > 0) {
          const peerAddr = peerIds.map(id => `n|${id}`).join(',');
          args.push('-a', peerAddr);
        }
      }
    } else if (options.mode === 'safe') {
      // Safe 模式: gnb -c config_dir（需要绝对路径）
      if (options.safe?.configDir) {
        const configDir = options.safe.configDir;
        // 如果不是绝对路径，需要解析为绝对路径
        let absConfigDir = configDir;
        if (!path.isAbsolute(configDir)) {
          // 尝试从 userData/gnb-config 解析
          const { app } = require('electron');
          const userDataConfigDir = path.join(app.getPath('userData'), 'gnb-config', configDir);
          if (fs.existsSync(userDataConfigDir)) {
            absConfigDir = userDataConfigDir;
          } else {
            // 尝试从 bin/safe/conf 解析
            const binDir = path.dirname(this.getGnbBinPath());
            const safeConfDir = path.join(binDir, 'safe', 'conf', configDir);
            if (fs.existsSync(safeConfDir)) {
              absConfigDir = safeConfDir;
            } else {
              // 默认使用 userData 路径
              absConfigDir = userDataConfigDir;
            }
          }
        }
        args.push('-c', absConfigDir);
      }
    }

    // ===== 根据 settings 注入穿透能力参数（仅 Lite 模式，Safe 模式由 node.conf 控制） =====
    const settings = gnbSettings.getSettings();

    if (options.mode === 'lite') {
      // 1. 虚拟网卡驱动（默认 wintun）
      const driver = settings.networkDriver || 'wintun';
      args.push(`--if-drv=${driver}`);

      // 2. 多 socket（默认开）
      if (settings.multiSocket !== false) {
        args.push('--multi-socket=on');
      }

      // 3. 安全索引模式
      if (settings.safeIndex) {
        args.push('--safe-index=on');
      }

      // 4. 强 NAT 穿透（对称型 NAT / 双层 NAT）
      if (settings.extremeNatTraversal) {
        args.push('-E');
      }

      // 5. UPnP（通过 gnb_es --upnp 启用）
      if (settings.upnp) {
        args.push('-e', '"--upnp"');
      }
    }

    if (options.extraArgs) {
      args.push(...options.extraArgs);
    }

    try {
      const proc = spawn(gnbBin, args, {
        cwd: path.dirname(gnbBin),
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.processes.set(options.nodeId, proc);
      this.statusMap.set(options.nodeId, {
        nodeId: options.nodeId,
        running: true,
        pid: proc.pid,
        startTime: Date.now(),
        mode: options.mode,
        startOptions: options,
      });
      this.logBuffers.set(options.nodeId, []);

      // 监听 stdout
      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        this.appendLog(options.nodeId, text);
        this.logCallbacks.get(options.nodeId)?.(text);
      });

      // 监听 stderr
      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        this.appendLog(options.nodeId, `[ERROR] ${text}`);
        this.logCallbacks.get(options.nodeId)?.(`[ERROR] ${text}`);
      });

      // 监听进程退出
      proc.on('close', (code) => {
        this.processes.delete(options.nodeId);
        const status = this.statusMap.get(options.nodeId);
        if (status) {
          status.running = false;
        }
        const exitMsg = `节点 ${options.nodeId} 已退出，退出码: ${code}`;
        this.appendLog(options.nodeId, exitMsg);
        this.logCallbacks.get(options.nodeId)?.(exitMsg);
      });

      proc.on('error', (err) => {
        this.processes.delete(options.nodeId);
        const status = this.statusMap.get(options.nodeId);
        if (status) {
          status.running = false;
        }
        const errMsg = `节点 ${options.nodeId} 启动失败: ${err.message}`;
        this.appendLog(options.nodeId, errMsg);
        this.logCallbacks.get(options.nodeId)?.(errMsg);
      });

      // Lite 模式启动成功后保存历史记录
      if (options.mode === 'lite' && options.lite?.indexAddress) {
        this.addHistory(options.nodeId, options.lite.indexAddress, options.lite.passcode || '');
      }

      return { success: true, message: `节点 ${options.nodeId} 启动成功，PID: ${proc.pid}` };
    } catch (err: any) {
      return { success: false, message: `启动失败: ${err.message}` };
    }
  }

  /**
   * @name 停止 GNB 节点
   * @param nodeId 节点 ID
   */
  async stop(nodeId: string): Promise<{ success: boolean; message: string }> {
    const proc = this.processes.get(nodeId);
    if (!proc) {
      return { success: false, message: `节点 ${nodeId} 未在运行` };
    }

    try {
      proc.kill('SIGTERM');
      // Windows 上可能需要强制终止
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      }, 5000);

      this.processes.delete(nodeId);
      const status = this.statusMap.get(nodeId);
      if (status) {
        status.running = false;
      }

      return { success: true, message: `节点 ${nodeId} 已停止` };
    } catch (err: any) {
      return { success: false, message: `停止失败: ${err.message}` };
    }
  }

  /**
   * @name 重启 GNB 节点
   * @param nodeId 节点 ID
   */
  async restart(nodeId: string): Promise<{ success: boolean; message: string }> {
    const status = this.statusMap.get(nodeId);
    if (!status) {
      return { success: false, message: `节点 ${nodeId} 不存在` };
    }

    // 保存启动参数
    const savedOptions = status.startOptions;

    await this.stop(nodeId);

    // 等待进程完全停止
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 使用保存的启动参数重启，如果没有保存则用默认值
    if (savedOptions) {
      return this.start(savedOptions);
    }

    return this.start({
      nodeId,
      mode: status.mode || 'lite',
      lite: status.mode === 'lite' ? { indexAddress: '', passcode: '' } : undefined,
      safe: status.mode === 'safe' ? { configDir: '' } : undefined,
    });
  }

  /**
   * @name 获取节点状态
   * @param nodeId 节点 ID
   */
  getStatus(nodeId: string): NodeStatus | null {
    return this.statusMap.get(nodeId) || null;
  }

  /**
   * @name 获取所有节点状态
   * @description 同时通过 gnb_ctl 获取实时流量数据
   */
  getAllStatus(): NodeStatus[] {
    const statuses = Array.from(this.statusMap.values());
    // 尝试获取流量数据
    this.updateTrafficData(statuses);
    return statuses;
  }

  /**
   * @name 获取指定节点的 map 文件路径
   * @description Lite 模式: bin/gnb.<port>.map; Safe 模式: <conf_dir>/gnb.map
   * @param status 节点状态
   */
  private getMapFileForNode(status: NodeStatus): string {
    if (status.mode === 'safe' && status.startOptions?.safe?.configDir) {
      // Safe 模式: map 文件在配置目录下
      let configDir = status.startOptions.safe.configDir;
      if (!path.isAbsolute(configDir)) {
        try {
          const { app } = require('electron');
          const userDataConfigDir = path.join(app.getPath('userData'), 'gnb-config', configDir);
          if (fs.existsSync(userDataConfigDir)) {
            configDir = userDataConfigDir;
          } else {
            const binDir = path.dirname(this.getGnbBinPath());
            const safeConfDir = path.join(binDir, 'safe', 'conf', configDir);
            if (fs.existsSync(safeConfDir)) {
              configDir = safeConfDir;
            }
          }
        } catch { /* ignore */ }
      }
      const safeMapFile = path.join(configDir, 'gnb.map');
      if (fs.existsSync(safeMapFile)) {
        return safeMapFile;
      }
    }

    // Lite 模式: map 文件在 bin 目录下，格式 gnb.<port>.map
    // 端口规则: 900{nodeId最后一位}
    const lastDigit = status.nodeId.slice(-1);
    const port = `900${lastDigit}`;
    const binDir = path.dirname(this.getGnbBinPath());
    const liteMapFile = path.join(binDir, `gnb.${port}.map`);
    if (fs.existsSync(liteMapFile)) {
      return liteMapFile;
    }

    // 回退: 查找 bin 目录下任意 gnb.*.map
    try {
      const files = fs.readdirSync(binDir);
      const mapFile = files.find(f => /^gnb\.\d+\.map$/.test(f));
      if (mapFile) {
        return path.join(binDir, mapFile);
      }
    } catch { /* ignore */ }

    return '';
  }

  /**
   * @name 通过 gnb_ctl 获取流量数据并更新节点状态
   * @param statuses 节点状态列表
   */
  private updateTrafficData(statuses: NodeStatus[]): void {
    const ctlBin = this.getCtlBinPath();

    for (const status of statuses) {
      if (!status.running) continue;

      const mapFile = this.getMapFileForNode(status);
      if (!mapFile) continue;

      try {
        const result = execSync(
          `"${ctlBin}" -b "${mapFile}" -c -s`,
          { encoding: 'utf-8', timeout: 3000, windowsHide: true }
        );

        // 解析 gnb_ctl 输出中的节点块
        const nodeBlocks = result.split('====================');
        const peerNodes: PeerNodeStatus[] = [];

        for (const block of nodeBlocks) {
          const nodeMatch = block.match(/node\s+(\d+)/);
          if (!nodeMatch) continue;
          const nodeId = nodeMatch[1];

          // 匹配流量（允许行开头有空白字符，忽略大小写，允许in/out和数字之间有任意空白）
          const inMatch = block.match(/^\s*in\s+(\d+)/im);
          const outMatch = block.match(/^\s*out\s+(\d+)/im);
          
          // 兜底匹配：如果上面的正则匹配不到，尝试从整行里找in/out后面的数字
          let inBytes = 0;
          let outBytes = 0;
          if (inMatch) {
            inBytes = parseInt(inMatch[1], 10);
          } else {
            const fallbackInMatch = block.match(/in\s*=\s*(\d+)|in\s+(\d+)/i);
            if (fallbackInMatch) {
              inBytes = parseInt(fallbackInMatch[1] || fallbackInMatch[2], 10);
            }
          }
          if (outMatch) {
            outBytes = parseInt(outMatch[1], 10);
          } else {
            const fallbackOutMatch = block.match(/out\s*=\s*(\d+)|out\s+(\d+)/i);
            if (fallbackOutMatch) {
              outBytes = parseInt(fallbackOutMatch[1] || fallbackOutMatch[2], 10);
            }
          }

          // 仅更新本机节点（mapFile 所属节点）的总流量，避免对端流量覆盖
          if (nodeId === status.nodeId) {
            status.inBytes = inBytes;
            status.outBytes = outBytes;
          }

          // 解析对端节点信息（排除本机节点 "Local node"）
          const ipv4TypeMatch = block.match(/^\s*ipv4\s+(.+)$/im);
          const ipv4Type = ipv4TypeMatch ? ipv4TypeMatch[1].trim() : '';

          // 跳过本机节点
          if (ipv4Type === 'Local node') continue;

          const tunIPv4Match = block.match(/^\s*tun_ipv4\s+(.+)$/im);
          const latencyMatch = block.match(/^\s*addr4_ping_latency_usec\s+(\d+)/im);
          const wanIPv4Match = block.match(/^\s*wan_ipv4\s+(.+)$/im);
          const detectCountMatch = block.match(/^\s*detect_count\s+(\d+)/im);

          peerNodes.push({
            nodeId,
            tunIPv4: tunIPv4Match ? tunIPv4Match[1].trim() : '',
            ipv4Type,
            latencyUsec: latencyMatch ? parseInt(latencyMatch[1], 10) : 0,
            wanIPv4: wanIPv4Match ? wanIPv4Match[1].trim() : '',
            inBytes,
            outBytes,
            detectCount: detectCountMatch ? parseInt(detectCountMatch[1], 10) : 0,
          });
        }

        // 将对端节点信息挂到本机节点状态上
        status.peerNodes = peerNodes;
      } catch (_err) {
        // gnb_ctl 调用失败时不影响其他数据返回
      }
    }
  }

  /**
   * @name 删除节点
   * @param nodeId 节点 ID
   * @description 停止运行中的节点并从状态映射中移除
   */
  async remove(nodeId: string): Promise<{ success: boolean; message: string }> {
    const proc = this.processes.get(nodeId);
    // 如果节点正在运行，先停止
    if (proc) {
      try {
        proc.kill('SIGTERM');
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 5000);
        this.processes.delete(nodeId);
      } catch (_err: any) {
        // 忽略停止失败，继续清理
      }
    }
    // 从状态映射中移除
    this.statusMap.delete(nodeId);
    // 清理日志相关
    this.logCallbacks.delete(nodeId);
    this.logBuffers.delete(nodeId);
    return { success: true, message: `节点 ${nodeId} 已删除` };
  }

  /**
   * @name 停止所有节点
   */
  stopAll(): void {
    for (const [nodeId] of this.processes) {
      this.stop(nodeId);
    }
  }

  /**
   * @name 订阅日志流
   * @param nodeId 节点 ID
   * @param callback 日志回调函数
   */
  subscribeLogs(nodeId: string, callback: LogCallback): { success: boolean; message: string } {
    this.logCallbacks.set(nodeId, callback);
    return { success: true, message: `已订阅节点 ${nodeId} 的日志` };
  }

  /**
   * @name 取消订阅日志流
   * @param nodeId 节点 ID
   */
  unsubscribeLogs(nodeId: string): { success: boolean; message: string } {
    this.logCallbacks.delete(nodeId);
    return { success: true, message: `已取消订阅节点 ${nodeId} 的日志` };
  }

  /**
   * @name 获取日志缓冲区
   * @param nodeId 节点 ID
   */
  getLogBuffer(nodeId: string): string[] {
    return this.logBuffers.get(nodeId) || [];
  }

  /**
   * @name 追加日志到缓冲区
   * @param nodeId 节点 ID
   * @param text 日志文本
   */
  private appendLog(nodeId: string, text: string): void {
    const buffer = this.logBuffers.get(nodeId) || [];
    const lines = text.split('\n').filter((line) => line.trim());
    buffer.push(...lines);

    // 限制缓冲区大小
    if (buffer.length > this.MAX_LOG_LINES) {
      buffer.splice(0, buffer.length - this.MAX_LOG_LINES);
    }

    this.logBuffers.set(nodeId, buffer);
  }
}
