/**
 * @name 系统设置页面
 * @description 配置 GNB 二进制路径、虚拟网卡驱动、默认参数、开机自启动等
 */
import React, { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Typography,
  Divider,
  Space,
  Alert,
  App,
  Modal,
} from 'antd';
import {
  SettingOutlined,
  FolderOpenOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { appService } from '@/services/gnb';

const { Text, Title } = Typography;

/** 设置表单值 */
interface SettingsFormValues {
  gnbBinPath: string;
  networkDriver: string;
  mtu: number;
  encryption: string;
  upnp: boolean;
  autoStart: boolean;
  logLevel: string;
  /** 强 NAT 穿透（对称型 NAT / 双层 NAT 场景） */
  extremeNatTraversal: boolean;
  /** 安全索引模式（与 INDEX 通信时增加校验） */
  safeIndex: boolean;
  /** 端口探测（默认开，本地 NAT 后外网地址回声） */
  portDetect: boolean;
  /** 多 socket（同时维护多条链路用于容灾） */
  multiSocket: boolean;
}

/**
 * @name 系统设置页面组件
 */
const Settings: React.FC = () => {
  const [form] = Form.useForm<SettingsFormValues>();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();
  /** 路径输入弹窗状态 */
  const [pathModalVisible, setPathModalVisible] = useState(false);
  const [pathInputValue, setPathInputValue] = useState('');

  /** 打开目录选择对话框 */
  const handleSelectDirectory = async () => {
    const isElectron = typeof window !== 'undefined' && window.electronAPI;
    if (isElectron) {
      /** Electron 环境：使用原生对话框，返回完整绝对路径 */
      const result = await appService.selectDirectory();
      if (result.success && result.path) {
        form.setFieldValue('gnbBinPath', result.path);
      }
    } else {
      /** 浏览器环境：弹出 Modal 让用户手动输入完整路径 */
      setPathInputValue(form.getFieldValue('gnbBinPath') || '');
      setPathModalVisible(true);
    }
  };

  /** 确认路径输入 */
  const handlePathModalOk = () => {
    if (pathInputValue.trim()) {
      form.setFieldValue('gnbBinPath', pathInputValue.trim());
      setPathModalVisible(false);
    }
  };

  /** 加载设置 */
  const loadSettings = async () => {
    setLoading(true);
    try {
      const binPath = await appService.getGnbBinPath();
      const electronSettings = await appService.getSettings();

      const defaults: SettingsFormValues = {
        gnbBinPath: binPath,
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

      // 优先用 Electron 持久化的设置，缺失字段用默认值
      if (electronSettings && typeof electronSettings === 'object') {
        form.setFieldsValue({ ...defaults, ...electronSettings, gnbBinPath: binPath });
      } else {
        form.setFieldsValue(defaults);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  /** 保存设置 */
  const handleSave = async (values: SettingsFormValues) => {
    setLoading(true);
    try {
      // 保存 GNB 二进制路径到 Electron
      if (values.gnbBinPath) {
        await appService.setGnbBinPath(values.gnbBinPath);
      }

      // 完整设置（穿透策略等）持久化到 Electron userData/settings.json
      // 这样 main process 在 spawn gnb.exe 时能拿到 upnp/extreme 等参数
      const result = await appService.setSettings({
        gnbBinPath: values.gnbBinPath,
        networkDriver: values.networkDriver,
        mtu: values.mtu,
        encryption: values.encryption,
        upnp: values.upnp,
        autoStart: values.autoStart,
        logLevel: values.logLevel,
        extremeNatTraversal: values.extremeNatTraversal,
        safeIndex: values.safeIndex,
        portDetect: values.portDetect,
        multiSocket: values.multiSocket,
      });

      if (result.success) {
        message.success('设置已保存');
      } else {
        message.error(`保存失败: ${result.message}`);
      }
    } catch (err: any) {
      message.error(`保存失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer
      header={{
        title: '系统设置',
        subTitle: '配置 OpenGNB 运行参数',
      }}
    >
      <Card loading={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          style={{ maxWidth: 600 }}
        >
          {/* 基本设置 */}
          <Title level={5}>
            <SettingOutlined /> 基本设置
          </Title>

          <Form.Item
            name="gnbBinPath"
            label="GNB 二进制路径"
            tooltip="gnb.exe 所在的目录路径"
          >
            <Input
              placeholder="例如: D:\gnb\bin"
              suffix={
                <FolderOpenOutlined
                  style={{ cursor: 'pointer', color: '#1677ff' }}
                  onClick={handleSelectDirectory}
                />
              }
            />
          </Form.Item>

          <Form.Item
            name="networkDriver"
            label="虚拟网卡驱动"
            tooltip="选择虚拟网络使用的网卡驱动"
          >
            <Select
              options={[
                { label: 'Wintun（推荐）', value: 'wintun' },
                { label: 'TAP-Windows', value: 'tap-windows' },
              ]}
            />
          </Form.Item>

          <Divider />

          {/* 网络参数 */}
          <Title level={5}>网络参数</Title>

          <Form.Item
            name="mtu"
            label="MTU 值"
            tooltip="最大传输单元，默认 1400"
          >
            <Select
              options={[
                { label: '1280', value: 1280 },
                { label: '1400（推荐）', value: 1400 },
                { label: '1500', value: 1500 },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="encryption"
            label="加密方式"
            tooltip="节点间通信的加密算法"
          >
            <Select
              options={[
                { label: 'AES-256（推荐）', value: 'aes256' },
                { label: 'AES-128', value: 'aes128' },
                { label: '无加密', value: 'none' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="upnp"
            label="启用 UPnP"
            tooltip="自动配置端口映射，便于 NAT 穿透"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Divider style={{ margin: '12px 0' }}>穿透能力</Divider>

          <Form.Item
            name="extremeNatTraversal"
            label="强 NAT 穿透"
            tooltip="对称型 NAT / 双层 NAT 场景下启用，提升穿透成功率（--extreme-nat-traversal）"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="safeIndex"
            label="安全索引模式"
            tooltip="与 INDEX 通信时增加校验（--safe-index=on）"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="portDetect"
            label="端口探测"
            tooltip="探测本地 NAT 后外网地址并告知对端（--port-detect 默认开）"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="multiSocket"
            label="多 socket"
            tooltip="同时维护多条链路用于容灾（--multi-socket=on）"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Divider />

          {/* 应用设置 */}
          <Title level={5}>应用设置</Title>

          <Form.Item
            name="autoStart"
            label="开机自启动"
            tooltip="系统启动时自动运行 OpenGNB"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="logLevel"
            label="日志级别"
            tooltip="记录的日志详细程度"
          >
            <Select
              options={[
                { label: 'Debug（调试）', value: 'debug' },
                { label: 'Info（信息）', value: 'info' },
                { label: 'Warn（警告）', value: 'warn' },
                { label: 'Error（错误）', value: 'error' },
              ]}
            />
          </Form.Item>

          <Divider />

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
                保存设置
              </Button>
              <Button onClick={() => form.resetFields()}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 浏览器环境下的路径输入弹窗 */}
      <Modal
        title="输入 GNB 二进制路径"
        open={pathModalVisible}
        onOk={handlePathModalOk}
        onCancel={() => setPathModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Input
          placeholder="例如: D:\gnb\bin"
          value={pathInputValue}
          onChange={(e) => setPathInputValue(e.target.value)}
          onPressEnter={handlePathModalOk}
        />
        <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
          请输入 gnb.exe 所在目录的完整绝对路径
        </div>
      </Modal>
    </PageContainer>
  );
};

export default Settings;
