/**
 * @name 系统托盘管理
 * @description 创建系统托盘图标和菜单，支持最小化到托盘
 */
import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron';
import * as path from 'node:path';

/** 托盘实例 */
let tray: Tray | null = null;

/**
 * @name 设置系统托盘
 * @param mainWindow 主窗口实例
 */
export function setupTray(mainWindow: BrowserWindow | null): void {
  // 创建托盘图标（使用默认图标）
  const iconPath = path.join(__dirname, '..', 'dist', 'icon.png');
  let trayIcon: Electron.NativeImage;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    // 如果图标太大，缩放到 16x16
    if (trayIcon.getSize().width > 16) {
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    }
  } catch {
    // 如果图标加载失败，创建一个空图标
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('OpenGNB');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: '节点状态',
      type: 'normal',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 双击托盘图标显示主窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/**
 * @name 更新托盘状态
 * @param runningNodes 运行中的节点数量
 */
export function updateTrayStatus(runningNodes: number): void {
  if (tray) {
    const statusText = runningNodes > 0 ? `OpenGNB - ${runningNodes} 个节点运行中` : 'OpenGNB - 无节点运行';
    tray.setToolTip(statusText);
  }
}

/**
 * @name 销毁托盘
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
