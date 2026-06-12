/**
 * @name 消息提示 Hook
 * @description 封装 antd App.useApp() 的 message API，替代废弃的静态 message 方法
 *              静态 message 无法消费 context（如动态主题），需通过 App 组件获取
 */
import { App } from 'antd';

/** 消息提示 Hook，返回与静态 message 相同的 API */
export const useMessage = () => {
  const { message } = App.useApp();
  return message;
};
