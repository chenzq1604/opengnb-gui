/**
 * @name 密钥管理页面
 * @description 管理 ed25519 公私钥对，包括生成、查看、导入和导出
 */
import React, { useEffect, useState } from 'react';
import {
  Button,
  Space,
  Tag,
  App,
  Typography,
  Modal,
  Input,
  Popconfirm,
} from 'antd';
import {
  KeyOutlined,
  PlusOutlined,
  ImportOutlined,
  ExportOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
  ProTable,
} from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { cryptoService, configService } from '@/services/gnb';
import type { KeyInfo } from '@/typings';

const { Text } = Typography;

/**
 * @name 密钥管理页面组件
 */
const KeyManage: React.FC = () => {
  const { message } = App.useApp();
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedKey, setSelectedKey] = useState<KeyInfo | null>(null);
  const [importPath, setImportPath] = useState('');
  const [exportPath, setExportPath] = useState('');

  /** 加载密钥列表 */
  const loadKeys = async () => {
    setLoading(true);
    try {
      const dirsResult = await configService.listDirs();
      if (dirsResult.success && dirsResult.dirs && dirsResult.dirs.length > 0) {
        // 从第一个配置目录获取密钥
        const result = await cryptoService.listKeys(dirsResult.dirs[0]);
        if (result.success && result.keys) {
          setKeys(result.keys);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  /** 生成密钥对 */
  const handleGenerate = async () => {
    const dirsResult = await configService.listDirs();
    const dir = dirsResult.dirs?.[0] || 'default';
    const result = await cryptoService.generateKey(dir);
    if (result.success) {
      message.success(result.message);
      loadKeys();
    } else {
      message.error(result.message);
    }
  };

  /** 导入公钥 */
  const handleImport = async () => {
    if (!importPath) {
      message.warning('请输入公钥文件路径');
      return;
    }
    const dirsResult = await configService.listDirs();
    const destDir = dirsResult.dirs?.[0] || 'default';
    const result = await cryptoService.importPublicKey(importPath, destDir);
    if (result.success) {
      message.success(result.message);
      setImportModalVisible(false);
      setImportPath('');
      loadKeys();
    } else {
      message.error(result.message);
    }
  };

  /** 导出公钥 */
  const handleExport = async () => {
    if (!selectedKey || !exportPath) {
      message.warning('请选择密钥并输入导出路径');
      return;
    }
    const result = await cryptoService.exportPublicKey(selectedKey.path, exportPath);
    if (result.success) {
      message.success(result.message);
      setExportModalVisible(false);
      setExportPath('');
      setSelectedKey(null);
    } else {
      message.error(result.message);
    }
  };

  /** 表格列定义 */
  const columns: ProColumns<KeyInfo>[] = [
    {
      title: '密钥名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (_, record) => (
        <Space>
          <KeyOutlined />
          <Text>{record.name}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (_, record) =>
        record.type === 'public' ? (
          <Tag color="blue">公钥</Tag>
        ) : (
          <Tag color="red">私钥</Tag>
        ),
    },
    {
      title: '文件大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (_, record) => `${record.size} bytes`,
    },
    {
      title: '修改时间',
      dataIndex: 'modifiedTime',
      key: 'modifiedTime',
      width: 180,
      render: (_, record) => new Date(record.modifiedTime).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) =>
        record.type === 'public' ? (
          <Button
            size="small"
            icon={<ExportOutlined />}
            onClick={() => {
              setSelectedKey(record);
              setExportModalVisible(true);
            }}
          >
            导出
          </Button>
        ) : (
          <Tag color="orange">受保护</Tag>
        ),
    },
  ];

  return (
    <PageContainer
      header={{
        title: '密钥管理',
        subTitle: '管理 ed25519 公私钥对',
      }}
    >
      <ProTable<KeyInfo>
        columns={columns}
        dataSource={keys}
        rowKey="path"
        loading={loading}
        search={false}
        toolBarRender={() => [
          <Button
            key="generate"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleGenerate}
          >
            生成密钥对
          </Button>,
          <Button
            key="import"
            icon={<ImportOutlined />}
            onClick={() => setImportModalVisible(true)}
          >
            导入公钥
          </Button>,
          <Button key="refresh" icon={<ReloadOutlined />} onClick={loadKeys}>
            刷新
          </Button>,
        ]}
        pagination={false}
      />

      {/* 导入公钥弹窗 */}
      <Modal
        title="导入公钥"
        open={importModalVisible}
        onOk={handleImport}
        onCancel={() => setImportModalVisible(false)}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>公钥文件路径：</Text>
          <Input
            placeholder="请输入公钥文件路径"
            value={importPath}
            onChange={(e) => setImportPath(e.target.value)}
          />
        </div>
      </Modal>

      {/* 导出公钥弹窗 */}
      <Modal
        title="导出公钥"
        open={exportModalVisible}
        onOk={handleExport}
        onCancel={() => setExportModalVisible(false)}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>当前密钥: {selectedKey?.name}</Text>
        </div>
        <div>
          <Text>导出路径：</Text>
          <Input
            placeholder="请输入导出文件路径"
            value={exportPath}
            onChange={(e) => setExportPath(e.target.value)}
          />
        </div>
      </Modal>
    </PageContainer>
  );
};

export default KeyManage;
