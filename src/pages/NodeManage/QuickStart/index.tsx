/**
 * @name Lite 配置页面
 * @description Lite 模式快速启动：配置 nodeid、index 地址、passcode，一键启动；支持历史记录快速重连
 *              Index 节点列表与 Index 节点管理页面实时同步
 */
import React, { useEffect, useState } from 'react';
import { Card, App, Typography, Alert, Input, Select, Space, List, Button, Popconfirm, Empty, Tooltip, Tour } from 'antd';
import {
  ClockCircleOutlined,
  DeleteOutlined,
  ClearOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  InfoCircleOutlined,
  EditOutlined,
} from '@ant-design/icons';
import {
  ProForm,
  ProFormText,
  ProFormDigit,
  ModalForm,
} from '@ant-design/pro-components';
import { PageContainer } from '@ant-design/pro-components';
import { gnbService, historyService } from '@/services/gnb';
import { indexNodeManager, type IndexNode } from '@/services/index-nodes';
import { validateNodeId } from '@/utils/nodeid';
import type { NodeStartOptions, QuickStartHistory } from '@/typings';
import WaitingForIfUpModal from '@/components/WaitingForIfUpModal';

const { Text } = Typography;

/**
 * @name Lite 配置页面组件
 */
const QuickStart: React.FC = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  /** 是否自定义 Index 地址 */
  const [useCustomIndex, setUseCustomIndex] = useState(false);
  /** 选中的预设 Index 地址（默认第一个） */
  const [selectedIndex, setSelectedIndex] = useState<string | undefined>();
  /** 自定义 Index 地址 */
  const [customIndex, setCustomIndex] = useState('');
  /** 历史记录列表 */
  const [historyList, setHistoryList] = useState<QuickStartHistory[]>([]);
  /** 启动后等待 gnb 自动 if_up 完成的弹窗状态 */
  const [waitingState, setWaitingState] = useState<{ visible: boolean; nodeId: string }>({
    visible: false,
    nodeId: '',
  });
  /** Index 节点列表（含预置和自定义） */
  const [indexNodes, setIndexNodes] = useState<IndexNode[]>([]);
  /** 正在测试的节点 ID */
  const [testingId, setTestingId] = useState<string | null>(null);
  /** Lite 模式说明是否已折叠 */
  const [alertCollapsed, setAlertCollapsed] = useState(false);
  /** 编辑弹窗状态 */
  const [editingModalVisible, setEditingModalVisible] = useState(false);
  /** 正在编辑的历史记录 */
  const [editingRecord, setEditingRecord] = useState<QuickStartHistory | null>(null);
  /** 编辑时是否使用自定义 Index */
  const [editingUseCustomIndex, setEditingUseCustomIndex] = useState(false);
  /** 编辑时选中的预设 Index */
  const [editingSelectedIndex, setEditingSelectedIndex] = useState<string | undefined>();
  /** 编辑时自定义 Index 地址 */
  const [editingCustomIndex, setEditingCustomIndex] = useState('');
  /** Lite 新手引导是否打开 */
  const [liteTourOpen, setLiteTourOpen] = useState(false);

  /** 加载历史记录 */
  const loadHistory = async () => {
    const list = await historyService.get();
    setHistoryList(list);
  };

  /** 加载 Index 节点列表 */
  const loadIndexNodes = () => {
    setIndexNodes(indexNodeManager.getAllWithStatus());
  };

  useEffect(() => {
    loadHistory();
    loadIndexNodes();
    // 订阅 Index 节点变化
    const unsubscribe = indexNodeManager.subscribe(() => {
      loadIndexNodes();
    });
    // 2 秒后自动折叠 Lite 模式说明
    const collapseTimer = setTimeout(() => {
      setAlertCollapsed(true);
    }, 2000);
    const tourTimer = setTimeout(() => {
      if (localStorage.getItem('opengnb-tour-lite-done') !== 'true') {
        setLiteTourOpen(true);
      }
    }, 500);
    return () => {
      unsubscribe();
      clearTimeout(collapseTimer);
      clearTimeout(tourTimer);
    };
  }, []);

  /**
   * @name 关闭 Lite 新手引导
   */
  const closeLiteTour = () => {
    localStorage.setItem('opengnb-tour-lite-done', 'true');
    setLiteTourOpen(false);
  };

  // 首次加载时设置默认 Index
  useEffect(() => {
    if (!selectedIndex && indexNodes.length > 0) {
      // 优先选第一个在线的；没有在线就选第一个
      const firstOnline = indexNodes.find((n) => n.status === 'online');
      const first = firstOnline || indexNodes[0];
      if (first) {
        setSelectedIndex(`${first.address}/${first.port}`);
      }
    }
  }, [indexNodes, selectedIndex]);

  /** 测试单个 Index 节点 */
  const handleTestIndex = async (node: IndexNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setTestingId(node.id);
    try {
      const result = await indexNodeManager.testOne(node);
      if (result.success) {
        message.success(`${node.name} 在线，延迟 ${result.latency}ms`);
      } else {
        message.error(`${node.name} 离线：${result.message}`);
      }
    } finally {
      setTestingId(null);
    }
  };

  /** 提交快速启动表单 */
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      // 校验 nodeid
      const validation = validateNodeId(values.nodeId);
      if (!validation.valid) {
        message.error(validation.message || '节点 ID 非法');
        return;
      }

      const finalIndexAddress = useCustomIndex ? customIndex : (selectedIndex || '');

      if (!finalIndexAddress) {
        message.error('请选择或输入 Index 地址');
        return;
      }

      const options: NodeStartOptions = {
        nodeId: validation.normalized!,
        mode: 'lite',
        lite: {
          indexAddress: finalIndexAddress,
          passcode: values.passcode || '',
          peerNodeId: values.peerNodeId || undefined,
        },
      };

      const result = await gnbService.start(options);
      if (result.success) {
        message.success(result.message);
        setWaitingState({ visible: true, nodeId: validation.normalized! });
        loadHistory(); // 刷新历史记录
      } else {
        message.error(result.message);
      }
    } finally {
      setLoading(false);
    }
  };

  /** 从历史记录快速启动 */
  const handleQuickStart = async (record: QuickStartHistory) => {
    setLoading(true);
    try {
      const options: NodeStartOptions = {
        nodeId: record.nodeId,
        mode: 'lite',
        lite: {
          indexAddress: record.indexAddress,
          passcode: record.passcode,
        },
      };
      const result = await gnbService.start(options);
      if (result.success) {
        message.success(result.message);
        setWaitingState({ visible: true, nodeId: record.nodeId });
        loadHistory();
      } else {
        message.error(result.message);
      }
    } finally {
      setLoading(false);
    }
  };

  /** 删除单条历史记录 */
  const handleDeleteHistory = async (id: string) => {
    await historyService.remove(id);
    loadHistory();
    message.success('已删除');
  };

  /** 清空历史记录 */
  const handleClearHistory = async () => {
    await historyService.clear();
    loadHistory();
    message.success('已清空');
  };

  /** 编辑历史记录 */
  const handleEditHistory = (item: QuickStartHistory) => {
    setEditingRecord(item);
    // 检查indexAddress是否在预设的index节点列表中
    const isPresetIndex = indexNodes.some(node => `${node.address}/${node.port}` === item.indexAddress);
    if (isPresetIndex) {
      setEditingUseCustomIndex(false);
      setEditingSelectedIndex(item.indexAddress);
      setEditingCustomIndex('');
    } else {
      setEditingUseCustomIndex(true);
      setEditingSelectedIndex(undefined);
      setEditingCustomIndex(item.indexAddress);
    }
    setEditingModalVisible(true);
  };

  /** 提交编辑历史记录 */
  const handleEditSubmit = async (values: any) => {
    if (!editingRecord) return false;
    const validation = validateNodeId(values.nodeId);
    if (!validation.valid) {
      message.error(validation.message || '节点 ID 非法');
      return false;
    }
    const finalIndexAddress = editingUseCustomIndex ? editingCustomIndex : (editingSelectedIndex || '');
    if (!finalIndexAddress) {
      message.error('请选择或输入 Index 地址');
      return false;
    }
    // 更新历史记录
    await historyService.update({
      ...editingRecord,
      nodeId: validation.normalized!,
      indexAddress: finalIndexAddress,
      passcode: values.passcode || '',
      peerNodeId: values.peerNodeId || undefined,
      lastUsedAt: Date.now(), // 更新最后使用时间
    });
    message.success('历史记录已更新');
    setEditingModalVisible(false);
    loadHistory(); // 刷新历史列表
    return true;
  };

  /** 格式化时间 */
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  /**
   * @name 渲染单个 Index 节点下拉项
   * @param node Index 节点
   */
  const renderIndexOption = (node: IndexNode) => (
    <Select.Option key={node.id} value={`${node.address}/${node.port}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background:
              node.status === 'online' ? '#52c41a' :
              node.status === 'offline' ? '#ff4d4f' :
              node.status === 'testing' ? '#1677ff' : '#bfbfbf',
          }}
        />
        <span style={{ flex: 1 }}>{node.name}</span>
        {node.isPreset ? (
          <span style={{ color: '#1677ff', fontSize: 11, border: '1px solid #1677ff', padding: '0 4px', borderRadius: 2 }}>官方</span>
        ) : (
          <span style={{ color: '#722ed1', fontSize: 11, border: '1px solid #722ed1', padding: '0 4px', borderRadius: 2 }}>自定义</span>
        )}
        {node.status === 'testing' ? (
          <LoadingOutlined />
        ) : node.latency !== undefined && node.latency >= 0 ? (
          <span style={{ color: '#999', fontSize: 12 }}>{node.latency}ms</span>
        ) : null}
        <Tooltip title="测试连通性">
          <Button
            type="text"
            size="small"
            icon={<ThunderboltOutlined />}
            loading={testingId === node.id}
            onClick={(e) => handleTestIndex(node, e)}
          />
        </Tooltip>
      </div>
    </Select.Option>
  );

  // Index 选项：在线的优先 + 颜色标记
  const onlineNodes = indexNodes.filter((n) => n.status === 'online');
  const otherNodes = indexNodes.filter((n) => n.status !== 'online');

  /** Lite 新手引导步骤 */
  const liteTourSteps = [
    {
      title: '欢迎使用 Lite 快速模式',
      description: 'Lite 模式是最简单的连接方式，只需填写几个参数即可建立虚拟网络。',
      target: null,
    },
    {
      title: '填写节点ID',
      description: '输入您的节点ID，例如 1001。节点ID是您在虚拟网络中的唯一标识。',
      target: () => document.getElementById('lite-node-id') || document.body,
    },
    {
      title: '配置连接参数',
      description: '选择一个 Index 服务器地址，输入 Passcode。同一网络中的节点需要使用相同的 Passcode。',
      target: () => document.getElementById('lite-index-passcode') || document.body,
    },
    {
      title: '启动节点',
      description: '点击启动按钮，节点将开始运行。启动后可在仪表盘查看连接状态和流量信息。',
      target: () => document.getElementById('lite-start-button') || document.body,
    },
  ];

  return (
    <PageContainer
      header={{
        title: '快速配置',
        subTitle: 'Lite 模式快速配置与启动',
        extra: [
          <Button key="tour" icon={<InfoCircleOutlined />} onClick={() => setLiteTourOpen(true)}>
            新手引导
          </Button>,
        ],
      }}
    >
      <Card style={{ maxWidth: 700 }}>
        <div style={{ position: 'relative' }}>
          {!alertCollapsed ? (
            <Alert
              type="info"
              showIcon
              message="Lite 模式说明"
              description="Lite 模式适合快速连接，只需配置节点 ID、Index 地址和 Passcode 即可启动。适用于临时连接和测试场景。"
              style={{ marginBottom: 24 }}
            />
          ) : (
            <Tooltip
              title="Lite 模式适合快速连接，只需配置节点 ID、Index 地址和 Passcode 即可启动。适用于临时连接和测试场景。"
              placement="leftTop"
            >
              <InfoCircleOutlined
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  fontSize: 16,
                  color: '#1677ff',
                  cursor: 'pointer',
                  zIndex: 1,
                }}
              />
            </Tooltip>
          )}
        </div>

        <ProForm
          onFinish={handleSubmit}
          submitter={{
            searchConfig: { submitText: '启动节点' },
            render: (_, dom) => <div id="lite-start-button">{dom}</div>,
          }}
        >
          <ProFormDigit
            name="nodeId"
            label="节点 ID"
            placeholder="例如: 1001"
            tooltip="4-10 位数字，不能以 0 开头。例如: 1001, 12345"
            rules={[
              { required: true, message: '请输入节点 ID' },
              {
                validator: async (_: any, value: any) => {
                  if (value === undefined || value === null || value === '') {
                    return Promise.resolve();
                  }
                  const r = validateNodeId(String(value));
                  if (!r.valid) {
                    return Promise.reject(new Error(r.message));
                  }
                  return Promise.resolve();
                },
              },
            ]}
            fieldProps={{ id: 'lite-node-id', min: 1000, max: 9999999999, precision: 0, controls: false }}
          />

          <div id="lite-index-passcode">
            {/* Index 地址选择区域 */}
            <div style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 8 }}>
              <Text strong>Index 地址</Text>
              <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                Index 节点帮助你的电脑找到对方
              </Text>
            </div>

            {!useCustomIndex ? (
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="请选择 Index 节点"
                  value={selectedIndex}
                  onChange={(val) => setSelectedIndex(val)}
                  allowClear
                  optionFilterProp="value"
                  listHeight={400}
                >
                  {onlineNodes.length > 0 && (
                    <Select.OptGroup
                      label={
                        <span style={{ color: '#52c41a', fontWeight: 600 }}>
                          ● 在线 ({onlineNodes.length})
                        </span>
                      }
                    >
                      {onlineNodes.map((node) => renderIndexOption(node))}
                    </Select.OptGroup>
                  )}
                  {otherNodes.length > 0 && (
                    <Select.OptGroup
                      label={
                        <span style={{ color: '#999', fontWeight: 600 }}>
                          离线/未知 ({otherNodes.length})
                        </span>
                      }
                    >
                      {otherNodes.map((node) => renderIndexOption(node))}
                    </Select.OptGroup>
                  )}
                </Select>
                <a onClick={() => { setUseCustomIndex(true); setSelectedIndex(undefined); }}>
                  自定义 Index 地址...
                </a>
              </Space>
            ) : (
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Input
                  placeholder="例如: 1.2.3.4/9001"
                  value={customIndex}
                  onChange={(e) => setCustomIndex(e.target.value)}
                />
                <a onClick={() => { setUseCustomIndex(false); setCustomIndex(''); }}>
                  ← 返回选择预设 Index
                </a>
              </Space>
            )}
          </div>

            <ProFormText
              name="passcode"
              label="Passcode"
              placeholder="4-8位纯数字，用于加密通信"
              tooltip="相同 Passcode 的节点之间会自动建立安全通信"
              rules={[
                { required: true, message: '请输入 Passcode' },
                { pattern: /^[0-9]{4,8}$/, message: '请输入 4-8 位纯数字' },
              ]}
            />
          </div>

          <ProFormText
            name="peerNodeId"
            label="对端节点 ID"
            placeholder="可选，多个用逗号分隔，如: 1002,1003"
            tooltip="可选，指定要直接连接的对端节点 ID，多个用逗号分隔"
          />
        </ProForm>
      </Card>

      {/* 历史记录 */}
      <Card
        title="快速启动历史"
        style={{ marginTop: 16, maxWidth: 700 }}
        extra={
          historyList.length > 0 && (
            <Popconfirm title="确定要清空所有历史记录吗？" onConfirm={handleClearHistory}>
              <Button type="text" danger icon={<ClearOutlined />}>
                清空
              </Button>
            </Popconfirm>
          )
        }
      >
        {historyList.length === 0 ? (
          <Empty description="暂无历史记录" />
        ) : (
          <List
            dataSource={historyList}
            renderItem={(item) => (
              <List.Item
                key={item.id}
                actions={[
                <Button
                  key="start"
                  type="link"
                  icon={<PlayCircleOutlined />}
                  onClick={() => handleQuickStart(item)}
                >
                  启动
                </Button>,
                <Button
                  key="edit"
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => handleEditHistory(item)}
                >
                  编辑
                </Button>,
                <Popconfirm
                  key="delete"
                  title="确定要删除这条记录吗？"
                  onConfirm={() => handleDeleteHistory(item.id)}
                >
                  <Button type="link" danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>,
              ]}
              >
                <List.Item.Meta
                  avatar={<ClockCircleOutlined style={{ fontSize: 20, color: '#1677ff' }} />}
                  title={
                    <Space>
                      <Text strong>节点 {item.nodeId}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{item.indexAddress}</Text>
                    </Space>
                  }
                  description={
                    <Space split="·">
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        最后使用: {formatTime(item.lastUsedAt)}
                      </Text>
                      {item.passcode && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Passcode: {item.passcode}
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 编辑历史记录弹窗 */}
      <ModalForm
        title="编辑快速启动历史"
        open={editingModalVisible}
        onOpenChange={setEditingModalVisible}
        onFinish={handleEditSubmit}
        initialValues={editingRecord ? {
          nodeId: editingRecord.nodeId,
          passcode: editingRecord.passcode,
          peerNodeId: editingRecord.peerNodeId,
        } : {}}
        modalProps={{ destroyOnHidden: true }}
      >
        <ProFormDigit
          name="nodeId"
          label="节点 ID"
          placeholder="例如: 1001"
          tooltip="4-10 位数字，不能以 0 开头。例如: 1001, 12345"
          rules={[
            { required: true, message: '请输入节点 ID' },
            {
              validator: async (_: any, value: any) => {
                if (value === undefined || value === null || value === '') {
                  return Promise.resolve();
                }
                const r = validateNodeId(String(value));
                if (!r.valid) {
                  return Promise.reject(new Error(r.message));
                }
                return Promise.resolve();
              },
            },
          ]}
          fieldProps={{ min: 1000, max: 9999999999, precision: 0, controls: false }}
        />
        {/* Index 地址选择区域 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8 }}>
            <Text strong>Index 地址</Text>
            <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              Index 节点帮助你的电脑找到对方
            </Text>
          </div>
          {!editingUseCustomIndex ? (
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Select
                style={{ width: '100%' }}
                placeholder="请选择 Index 节点"
                value={editingSelectedIndex}
                onChange={(val) => setEditingSelectedIndex(val)}
                allowClear
                optionFilterProp="value"
                listHeight={400}
              >
                {onlineNodes.length > 0 && (
                  <Select.OptGroup
                    label={
                      <span style={{ color: '#52c41a', fontWeight: 600 }}>
                        ● 在线 ({onlineNodes.length})
                      </span>
                    }
                  >
                    {onlineNodes.map((node) => renderIndexOption(node))}
                  </Select.OptGroup>
                )}
                {otherNodes.length > 0 && (
                  <Select.OptGroup
                    label={
                      <span style={{ color: '#999', fontWeight: 600 }}>
                        离线/未知 ({otherNodes.length})
                      </span>
                    }
                  >
                    {otherNodes.map((node) => renderIndexOption(node))}
                  </Select.OptGroup>
                )}
              </Select>
              <a onClick={() => { setEditingUseCustomIndex(true); setEditingSelectedIndex(undefined); }}>
                自定义 Index 地址...
              </a>
            </Space>
          ) : (
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Input
                placeholder="例如: 1.2.3.4/9001"
                value={editingCustomIndex}
                onChange={(e) => setEditingCustomIndex(e.target.value)}
              />
              <a onClick={() => { setEditingUseCustomIndex(false); setEditingCustomIndex(''); }}>
                ← 返回选择预设 Index
              </a>
            </Space>
          )}
        </div>
        <ProFormText
          name="passcode"
          label="Passcode"
          placeholder="4-8位纯数字，用于加密通信"
          tooltip="相同 Passcode 的节点之间会自动建立安全通信"
          rules={[
            { required: true, message: '请输入 Passcode' },
            { pattern: /^[0-9]{4,8}$/, message: '请输入 4-8 位纯数字' },
          ]}
        />
        <ProFormText
          name="peerNodeId"
          label="对端节点 ID"
          placeholder="可选，多个用逗号分隔，如: 1002,1003"
          tooltip="可选，指定要直接连接的对端节点 ID，多个用逗号分隔"
        />
      </ModalForm>

      <WaitingForIfUpModal
        open={waitingState.visible}
        nodeId={waitingState.nodeId}
        onClose={() => setWaitingState({ visible: false, nodeId: '' })}
      />
      <Tour
        open={liteTourOpen}
        onClose={closeLiteTour}
        steps={liteTourSteps}
        scrollIntoViewOptions
      />
    </PageContainer>
  );
};

export default QuickStart;
