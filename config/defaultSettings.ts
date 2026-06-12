/**
 * @name 默认布局设置
 * @description Ant Design Pro 布局默认配置
 */
import type { ProLayoutProps } from '@ant-design/pro-components';

const Settings: ProLayoutProps & {
  logo?: string;
} = {
  navTheme: 'light',
  colorPrimary: '#1677ff',
  layout: 'side',
  contentWidth: 'Fluid',
  fixedHeader: true,
  fixSiderbar: true,
  colorWeak: false,
  title: 'OpenGNB',
  logo: './logo.svg',
  iconfontUrl: '',
  token: {},
};

export default Settings;
