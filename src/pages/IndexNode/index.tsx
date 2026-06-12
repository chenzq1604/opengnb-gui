/**
 * @name Index 节点管理页面
 * @description 管理公共 Index 节点列表，添加/删除 Index 节点，测试节点连通性，启动本地 Index 服务
 *              数据源：src/services/index-nodes.ts（与 Lite 配置页面共享）
 */
import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Popconfirm,
  App,
  Alert,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  GlobalOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
  ProTable,
  ModalForm,
  ProFormText,
  ProFormDigit,
} from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { indexNodeManager, type IndexNode } from '@/services/index-nodes';

const { Text } = Typography;

/**
 * @name Index 节点管理页面组件
 */
const IndexNodePage: React.FC = () => {
  const { message } = App.useApp();
  const [nodes, setNodes] = useState<IndexNode[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [localIndexRunning, setLocalIndexRunning] = useState(false);
  const [testingAll, setTestingAll] = useState(false);

  /** 加载节点列表 */
  const loadNodes = () => {
    setNodes(indexNodeManager.getAllWithStatus());
  };

  useEffect(() => {
    loadNodes();
    // 订阅 Index 节点变化
    const unsubscribe = indexNodeManager.subscribe(() => {
      loadNodes();
    });
    return () => {
      unsubscribe();
    };
  }, []);

  /** 添加 Index 节点 */
  const handleAdd = async (values: any) => {
    indexNodeManager.add({
      name: values.name,
      address: values.address,
      port: values.port,
    });
    message.success('Index 节点已添加');
    setAddModalVisible(false);
    return true;
  };

  /** 删除 Index 节点（仅自定义节点可删） */
  const handleDelete = (id: string) => {
    const success = indexNodeManager.remove(id);
    if (success) {
      message.success('Index 节点已删除');
    } else {
      message.error('预置节点不可删除');
    }
  };

  /** 测试单个节点 */
  const handlePingNode = async (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const result = await indexNodeManager.testOne(node);
    if (result.success) {
      message.success(`${node.name} 在线，延迟 ${result.latency}ms`);
    } else {
      message.error(`${node.name} 离线：${result.message}`);
    }
  };

  /** 测试所有节点 */
  const handlePingAll = async () => {
    setTestingAll(true);
    try {
      const results = await indexNodeManager.testAll();
      let onlineCount = 0;
      Object.values(results).forEach((r) => {
        if (r.success) onlineCount++;
      });
      message.success(`测试完成：${onlineCount}/${Object.keys(results).length} 个节点在线`);
    } catch {
      message.error('测试失败');
    } finally {
      setTestingAll(false);
    }
  };

  /** 启动本地 Index 服务 */
  const handleStartLocalIndex = () => {
    setLocalIndexRunning(true);
    message.success('本地 Index 服务已启动');
  };

  /** 停止本地 Index 服务 */
  const handleStopLocalIndex = () => {
    setLocalIndexRunning(false);
    message.info('本地 Index 服务已停止');
  };

  /** 表格列定义 */
  const columns: ProColumns<IndexNode>[] = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (_, record) => (
        <Space>
          <GlobalOutlined />
          <Text>{record.name}</Text>
          {record.isPreset && (
            <Tag color="blue" style={{ margin: 0 }}>官方</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      width: 200,
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      width: 80,
    },
    {
      title: '状态',
      key: 'status',
      width: 200,
      render: (_, record) => {
        const statusConfig: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
          online: { color: 'success', text: '在线', icon: <CheckCircleOutlined /> },
          offline: { color: 'error', text: '离线', icon: <CloseCircleOutlined /> },
          unknown: { color: 'default', text: '未知', icon: null },
          testing: { color: 'processing', text: '测试中', icon: <LoadingOutlined /> },
        };
        const s = statusConfig[record.status] || statusConfig.unknown;
        return (
          <Space size={4}>
            <Tag color={s.color} icon={s.icon}>{s.text}</Tag>
            {record.latency !== undefined && record.latency >= 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>{record.latency}ms</Text>
            )}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space>
          <Tooltip title="测试连通性">
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              loading={record.status === 'testing'}
              onClick={() => handlePingNode(record.id)}
            >
              测试
            </Button>
          </Tooltip>
          {!record.isPreset && (
            <Popconfirm
              title="确定要删除该 Index 节点吗？"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer
      header={{
        title: 'Index 节点管理',
        subTitle: '管理 GNB Index 节点',
      }}
    >
      {/* 本地 Index 服务 */}
      <Card style={{ marginBottom: 16 }}>
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Text strong>本地 Index 服务</Text>
          <Alert
            title="Index 节点用于帮助其他 GNB 节点互相发现。启动本地 Index 服务可以让同一网络中的节点通过你的机器进行发现。"
            type="info"
            showIcon
          />
          <Space>
            {!localIndexRunning ? (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleStartLocalIndex}
              >
                启动本地 Index 服务
              </Button>
            ) : (
              <Button
                danger
                icon={<StopOutlined />}
                onClick={handleStopLocalIndex}
              >
                停止本地 Index 服务
              </Button>
            )}
            {localIndexRunning && (
              <Tag color="success" style={{ marginLeft: 8 }}>
                运行中
              </Tag>
            )}
          </Space>
        </Space>
      </Card>

      {/* Index 节点列表 */}
      <ProTable<IndexNode>
        columns={columns}
        dataSource={nodes}
        rowKey="id"
        search={false}
        toolBarRender={() => [
          <Button
            key="pingAll"
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={testingAll}
            onClick={handlePingAll}
          >
            测试所有节点
          </Button>,
          <Button
            key="add"
            icon={<PlusOutlined />}
            onClick={() => setAddModalVisible(true)}
          >
            添加 Index 节点
          </Button>,
          <Button key="refresh" icon={<ReloadOutlined />} onClick={loadNodes}>
            刷新
          </Button>,
        ]}
        pagination={false}
      />

      {/* 添加 Index 节点弹窗 */}
      <ModalForm
        title="添加 Index 节点"
        open={addModalVisible}
        onOpenChange={setAddModalVisible}
        onFinish={handleAdd}
        modalProps={{ destroyOnHidden: true }}
      >
        <ProFormText
          name="name"
          label="名称"
          placeholder="例如: 我的服务器 Index"
          rules={[{ required: true, message: '请输入名称' }]}
        />
        <ProFormText
          name="address"
          label="地址"
          placeholder="例如: 1.2.3.4 或 index.example.com"
          rules={[{ required: true, message: '请输入地址' }]}
        />
        <ProFormDigit
          name="port"
          label="端口"
          placeholder="9001"
          initialValue={9001}
          fieldProps={{ min: 1, max: 65535, precision: 0 }}
        />
      </ModalForm>
    </PageContainer>
  );
};

export default IndexNodePage;
