/**
 * @name 系统设置存储
 * @description 把穿透策略等 GUI 设置持久化到 userData/settings.json
 * @note 之所以不用 localStorage：main process spawn gnb.exe 时拿不到 localStorage，需要文件
 */
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/** 完整设置项接口 */
export interface SystemSettings {
  gnbBinPath?: string;
  networkDriver?: 'wintun' | 'tap-windows';
  mtu?: number;
  encryption?: 'aes256' | 'aes128' | 'none';
  upnp?: boolean;
  autoStart?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** 强 NAT 穿透（对称型 NAT / 双层 NAT 场景） */
  extremeNatTraversal?: boolean;
  /** 安全索引模式（与 INDEX 通信时增加校验） */
  safeIndex?: boolean;
  /** 端口探测（默认开） */
  portDetect?: boolean;
  /** 多 socket（同时维护多条链路用于容灾） */
  multiSocket?: boolean;
}

/** 默认值 */
const DEFAULT_SETTINGS: SystemSettings = {
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

/** 获取 settings.json 绝对路径 */
function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

/** 从文件读取设置（不存在时返回默认值） */
export function getSettings(): SystemSettings {
  try {
    const filePath = getSettingsFilePath();
    if (!fs.existsSync(filePath)) {
      return { ...DEFAULT_SETTINGS };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as SystemSettings;
    // 与默认值合并，保证新增字段不缺失
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    console.error('[gnb-settings] getSettings error:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

/** 写入设置到文件 */
export function setSettings(settings: SystemSettings): { success: boolean; message: string } {
  try {
    const filePath = getSettingsFilePath();
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
    return { success: true, message: '设置已保存' };
  } catch (err: any) {
    return { success: false, message: `保存失败: ${err.message}` };
  }
}

/** 增量更新（与默认值合并） */
export function updateSettings(patch: Partial<SystemSettings>): { success: boolean; message: string } {
  const current = getSettings();
  const merged = { ...current, ...patch };
  return setSettings(merged);
}

export { DEFAULT_SETTINGS };
