/**
 * @name 节点列表页面
 * @description 管理所有 GNB 节点，包括启动/停止/重启节点，查看节点状态
 */
import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  App,
  Popconfirm,
  Typography,
  Tooltip,
  Descriptions,
  Modal,
} from 'antd';
import {
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
// @ts-ignore - umi 运行时导出 history，tsc 静态检查找不到类型定义
import { history } from '@umijs/max';
import {
  PageContainer,
  ProTable,
} from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { gnbService, configService, safeConfigService } from '@/services/gnb';
import type { NodeStatus, SafeConfigSummary } from '@/typings';
import WaitingForIfUpModal from '@/components/WaitingForIfUpModal';

const { Text } = Typography;

/**
 * @name 节点管理页面组件
 */
const NodeManage: React.FC = () => {
  const { message } = App.useApp();
  const [nodes, setNodes] = useState<NodeStatus[]>([]);
  const [configDirs, setConfigDirs] = useState<string[]>([]);
  const [safeConfigs, setSafeConfigs] = useState<SafeConfigSummary[]>([]);
  const [loading, setLoading] = useState(false);
  /** 启动后等待 gnb 自动 if_up 完成的弹窗状态 */
  const [waitingState, setWaitingState] = useState<{ visible: boolean; nodeId: string }>({
    visible: false,
    nodeId: '',
  });
  /** 详细信息弹窗 */
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailNode, setDetailNode] = useState<NodeStatus | null>(null);

  /** 加载节点状态 */
  const loadNodes = async () => {
    setLoading(true);
    try {
      const status = await gnbService.getAllStatus();
      setNodes(status);
    } finally {
      setLoading(false);
    }
  };

  /** 加载配置目录 */
  const loadConfigDirs = async () => {
    const result = await configService.listDirs();
    if (result.success && result.dirs) {
      setConfigDirs(result.dirs);
    }
    // 同时加载 Safe 配置列表
    const safeResult = await safeConfigService.list();
    if (safeResult.success && safeResult.configs) {
      setSafeConfigs(safeResult.configs);
    }
  };

  useEffect(() => {
    loadNodes();
    loadConfigDirs();
    const timer = setInterval(loadNodes, 5000);
    return () => clearInterval(timer);
  }, []);

  /** 停止节点 */
  const handleStop = async (nodeId: string) => {
    const result = await gnbService.stop(nodeId);
    if (result.success) {
      message.success(result.message);
      loadNodes();
    } else {
      message.error(result.message);
    }
  };

  /** 重启节点 */
  const handleRestart = async (nodeId: string) => {
    const result = await gnbService.restart(nodeId);
    if (result.success) {
      message.success(result.message);
      setWaitingState({ visible: true, nodeId });
      loadNodes();
    } else {
      message.error(result.message);
    }
  };

  /** 删除节点 */
  const handleDelete = async (nodeId: string) => {
    const result = await gnbService.remove(nodeId);
    if (result.success) {
      message.success(result.message);
      loadNodes();
    } else {
      message.error(result.message);
    }
  };

  /** 根据 nodeId 推算 TUN 虚拟 IP */
  const getTunIP = (nodeId: string, mode: 'lite' | 'safe'): string => {
    const lastDigit = nodeId.slice(-1);
    return mode === 'safe' ? `172.31.0.${lastDigit}` : `10.1.0.${lastDigit}`;
  };

  /** 获取节点的对端节点信息（显示公网 IP + TUN 虚拟 IP） */
  const getPeerInfo = (record: NodeStatus): React.ReactNode => {
    // 优先使用 gnb_ctl 实时发现的对端节点信息
    if (record.running && record.peerNodes && record.peerNodes.length > 0) {
      return record.peerNodes.map((peer) => (
        <div key={peer.nodeId} style={{ lineHeight: '20px' }}>
          <Text strong style={{ fontSize: 12 }}>{peer.nodeId}</Text>
          {peer.wanIPv4 && <Text type="secondary" style={{ fontSize: 11 }}> {peer.wanIPv4.split(':')[0]}</Text>}
          {peer.tunIPv4 && <Text style={{ fontSize: 11, color: '#52c41a' }}> ({peer.tunIPv4})</Text>}
        </div>
      ));
    }

    // 没有实时信息，回退到静态配置
    if (record.mode === 'safe') {
      // Safe 模式：从 safeConfigs 中查找对端节点的 IP 地址
      const configDir = record.startOptions?.safe?.configDir;
      const config = safeConfigs.find((c) => c.dirName === configDir);
      if (config && config.peerNodes.length > 0) {
        return config.peerNodes.map((nodeId) => {
          const tunIP = getTunIP(nodeId, 'safe');
          return (
            <div key={nodeId} style={{ lineHeight: '20px' }}>
              <Text strong style={{ fontSize: 12 }}>{nodeId}</Text>
              <Text style={{ fontSize: 11, color: '#52c41a' }}> ({tunIP})</Text>
            </div>
          );
        });
      }
      return '-';
    }
    // Lite 模式：从 peerNodeId 获取
    const peerNodeId = record.startOptions?.lite?.peerNodeId;
    if (peerNodeId) {
      const ids = peerNodeId.split(',').map((id) => id.trim()).filter((id) => id);
      return ids.map((id) => {
        const tunIP = getTunIP(id, 'lite');
        return (
          <div key={id} style={{ lineHeight: '20px' }}>
            <Text strong style={{ fontSize: 12 }}>{id}</Text>
            <Text style={{ fontSize: 11, color: '#52c41a' }}> ({tunIP})</Text>
          </div>
        );
      });
    }
    return '-';
  };

  /** 获取节点的 Index 地址 */
  const getIndexInfo = (record: NodeStatus): string => {
    if (record.mode === 'safe') {
      const configDir = record.startOptions?.safe?.configDir;
      const config = safeConfigs.find((c) => c.dirName === configDir);
      if (config && config.indexNodes.length > 0) {
        return config.indexNodes.join(', ');
      }
      return '-';
    }
    return record.startOptions?.lite?.indexAddress || '-';
  };

  /** 表格列定义 */
  const columns: ProColumns<NodeStatus>[] = [
    {
      title: '节点 ID',
      dataIndex: 'nodeId',
      key: 'nodeId',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'running',
      key: 'running',
      width: 90,
      render: (_, record) =>
        record.running ? (
          <Tag icon={<PlayCircleOutlined />} color="success">运行中</Tag>
        ) : (
          <Tag icon={<StopOutlined />} color="default">已停止</Tag>
        ),
    },
    {
      title: '模式',
      dataIndex: 'mode',
      key: 'mode',
      width: 70,
      render: (_, record) =>
        record.mode === 'lite' ? (
          <Tag icon={<ThunderboltOutlined />} color="blue">Lite</Tag>
        ) : (
          <Tag icon={<SafetyOutlined />} color="green">Safe</Tag>
        ),
    },
    {
      title: '对端节点',
      key: 'peerNodes',
      width: 160,
      render: (_, record) => getPeerInfo(record),
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_, record) => (
        <Space>
          {!record.running ? (
            <Tooltip title="启动">
              <Button
                type="primary"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => {
                  // 如果有保存的启动参数，直接用保存的参数启动
                  if (record.startOptions) {
                    gnbService.start(record.startOptions).then((result) => {
                      if (result.success) {
                        message.success(result.message);
                        setWaitingState({ visible: true, nodeId: record.nodeId });
                        loadNodes();
                      } else {
                        message.error(result.message);
                      }
                    });
                  } else {
                    // 没有保存的参数，跳转到 Lite 配置页面
                    history.push('/node/quick-start');
                  }
                }}
              >
                启动
              </Button>
            </Tooltip>
          ) : (
            <Popconfirm
              title="确定要停止该节点吗？"
              onConfirm={() => handleStop(record.nodeId)}
            >
              <Button danger size="small" icon={<StopOutlined />}>
                停止
              </Button>
            </Popconfirm>
          )}
          {record.running && (
            <Tooltip title="重启">
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => handleRestart(record.nodeId)}
              >
                重启
              </Button>
            </Tooltip>
          )}
          <Tooltip title="查看日志">
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => history.push(`/logs?nodeId=${record.nodeId}`)}
            >
              日志
            </Button>
          </Tooltip>
          <Tooltip title="详细">
            <Button
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => { setDetailNode(record); setDetailVisible(true); }}
            >
              详细
            </Button>
          </Tooltip>
          <Popconfirm
            title="确定要删除该节点吗？"
            description={record.running ? '节点正在运行，删除后将先停止再移除' : '删除后将从列表中移除该节点'}
            onConfirm={() => handleDelete(record.nodeId)}
          >
            <Button danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer
      header={{
        title: '节点列表',
        subTitle: '展示 GNB 虚拟网络节点',
      }}
    >
      <ProTable<NodeStatus>
        columns={columns}
        dataSource={nodes}
        rowKey="nodeId"
        loading={loading}
        search={false}
        toolBarRender={() => [
          <Button
            key="add"
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={() => history.push('/node/quick-start')}
          >
            快速启动Lite
          </Button>,
          <Button key="refresh" icon={<ReloadOutlined />} onClick={loadNodes}>
            刷新
          </Button>,
        ]}
        pagination={false}
      />

      {/* 启动后等待 gnb 自动 if_up 完成（约 15 秒）的弹窗 */}
      <WaitingForIfUpModal
        open={waitingState.visible}
        nodeId={waitingState.nodeId}
        onClose={() => setWaitingState({ visible: false, nodeId: '' })}
      />

      {/* 节点详细信息弹窗 */}
      <Modal
        title={`节点 ${detailNode?.nodeId || ''} 详细信息`}
        open={detailVisible}
        onCancel={() => { setDetailVisible(false); setDetailNode(null); }}
        footer={null}
        width={600}
      >
        {detailNode && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="节点 ID">{detailNode.nodeId}</Descriptions.Item>
            <Descriptions.Item label="运行状态">
              {detailNode.running ? <Tag color="success">运行中</Tag> : <Tag color="default">已停止</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="运行模式">
              {detailNode.mode === 'lite' ? <Tag color="blue">Lite</Tag> : <Tag color="green">Safe</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="PID">{detailNode.pid || '-'}</Descriptions.Item>
            <Descriptions.Item label="启动时间">
              {detailNode.startTime ? new Date(detailNode.startTime).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="运行时长">
              {detailNode.running && detailNode.startTime
                ? (() => {
                    const minutes = Math.floor((Date.now() - detailNode.startTime) / 60000);
                    if (minutes < 60) return `${minutes} 分钟`;
                    const hours = Math.floor(minutes / 60);
                    return `${hours} 小时 ${minutes % 60} 分钟`;
                  })()
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Index 地址">{getIndexInfo(detailNode)}</Descriptions.Item>
            <Descriptions.Item label="对端节点">{getPeerInfo(detailNode)}</Descriptions.Item>
            {detailNode.mode === 'lite' && detailNode.startOptions?.lite && (
              <>
                <Descriptions.Item label="Passcode">{detailNode.startOptions.lite.passcode || '-'}</Descriptions.Item>
                <Descriptions.Item label="对端节点 ID">{detailNode.startOptions.lite.peerNodeId || '自动发现'}</Descriptions.Item>
              </>
            )}
            {detailNode.mode === 'safe' && detailNode.startOptions?.safe && (
              <Descriptions.Item label="配置目录">{detailNode.startOptions.safe.configDir}</Descriptions.Item>
            )}
            <Descriptions.Item label="入站流量">
              {detailNode.inBytes !== undefined ? `${(detailNode.inBytes / 1024).toFixed(1)} KB` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="出站流量">
              {detailNode.outBytes !== undefined ? `${(detailNode.outBytes / 1024).toFixed(1)} KB` : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </PageContainer>
  );
};

export default NodeManage;
