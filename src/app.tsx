/**
 * @name 应用入口配置
 * @description UmiJS 运行时配置，包括布局、全局状态等
 */
import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import type { RunTimeLayoutConfig } from '@umijs/max';
import { Link, history } from '@umijs/max';
import React from 'react';
import defaultSettings from '../config/defaultSettings';

/**
 * @name 全局初始状态
 * @description 获取应用的全局初始状态
 */
export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
}> {
  return {
    settings: defaultSettings as Partial<LayoutSettings>,
  };
}

/**
 * @name ProLayout 配置
 * @description 自定义布局渲染
 */
export const layout: RunTimeLayoutConfig = ({ initialState }) => {
  return {
    menuItemRender: (item, dom) => {
      if (item.path) {
        return (
          <Link to={item.path} prefetch>
            {dom}
          </Link>
        );
      }
      return dom;
    },
    headerTitleRender: () => (
      <span style={{ fontWeight: 'bold', fontSize: '16px' }}>OpenGNB</span>
    ),
    ...initialState?.settings,
  };
};
