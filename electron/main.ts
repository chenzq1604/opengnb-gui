/**
 * @name Electron 主进程入口
 * @description 负责窗口管理、单实例锁、IPC 通信桥接、系统托盘
 */
import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as path from 'node:path';
import { pingIndexServer, pingAllIndexServers } from './gnb-ping';
import { GnbProcessManager } from './gnb-process';
import { GnbConfigManager } from './gnb-config';
import { GnbCryptoManager } from './gnb-crypto';
import * as gnbSettings from './gnb-settings';
import { setupTray } from './tray';

/** 主窗口实例 */
let mainWindow: BrowserWindow | null = null;

/** GNB 进程管理器实例 */
const gnbProcess = new GnbProcessManager();

/** GNB 配置管理器实例 */
const gnbConfig = new GnbConfigManager();

/** GNB 密钥管理器实例 */
const gnbCrypto = new GnbCryptoManager();

/** 单实例锁 */
const gotTheLock = app.requestSingleInstanceLock();

/**
 * @name 创建主窗口
 * @description 创建 Electron 主窗口，加载渲染进程页面
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'OpenGNB',
    icon: path.join(__dirname, '../dist/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  // 隐藏默认菜单栏
  mainWindow.setMenuBarVisibility(false);

  // 窗口准备好后再显示，避免白屏
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 开发环境加载 dev server
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:8000');
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * @name 注册 IPC 处理器
 * @description 注册所有渲染进程与主进程之间的 IPC 通信处理器
 */
function registerIpcHandlers(): void {
  // ========== GNB 进程管理 ==========

  /** 启动 GNB 节点 */
  ipcMain.handle('gnb:start', async (_event, options) => {
    return gnbProcess.start(options);
  });

  /** 停止 GNB 节点 */
  ipcMain.handle('gnb:stop', async (_event, nodeId: string) => {
    return gnbProcess.stop(nodeId);
  });

  /** 重启 GNB 节点 */
  ipcMain.handle('gnb:restart', async (_event, nodeId: string) => {
    return gnbProcess.restart(nodeId);
  });

  /** 获取节点状态 */
  ipcMain.handle('gnb:status', async (_event, nodeId: string) => {
    return gnbProcess.getStatus(nodeId);
  });

  /** 获取所有节点状态 */
  ipcMain.handle('gnb:statusAll', async () => {
    return gnbProcess.getAllStatus();
  });

  /** 删除节点 */
  ipcMain.handle('gnb:remove', async (_event, nodeId: string) => {
    return gnbProcess.remove(nodeId);
  });

  // ========== 快速启动历史记录 ==========

  /** 获取历史记录 */
  ipcMain.handle('history:get', async () => {
    return gnbProcess.getHistory();
  });

  /** 添加历史记录 */
  ipcMain.handle('history:add', async (_event, nodeId: string, indexAddress: string, passcode: string) => {
    return gnbProcess.addHistory(nodeId, indexAddress, passcode);
  });

  /** 删除历史记录 */
  ipcMain.handle('history:remove', async (_event, id: string) => {
    return gnbProcess.removeHistory(id);
  });

  /** 清空历史记录 */
  ipcMain.handle('history:clear', async () => {
    return gnbProcess.clearHistory();
  });

  // ========== GNB 配置管理 ==========

  /** 读取节点配置 */
  ipcMain.handle('config:read', async (_event, configPath: string) => {
    return gnbConfig.readConfig(configPath);
  });

  /** 写入节点配置 */
  ipcMain.handle('config:write', async (_event, configPath: string, content: string) => {
    return gnbConfig.writeConfig(configPath, content);
  });

  /** 获取配置目录列表 */
  ipcMain.handle('config:listDirs', async () => {
    return gnbConfig.listConfigDirs();
  });

  /** 创建节点配置目录 */
  ipcMain.handle('config:createDir', async (_event, dirName: string) => {
    return gnbConfig.createConfigDir(dirName);
  });

  /** 删除节点配置目录 */
  ipcMain.handle('config:deleteDir', async (_event, dirName: string) => {
    return gnbConfig.deleteConfigDir(dirName);
  });

  // ========== GNB 密钥管理 ==========

  /** 生成密钥对 */
  ipcMain.handle('crypto:generateKey', async (_event, outputDir: string, nodeId: string) => {
    return gnbCrypto.generateKeyPair(outputDir, nodeId);
  });

  /** 获取密钥列表 */
  ipcMain.handle('crypto:listKeys', async (_event, dir: string) => {
    return gnbCrypto.listKeys(dir);
  });

  /** 导入公钥 */
  ipcMain.handle('crypto:importPublicKey', async (_event, srcPath: string, destDir: string) => {
    return gnbCrypto.importPublicKey(srcPath, destDir);
  });

  /** 导出公钥 */
  ipcMain.handle('crypto:exportPublicKey', async (_event, keyPath: string, destPath: string) => {
    return gnbCrypto.exportPublicKey(keyPath, destPath);
  });

  // ========== Safe 配置管理 ==========

  /** 列出所有 Safe 配置 */
  ipcMain.handle('safe-config:list', async () => {
    return gnbConfig.listSafeConfigs();
  });

  /** 获取 Safe 配置详情 */
  ipcMain.handle('safe-config:get', async (_event, dirName: string) => {
    return gnbConfig.getSafeConfigDetail(dirName);
  });

  /** 保存 Safe 配置 */
  ipcMain.handle('safe-config:save', async (_event, dirName: string, data: any) => {
    return gnbConfig.saveSafeConfig(dirName, data);
  });

  /** 创建 Safe 配置 */
  ipcMain.handle('safe-config:create', async (_event, nodeId: string, options?: any, indexAddress?: string) => {
    return gnbConfig.createSafeConfig(nodeId, options, indexAddress);
  });

  /** 删除 Safe 配置 */
  ipcMain.handle('safe-config:delete', async (_event, dirName: string) => {
    return gnbConfig.deleteSafeConfig(dirName);
  });

  /** 生成 Safe 配置密钥对 */
  ipcMain.handle('safe-config:genKey', async (_event, dirName: string, nodeId: string) => {
    const dirPath = gnbConfig.resolveSafeConfigDir(dirName);
    const securityDir = path.join(dirPath, 'security');
    return gnbCrypto.generateKeyPair(securityDir, nodeId);
  });

  /** 读取密钥文件内容 */
  ipcMain.handle('safe-config:readKey', async (_event, keyPath: string) => {
    return gnbConfig.readKeyFile(keyPath);
  });

  /** 写入密钥文件内容 */
  ipcMain.handle('safe-config:writeKey', async (_event, keyPath: string, content: string) => {
    return gnbConfig.writeKeyFile(keyPath, content);
  });

  /** 删除密钥文件 */
  ipcMain.handle('safe-config:deleteKey', async (_event, keyPath: string) => {
    return gnbConfig.deleteKeyFile(keyPath);
  });

  /** 检查密钥是否已存在 */
  ipcMain.handle('safe-config:hasExistingKeys', async (_event, dirName: string) => {
    return gnbConfig.hasExistingKeys(dirName);
  });

  // ========== 应用设置 ==========

  /** 获取应用版本 */
  ipcMain.handle('app:getVersion', async () => {
    return app.getVersion();
  });

  /** 获取 GNB 二进制路径 */
  ipcMain.handle('app:getGnbBinPath', async () => {
    return gnbConfig.getGnbBinPath();
  });

  /** 设置 GNB 二进制路径 */
  ipcMain.handle('app:setGnbBinPath', async (_event, binPath: string) => {
    return gnbConfig.setGnbBinPath(binPath);
  });

  /** 获取系统设置（穿透策略等） */
  ipcMain.handle('app:getSettings', async () => {
    return gnbSettings.getSettings();
  });

  /** 保存系统设置 */
  ipcMain.handle('app:setSettings', async (_event, settings: gnbSettings.SystemSettings) => {
    return gnbSettings.setSettings(settings);
  });

  /** 打开目录选择对话框 */
  ipcMain.handle('app:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择 GNB 二进制文件所在目录',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: '已取消选择', path: '' };
    }
    return { success: true, message: '选择成功', path: result.filePaths[0] };
  });

  /** 打开文件选择对话框 */
  ipcMain.handle('app:selectFile', async (_event, options?: { title?: string; filters?: Electron.FileFilter[] }) => {
    const result = await dialog.showOpenDialog({
      title: options?.title || '选择文件',
      properties: ['openFile'],
      filters: options?.filters,
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: '已取消选择', path: '' };
    }
    return { success: true, message: '选择成功', path: result.filePaths[0] };
  });

  // ========== 日志相关 ==========

  /** 测试 Index 节点连通性（GNB 协议 POST_ADDR） */
  ipcMain.handle('indexNode:ping', async (_event, address: string, port: number) => {
    return pingIndexServer(address, port);
  });

  /** 批量测试 Index 节点连通性（GNB 协议并发测试） */
  ipcMain.handle('indexNode:pingAll', async (_event, nodeList: Array<{ address: string; port: number }>) => {
    return pingAllIndexServers(nodeList);
  });

  /** 订阅日志流 */
  ipcMain.handle('logs:subscribe', async (_event, nodeId: string) => {
    return gnbProcess.subscribeLogs(nodeId, (data: string) => {
      mainWindow?.webContents.send('logs:data', { nodeId, data });
    });
  });

  /** 取消订阅日志流 */
  ipcMain.handle('logs:unsubscribe', async (_event, nodeId: string) => {
    return gnbProcess.unsubscribeLogs(nodeId);
  });
}

// ========== 应用生命周期 ==========

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
    setupTray(mainWindow);
  });

  app.on('window-all-closed', () => {
    // Windows 上关闭所有窗口时退出应用
    gnbProcess.stopAll();
    app.quit();
  });

  app.on('before-quit', () => {
    gnbProcess.stopAll();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

export { mainWindow };
