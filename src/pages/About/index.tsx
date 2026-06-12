/**
 * @name 版本信息页面
 * @description 展示 OpenGNB GUI 版本、openGNB 版本、致谢及项目 GitHub 链接
 */
import React, { useEffect, useState } from 'react';
import { Card, Space, Typography, Tag, Button, Descriptions, Divider, App } from 'antd';
import {
  GithubOutlined,
  InfoCircleOutlined,
  HeartOutlined,
  ReloadOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { appService } from '@/services/gnb';

const { Title, Text, Paragraph } = Typography;

/** OpenGNB 项目仓库地址 */
const OPEN_GNB_REPO_URL = 'https://github.com/opengnb/opengnb.git';

/** openGNB 核心版本号 */
const OPENGNB_VERSION = '1.6.5';

/**
 * @name 版本信息页面组件
 */
const About: React.FC = () => {
  const { message } = App.useApp();
  /** OpenGNB GUI 应用版本号 */
  const [appVersion, setAppVersion] = useState('1.0.0');

  /**
   * @name 加载环境信息
   */
  const loadEnvInfo = async () => {
    try {
      const version = await appService.getVersion();
      if (version) setAppVersion(version);
    } catch {
      // 忽略：保留默认值
    }
  };

  useEffect(() => {
    loadEnvInfo();
  }, []);

  /**
   * @name 打开外部链接
   * @param url 链接地址
   */
  const handleOpenLink = (url: string) => {
    if (typeof window !== 'undefined' && window.open) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      message.error('当前环境无法打开外部链接');
    }
  };

  /**
   * @name 复制 GitHub 仓库地址到剪贴板
   */
  const handleCopyRepo = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(OPEN_GNB_REPO_URL).then(
        () => message.success('仓库地址已复制到剪贴板'),
        () => message.error('复制失败，请手动复制'),
      );
    } else {
      message.error('当前环境不支持剪贴板');
    }
  };

  return (
    <PageContainer
      header={{
        title: '版本信息',
        subTitle: 'OpenGNB GUI 版本与项目致谢',
      }}
    >
      {/* 应用版本卡片 */}
      <Card
        title={
          <Space>
            <InfoCircleOutlined />
            <span>应用版本</span>
          </Space>
        }
        extra={
          <Button
            type="link"
            icon={<ReloadOutlined />}
            onClick={loadEnvInfo}
          >
            刷新
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="OpenGNB GUI">v{appVersion}</Descriptions.Item>
          <Descriptions.Item label="openGNB">{OPENGNB_VERSION}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 项目致谢卡片 */}
      <Card
        title={
          <Space>
            <HeartOutlined style={{ color: '#eb2f96' }} />
            <span>项目致谢</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Paragraph style={{ fontSize: 14, marginBottom: 0 }}>
            <Text>感谢 X 总为我们带来了 openGNB：</Text>
            <Tag
              color="blue"
              icon={<GithubOutlined />}
              style={{ marginLeft: 8, cursor: 'pointer' }}
              onClick={() => handleOpenLink(OPEN_GNB_REPO_URL)}
            >
              {OPEN_GNB_REPO_URL}
            </Tag>
          </Paragraph>

          <Paragraph style={{ fontSize: 14, marginBottom: 0 }}>
            <Text>windows GUI 开发者：Larf.chen</Text>
          </Paragraph>

          <Divider style={{ margin: '8px 0' }} />

          <Space wrap>
            <Button
              type="primary"
              icon={<LinkOutlined />}
              onClick={() => handleOpenLink(OPEN_GNB_REPO_URL)}
            >
              访问 GitHub 仓库
            </Button>
            <Button icon={<GithubOutlined />} onClick={handleCopyRepo}>
              复制仓库地址
            </Button>
          </Space>

          <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
            OpenGNB 是一款开源的去中心化 P2P 虚拟网络（SDVN），具有极致的内网穿透能力。
            本项目仅是 GNB 的 Windows 桌面 GUI 前端，核心网络功能由 gnb.exe 提供。
          </Paragraph>
        </Space>
      </Card>
    </PageContainer>
  );
};

export default About;
