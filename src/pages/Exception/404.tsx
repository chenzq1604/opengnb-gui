/**
 * @name 404 页面
 * @description 页面未找到时的异常页面
 */
import { Button, Result } from 'antd';
import React from 'react';
import { history } from '@umijs/max';

/**
 * @name 404 页面组件
 */
const Exception404: React.FC = () => (
  <Result
    status="404"
    title="404"
    subTitle="抱歉，您访问的页面不存在。"
    extra={
      <Button type="primary" onClick={() => history.push('/dashboard')}>
        返回首页
      </Button>
    }
  />
);

export default Exception404;
