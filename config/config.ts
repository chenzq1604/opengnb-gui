/**
 * @name UmiJS 主配置
 * @description OpenGNB GUI 的 UmiJS 配置，基于 @umijs/max
 */
import { defineConfig } from '@umijs/max';
import defaultSettings from './defaultSettings';
import proxy from './proxy';
import routes from './routes';

const { UMI_ENV = 'dev' } = process.env;

export default defineConfig({
  /**
   * @name 开启 hash 模式
   */
  hash: true,

  publicPath: process.env.NODE_ENV === 'production' ? './' : '/',

  /**
   * @name 使用 hash 路由
   * @description Electron file:// 协议不支持 browser history，必须用 hash 路由
   */
  history: { type: 'hash' },

  /**
   * @name 路由配置
   */
  routes,

  /**
   * @name 忽略 moment 国际化
   */
  ignoreMomentLocale: true,

  /**
   * @name 代理配置
   */
  proxy: proxy[UMI_ENV as keyof typeof proxy],

  /**
   * @name 快速热更新
   */
  fastRefresh: true,

  /**
   * @name 路由预加载
   */
  routePrefetch: {},

  /**
   * @name manifest 配置
   */
  manifest: {},

  //============== max 插件配置 ===============

  /**
   * @name 数据流插件
   */
  model: {},

  /**
   * @name 全局初始状态
   */
  initialState: {},

  /**
   * @name layout 插件
   */
  title: 'OpenGNB',
  layout: {
    locale: false,
    ...defaultSettings,
  },

  /**
   * @name moment2dayjs 插件
   */
  moment2dayjs: {
    preset: 'antd',
    plugins: ['duration', 'relativeTime'],
  },

  /**
   * @name 国际化插件 - 默认中文
   */
  locale: {
    default: 'zh-CN',
    antd: true,
    baseNavigator: false,
  },

  /**
   * @name antd 插件
   */
  antd: {
    appConfig: {},
    configProvider: {
      theme: {
        token: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
      },
    },
  },

  /**
   * @name 权限插件
   */
  access: {},

  /**
   * @headScripts
   */
  headScripts: [],

  /**
   * @name esbuild 压缩 IIFE 冲突修复
   */
  esbuildMinifyIIFE: true,

  /**
   * @name mock 配置
   */
  mock: {},

  define: {
    'process.env.CI': process.env.CI,
    __APP_VERSION__: require('./../package.json').version,
  },
});
