/**
 * @name Electron 预加载脚本
 * @description 安全地暴露 IPC 通信 API 给渲染进程，使用 contextBridge
 */
import { contextBridge, ipcRenderer } from 'electron';

/**
 * @name Electron IPC API 定义
 * @description 渲染进程通过 window.electronAPI 访问这些方法
 */
const electronAPI = {
  // ========== GNB 进程管理 ==========
  gnb: {
    /** 启动 GNB 节点 */
    start: (options: any) => ipcRenderer.invoke('gnb:start', options),
    /** 停止 GNB 节点 */
    stop: (nodeId: string) => ipcRenderer.invoke('gnb:stop', nodeId),
    /** 重启 GNB 节点 */
    restart: (nodeId: string) => ipcRenderer.invoke('gnb:restart', nodeId),
    /** 获取节点状态 */
    getStatus: (nodeId: string) => ipcRenderer.invoke('gnb:status', nodeId),
    /** 获取所有节点状态 */
    getAllStatus: () => ipcRenderer.invoke('gnb:statusAll'),
    /** 删除节点 */
    remove: (nodeId: string) => ipcRenderer.invoke('gnb:remove', nodeId),
  },

  // ========== GNB 配置管理 ==========
  config: {
    /** 读取配置文件 */
    read: (configPath: string) => ipcRenderer.invoke('config:read', configPath),
    /** 写入配置文件 */
    write: (configPath: string, content: string) => ipcRenderer.invoke('config:write', configPath, content),
    /** 获取配置目录列表 */
    listDirs: () => ipcRenderer.invoke('config:listDirs'),
    /** 创建配置目录 */
    createDir: (dirName: string) => ipcRenderer.invoke('config:createDir', dirName),
    /** 删除配置目录 */
    deleteDir: (dirName: string) => ipcRenderer.invoke('config:deleteDir', dirName),
  },

  // ========== GNB 密钥管理 ==========
  crypto: {
    /** 生成密钥对 */
    generateKey: (outputDir: string) => ipcRenderer.invoke('crypto:generateKey', outputDir),
    /** 获取密钥列表 */
    listKeys: (dir: string) => ipcRenderer.invoke('crypto:listKeys', dir),
    /** 导入公钥 */
    importPublicKey: (srcPath: string, destDir: string) => ipcRenderer.invoke('crypto:importPublicKey', srcPath, destDir),
    /** 导出公钥 */
    exportPublicKey: (keyPath: string, destPath: string) => ipcRenderer.invoke('crypto:exportPublicKey', keyPath, destPath),
  },

  // ========== Safe 配置管理 ==========
  safeConfig: {
    /** 列出所有 Safe 配置 */
    list: () => ipcRenderer.invoke('safe-config:list'),
    /** 获取 Safe 配置详情 */
    get: (dirName: string) => ipcRenderer.invoke('safe-config:get', dirName),
    /** 保存 Safe 配置 */
    save: (dirName: string, data: any) => ipcRenderer.invoke('safe-config:save', dirName, data),
    /** 创建 Safe 配置 */
    create: (nodeId: string, options?: any, indexAddress?: string) => ipcRenderer.invoke('safe-config:create', nodeId, options, indexAddress),
    /** 删除 Safe 配置 */
    delete: (dirName: string) => ipcRenderer.invoke('safe-config:delete', dirName),
    /** 生成密钥对 */
    genKey: (dirName: string, nodeId: string) => ipcRenderer.invoke('safe-config:genKey', dirName, nodeId),
    /** 读取密钥文件内容 */
    readKey: (keyPath: string) => ipcRenderer.invoke('safe-config:readKey', keyPath),
    /** 写入密钥文件内容 */
    writeKey: (keyPath: string, content: string) => ipcRenderer.invoke('safe-config:writeKey', keyPath, content),
    /** 删除密钥文件 */
    deleteKey: (keyPath: string) => ipcRenderer.invoke('safe-config:deleteKey', keyPath),
    /** 检查密钥是否已存在 */
    hasExistingKeys: (dirName: string) => ipcRenderer.invoke('safe-config:hasExistingKeys', dirName),
  },

  // ========== 应用设置 ==========
  app: {
    /** 获取应用版本 */
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    /** 获取 GNB 二进制路径 */
    getGnbBinPath: () => ipcRenderer.invoke('app:getGnbBinPath'),
    /** 设置 GNB 二进制路径 */
    setGnbBinPath: (binPath: string) => ipcRenderer.invoke('app:setGnbBinPath', binPath),
    /** 获取系统设置（含穿透策略） */
    getSettings: () => ipcRenderer.invoke('app:getSettings'),
    /** 保存系统设置 */
    setSettings: (settings: any) => ipcRenderer.invoke('app:setSettings', settings),
    /** 打开目录选择对话框 */
    selectDirectory: () => ipcRenderer.invoke('app:selectDirectory'),
    /** 打开文件选择对话框 */
    selectFile: (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => ipcRenderer.invoke('app:selectFile', options),
  },

  // ========== 日志相关 ==========
  logs: {
    /** 订阅日志流 */
    subscribe: (nodeId: string) => ipcRenderer.invoke('logs:subscribe', nodeId),
    /** 取消订阅日志流 */
    unsubscribe: (nodeId: string) => ipcRenderer.invoke('logs:unsubscribe', nodeId),
    /** 监听日志数据 */
    onData: (callback: (data: { nodeId: string; data: string }) => void) => {
      const listener = (_event: any, data: { nodeId: string; data: string }) => callback(data);
      ipcRenderer.on('logs:data', listener);
      return () => ipcRenderer.removeListener('logs:data', listener);
    },
  },

  // ========== Index 节点测试 ==========
  indexNode: {
    /** 测试单个 Index 节点连通性 */
    ping: (address: string, port: number) => ipcRenderer.invoke('indexNode:ping', address, port),
    /** 批量测试 Index 节点连通性 */
    pingAll: (nodeList: Array<{ address: string; port: number }>) => ipcRenderer.invoke('indexNode:pingAll', nodeList),
  },

  // ========== 快速启动历史记录 ==========
  history: {
    /** 获取历史记录 */
    get: () => ipcRenderer.invoke('history:get'),
    /** 添加历史记录 */
    add: (nodeId: string, indexAddress: string, passcode: string) => ipcRenderer.invoke('history:add', nodeId, indexAddress, passcode),
    /** 删除历史记录 */
    remove: (id: string) => ipcRenderer.invoke('history:remove', id),
    /** 清空历史记录 */
    clear: () => ipcRenderer.invoke('history:clear'),
  },
};

// 通过 contextBridge 安全地暴露 API
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
