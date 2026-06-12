/**
 * @name GNB 密钥管理器
 * @description 管理 ed25519 公私钥对的生成、查看、导入和导出
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** 密钥信息 */
export interface KeyInfo {
  name: string;
  path: string;
  type: 'public' | 'private';
  size: number;
  modifiedTime: string;
}

/**
 * @class GnbCryptoManager
 * @description 通过调用 gnb_crypto.exe 管理密钥对
 */
export class GnbCryptoManager {
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
   * @name 生成 ed25519 密钥对
   * @param outputDir 输出目录（security 子目录）
   * @param nodeId 节点ID，用于命名密钥文件
   * @returns 生成结果
   */
  async generateKeyPair(outputDir: string, nodeId: string): Promise<{ success: boolean; message: string; keys?: string[] }> {
    const cryptoBin = this.getCryptoBinPath();

    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // gnb_crypto.exe 正确用法: -c -p {nodeid}.private -k {nodeid}.public
    const privateKeyFile = path.join(outputDir, `${nodeId}.private`);
    const publicKeyFile = path.join(outputDir, `${nodeId}.public`);

    return new Promise((resolve) => {
      const args = ['-c', '-p', privateKeyFile, '-k', publicKeyFile];
      const proc = spawn(cryptoBin, args, {
        cwd: path.dirname(cryptoBin),
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          // 列出生成的密钥文件
          const keys = this.scanKeyFiles(outputDir);
          resolve({
            success: true,
            message: '密钥对生成成功',
            keys: keys.map((k) => k.name),
          });
        } else {
          resolve({
            success: false,
            message: `密钥生成失败: ${stderr || stdout}`,
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          message: `执行 gnb_crypto 失败: ${err.message}`,
        });
      });
    });
  }

  /**
   * @name 获取密钥列表
   * @param dir 密钥目录
   */
  listKeys(dir: string): { success: boolean; keys?: KeyInfo[]; message: string } {
    try {
      if (!fs.existsSync(dir)) {
        return { success: true, keys: [], message: '目录不存在' };
      }

      const keys = this.scanKeyFiles(dir);
      return { success: true, keys, message: '获取成功' };
    } catch (err: any) {
      return { success: false, message: `获取失败: ${err.message}` };
    }
  }

  /**
   * @name 导入公钥
   * @param srcPath 源文件路径
   * @param destDir 目标目录
   */
  importPublicKey(srcPath: string, destDir: string): { success: boolean; message: string } {
    try {
      if (!fs.existsSync(srcPath)) {
        return { success: false, message: '源文件不存在' };
      }

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const fileName = path.basename(srcPath);
      const destPath = path.join(destDir, fileName);
      fs.copyFileSync(srcPath, destPath);

      return { success: true, message: `公钥已导入: ${fileName}` };
    } catch (err: any) {
      return { success: false, message: `导入失败: ${err.message}` };
    }
  }

  /**
   * @name 导出公钥
   * @param keyPath 公钥文件路径
   * @param destPath 目标路径
   */
  exportPublicKey(keyPath: string, destPath: string): { success: boolean; message: string } {
    try {
      if (!fs.existsSync(keyPath)) {
        return { success: false, message: '密钥文件不存在' };
      }

      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.copyFileSync(keyPath, destPath);
      return { success: true, message: `公钥已导出` };
    } catch (err: any) {
      return { success: false, message: `导出失败: ${err.message}` };
    }
  }

  /**
   * @name 扫描目录中的密钥文件
   * @param dir 目录路径
   */
  private scanKeyFiles(dir: string): KeyInfo[] {
    const keys: KeyInfo[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(dir, entry.name);
          const stat = fs.statSync(filePath);

          // 判断密钥类型
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
