/**
 * @name Safe 配置管理页面
 * @description 管理 Safe 模式下的节点配置，包括 node.conf、address.conf、route.conf 和密钥文件
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Button,
  Space,
  Tag,
  App,
  Popconfirm,
  Drawer,
  Tabs,
  Form,
  Input,
  Select,
  InputNumber,
  Table,
  Typography,
  Tooltip,
  Divider,
  Card,
  Modal,
  Tour,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  KeyOutlined,
  MinusCircleOutlined,
  SafetyOutlined,
  SaveOutlined,
  CopyOutlined,
  EyeOutlined,
  FileAddOutlined,
  ThunderboltOutlined,
  LoadingOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
  ProTable,
  ModalForm,
  ProFormText,
  ProFormDigit,
} from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { safeConfigService, gnbService } from '@/services/gnb';
import { indexNodeManager, type IndexNode } from '@/services/index-nodes';
import type {
  SafeConfigSummary,
  SafeConfigDetail,
  NodeConfData,
  AddressEntry,
  RouteEntry,
  SafeKeyFileInfo,
} from '@/typings';

const { Text } = Typography;

/** on/off 开关选项 */
const ON_OFF_OPTIONS = [
  { label: 'on', value: 'on' },
  { label: 'off', value: 'off' },
];

/** 网卡驱动选项 */
const IF_DRV_OPTIONS = [
  { label: 'wintun (推荐)', value: 'wintun' },
  { label: 'tap-windows', value: 'tap-windows' },
];

/** 日志级别选项（GNB 使用数字 1-5） */
const LOG_LEVEL_OPTIONS = [
  { label: '1 - ERROR', value: '1' },
  { label: '2 - WARN', value: '2' },
  { label: '3 - INFO', value: '3' },
  { label: '4 - DEBUG', value: '4' },
  { label: '5 - TRACE', value: '5' },
];

/**
 * @name 渲染 on/off 标签
 * @param value on/off 字符串
 */
const renderOnOffTag = (value: string | undefined) => {
  if (value === 'on') return <Tag color="green">on</Tag>;
  return <Tag>off</Tag>;
};

/**
 * @name Safe 配置管理页面组件
 */
const SafeConfig: React.FC = () => {
  const { message } = App.useApp();
  /** 配置列表数据 */
  const [configs, setConfigs] = useState<SafeConfigSummary[]>([]);
  /** 表格加载状态 */
  const [tableLoading, setTableLoading] = useState(false);
  /** 新建配置弹窗可见性 */
  const [createModalVisible, setCreateModalVisible] = useState(false);
  /** 编辑抽屉可见性 */
  const [drawerVisible, setDrawerVisible] = useState(false);
  /** 当前编辑的配置详情 */
  const [currentDetail, setCurrentDetail] = useState<SafeConfigDetail | null>(null);
  /** 当前编辑的 dirName */
  const [currentDirName, setCurrentDirName] = useState<string>('');
  /** 详情加载状态 */
  const [detailLoading, setDetailLoading] = useState(false);
  /** 保存中状态 */
  const [saving, setSaving] = useState(false);
  /** 密钥生成中状态 */
  const [genKeyLoading, setGenKeyLoading] = useState(false);
  /** 密钥查看/编辑弹窗可见性 */
  const [keyModalVisible, setKeyModalVisible] = useState(false);
  /** 当前查看/编辑的密钥文件路径 */
  const [currentKeyPath, setCurrentKeyPath] = useState('');
  /** 当前查看/编辑的密钥文件名 */
  const [currentKeyName, setCurrentKeyName] = useState('');
  /** 当前密钥内容 */
  const [currentKeyContent, setCurrentKeyContent] = useState('');
  /** 当前密钥是否为私钥（私钥只读） */
  const [currentKeyIsPrivate, setCurrentKeyIsPrivate] = useState(false);
  /** 密钥内容加载中 */
  const [keyContentLoading, setKeyContentLoading] = useState(false);
  /** 新增公钥弹窗可见性 */
  const [addPubKeyModalVisible, setAddPubKeyModalVisible] = useState(false);
  /** 新增公钥的目标目录（security 或 ed25519） */
  const [addPubKeyDir, setAddPubKeyDir] = useState<'security' | 'ed25519'>('ed25519');
  /** 新增公钥表单 */
  const [addPubKeyForm] = Form.useForm();
  /** Index 节点列表（含预置和自定义，含在线状态） */
  const [indexNodes, setIndexNodes] = useState<IndexNode[]>([]);
  /** 正在测试的 Index 节点 ID */
  const [testingId, setTestingId] = useState<string | null>(null);
  /** Safe 新手引导是否打开 */
  const [safeTourOpen, setSafeTourOpen] = useState(false);
  /** 编辑抽屉当前激活的配置页签 */
  const [activeTabKey, setActiveTabKey] = useState('nodeConf');

  /** 基础配置表单实例 */
  const [nodeConfForm] = Form.useForm();
  /** 地址配置数据 */
  const [addressData, setAddressData] = useState<AddressEntry[]>([]);
  /** Index 服务器地址（格式: address/port） */
  const [indexAddress, setIndexAddress] = useState<string>('');
  /** Node 对端节点地址列表 */
  const [nodeAddresses, setNodeAddresses] = useState<AddressEntry[]>([]);
  /** 路由配置数据 */
  const [routeData, setRouteData] = useState<RouteEntry[]>([]);

  /** 加载配置列表 */
  const loadConfigs = useCallback(async () => {
    setTableLoading(true);
    try {
      const result = await safeConfigService.list();
      if (result.success && result.configs) {
        setConfigs(result.configs);
      } else {
        message.error(result.message || '获取配置列表失败');
      }
    } finally {
      setTableLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadConfigs();
    // 加载 Index 节点列表
    setIndexNodes(indexNodeManager.getAllWithStatus());
    const unsubscribe = indexNodeManager.subscribe(() => {
      setIndexNodes(indexNodeManager.getAllWithStatus());
    });
    const tourTimer = setTimeout(() => {
      if (localStorage.getItem('opengnb-tour-safe-done') !== 'true') {
        setSafeTourOpen(true);
      }
    }, 500);
    return () => {
      unsubscribe();
      clearTimeout(tourTimer);
    };
  }, [loadConfigs]);

  /**
   * @name 关闭 Safe 新手引导
   */
  const closeSafeTour = () => {
    localStorage.setItem('opengnb-tour-safe-done', 'true');
    setSafeTourOpen(false);
  };

  /**
   * @name 根据 Safe 新手引导步骤切换配置页签
   * @param current 当前步骤索引
   */
  const handleSafeTourChange = (current: number) => {
    if (current === 2) setActiveTabKey('keyManage');
    if (current === 3 || current === 6) setActiveTabKey('addressConf');
    if (current === 4) setActiveTabKey('routeConf');
  };

  /**
   * @name 打开编辑抽屉并加载详情
   * @param dirName 配置目录名
   */
  const handleEdit = async (dirName: string) => {
    setCurrentDirName(dirName);
    setActiveTabKey('nodeConf');
    setDrawerVisible(true);
    setDetailLoading(true);
    try {
      const result = await safeConfigService.get(dirName);
      if (result.success && result.detail) {
        const detail = result.detail;
        setCurrentDetail(detail);
        nodeConfForm.setFieldsValue(detail.nodeConf);
        setAddressData(detail.addressConf || []);
        // 拆分 Index 和 Node 地址
        const addrList = detail.addressConf || [];
        const indexEntry = addrList.find((e) => e.type === 'i');
        if (indexEntry) {
          setIndexAddress(`${indexEntry.address}/${indexEntry.port}`);
        } else {
          setIndexAddress('');
        }
        setNodeAddresses(addrList.filter((e) => e.type === 'n'));
        setRouteData(detail.routeConf || []);
      } else {
        message.error(result.message || '获取配置详情失败');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * @name 保存配置
   */
  const handleSave = async () => {
    try {
      const nodeConfValues = await nodeConfForm.validateFields();
      setSaving(true);
      // 合并 Index + Node 地址
      const mergedAddress: AddressEntry[] = [];
      if (indexAddress) {
        const parts = indexAddress.split('/');
        mergedAddress.push({ type: 'i', index: 0, address: parts[0], port: parseInt(parts[1] || '9001', 10) });
      }
      mergedAddress.push(...nodeAddresses);
      const data = {
        nodeConf: nodeConfValues as NodeConfData,
        addressConf: mergedAddress,
        routeConf: routeData,
      };
      const result = await safeConfigService.save(currentDirName, data);
      if (result.success) {
        message.success('配置保存成功');
        loadConfigs();
      } else {
        message.error(result.message || '保存失败');
      }
    } catch (err: any) {
      if (err.errorFields) {
        message.warning('请检查表单填写是否正确');
      } else {
        message.error(err.message || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  /**
   * @name 删除配置
   * @param dirName 配置目录名
   */
  const handleDelete = async (dirName: string) => {
    const result = await safeConfigService.delete(dirName);
    if (result.success) {
      message.success('配置已删除');
      loadConfigs();
    } else {
      message.error(result.message || '删除失败');
    }
  };

  /**
   * @name 启动 Safe 模式节点
   * @param record 配置摘要记录
   */
  const handleStart = async (record: SafeConfigSummary) => {
    const result = await gnbService.start({
      nodeId: record.nodeId,
      mode: 'safe',
      safe: { configDir: record.dirName },
    });
    if (result.success) {
      message.success(result.message);
    } else {
      message.error(result.message);
    }
  };

  /**
   * @name 生成密钥对（已有密钥时需确认覆盖）
   */
  const handleGenKey = async () => {
    // 检查是否已有密钥
    const existingKeys = await safeConfigService.hasExistingKeys(currentDirName);
    if (existingKeys.security) {
      return new Promise<void>((resolve) => {
        Modal.confirm({
          title: '密钥已存在',
          content: 'Security 目录下已有密钥文件，生成新密钥将覆盖原有密钥。如果原有公钥已分发给对端节点，覆盖后将导致通信失败。确定要覆盖吗？',
          okText: '确认覆盖',
          okType: 'danger',
          cancelText: '取消',
          onOk: async () => {
            await doGenKey();
            resolve();
          },
          onCancel: () => resolve(),
        });
      });
    }
    await doGenKey();
  };

  /**
   * @name 执行密钥生成
   */
  const doGenKey = async () => {
    const nodeId = currentDetail?.nodeConf?.nodeid || '';
    if (!nodeId) {
      message.error('无法获取节点ID，请先保存基础配置');
      return;
    }
    setGenKeyLoading(true);
    try {
      const result = await safeConfigService.genKey(currentDirName, nodeId);
      if (result.success) {
        message.success(result.message || '密钥生成成功');
        // 重新加载详情以刷新密钥列表
        const detailResult = await safeConfigService.get(currentDirName);
        if (detailResult.success && detailResult.detail) {
          setCurrentDetail(detailResult.detail);
        }
      } else {
        message.error(result.message || '密钥生成失败');
      }
    } finally {
      setGenKeyLoading(false);
    }
  };

  /**
   * @name 新建配置（创建后自动生成密钥对）
   */
  const handleCreate = async (values: any) => {
    const result = await safeConfigService.create(values.nodeId, {
      listen: String(values.listen),
      passcode: values.passcode,
      'console-log-level': '2',
      'index-log-level': '2',
      'node-log-level': '2',
      'if-dump': 'off',
    }, values.indexAddress);
    if (result.success) {
      // 自动生成密钥对（Safe 模式必须）
      const keyResult = await safeConfigService.genKey(result.dirName, values.nodeId);
      if (keyResult.success) {
        message.success('配置创建成功，密钥对已自动生成');
      } else {
        message.warning(`配置创建成功，但密钥生成失败：${keyResult.message}，请手动生成密钥对`);
      }
      setCreateModalVisible(false);
      loadConfigs();
      return true;
    } else {
      message.error(result.message || '创建失败');
      return false;
    }
  };

  /**
   * @name 关闭抽屉
   */
  const handleDrawerClose = () => {
    setDrawerVisible(false);
    setCurrentDetail(null);
    setCurrentDirName('');
    nodeConfForm.resetFields();
    setAddressData([]);
    setIndexAddress('');
    setNodeAddresses([]);
    setRouteData([]);
  };

  /**
   * @name 点击密钥文件名，查看/编辑内容
   * @param keyInfo 密钥文件信息
   */
  const handleKeyClick = async (keyInfo: SafeKeyFileInfo) => {
    setCurrentKeyPath(keyInfo.path);
    setCurrentKeyName(keyInfo.name);
    setCurrentKeyIsPrivate(keyInfo.type === 'private');
    setKeyModalVisible(true);
    setKeyContentLoading(true);
    try {
      const result = await safeConfigService.readKey(keyInfo.path);
      if (result.success && result.content !== undefined) {
        setCurrentKeyContent(result.content);
      } else {
        message.error(result.message || '读取密钥失败');
        setCurrentKeyContent('');
      }
    } finally {
      setKeyContentLoading(false);
    }
  };

  /**
   * @name 保存密钥文件内容
   */
  const handleKeySave = async () => {
    const result = await safeConfigService.writeKey(currentKeyPath, currentKeyContent);
    if (result.success) {
      message.success('密钥内容已保存');
      setKeyModalVisible(false);
    } else {
      message.error(result.message || '保存失败');
    }
  };

  /**
   * @name 复制密钥内容到剪贴板
   */
  const handleKeyCopy = () => {
    navigator.clipboard.writeText(currentKeyContent).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  /**
   * @name 删除密钥文件
   * @param keyInfo 密钥文件信息
   */
  const handleKeyDelete = async (keyInfo: SafeKeyFileInfo) => {
    const result = await safeConfigService.deleteKey(keyInfo.path);
    if (result.success) {
      message.success('密钥文件已删除');
      // 重新加载详情
      const detailResult = await safeConfigService.get(currentDirName);
      if (detailResult.success && detailResult.detail) {
        setCurrentDetail(detailResult.detail);
      }
    } else {
      message.error(result.message || '删除失败');
    }
  };

  /**
   * @name 打开新增公钥弹窗
   * @param dir 目标目录（security 或 ed25519）
   */
  const handleAddPubKey = (dir: 'security' | 'ed25519') => {
    setAddPubKeyDir(dir);
    setAddPubKeyModalVisible(true);
    addPubKeyForm.resetFields();
  };

  /**
   * @name 提交新增公钥
   */
  const handleAddPubKeySubmit = async (values: any) => {
    const dirPath = currentDetail?.dirPath;
    if (!dirPath) return false;
    const keyPath = `${dirPath}/${addPubKeyDir}/${values.fileName}`;
    const result = await safeConfigService.writeKey(keyPath, values.content);
    if (result.success) {
      message.success('公钥已添加');
      setAddPubKeyModalVisible(false);
      // 重新加载详情
      const detailResult = await safeConfigService.get(currentDirName);
      if (detailResult.success && detailResult.detail) {
        setCurrentDetail(detailResult.detail);
      }
      return true;
    } else {
      message.error(result.message || '添加失败');
      return false;
    }
  };

  /**
   * @name 添加地址条目（旧方法，保留兼容）
   */
  const handleAddAddress = () => {
    setAddressData([...addressData, { type: 'i', index: addressData.length, address: '', port: 9001 }]);
  };

  /**
   * @name 测试单个 Index 节点连通性
   * @param node Index 节点
   * @param e 点击事件
   */
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

  /** Index 节点分组：在线 / 离线+未知 */
  const onlineNodes = indexNodes.filter((n) => n.status === 'online');
  const otherNodes = indexNodes.filter((n) => n.status !== 'online');

  /**
   * @name Index 服务器切换确认
   * @param newAddress 新选择的 Index 地址
   */
  const handleIndexChange = (newAddress: string) => {
    if (newAddress === indexAddress) return;
    Modal.confirm({
      title: '确认切换 Index 服务器',
      content: `将 Index 服务器从 ${indexAddress || '无'} 切换为 ${newAddress}，确定吗？`,
      okText: '确认切换',
      cancelText: '取消',
      onOk: () => {
        setIndexAddress(newAddress);
      },
    });
  };

  /**
   * @name 添加 Node 对端节点
   */
  const handleAddNode = () => {
    setNodeAddresses([...nodeAddresses, { type: 'n', nodeId: '', address: '', port: 9001 }]);
  };

  /**
   * @name 删除 Node 对端节点
   * @param index 条目索引
   */
  const handleRemoveNode = (index: number) => {
    setNodeAddresses(nodeAddresses.filter((_, i) => i !== index));
  };

  /**
   * @name 更新 Node 对端节点字段
   * @param index 条目索引
   * @param field 字段名
   * @param value 新值
   */
  const handleNodeChange = (index: number, field: keyof AddressEntry, value: any) => {
    const newData = [...nodeAddresses];
    newData[index] = { ...newData[index], [field]: value };
    setNodeAddresses(newData);
  };

  /**
   * @name 删除地址条目
   * @param index 条目索引
   */
  const handleRemoveAddress = (index: number) => {
    setAddressData(addressData.filter((_, i) => i !== index));
  };

  /**
   * @name 更新地址条目字段
   * @param index 条目索引
   * @param field 字段名
   * @param value 新值
   */
  const handleAddressChange = (index: number, field: keyof AddressEntry, value: any) => {
    const newData = [...addressData];
    newData[index] = { ...newData[index], [field]: value };
    setAddressData(newData);
  };

  /**
   * @name 添加路由条目
   */
  const handleAddRoute = () => {
    setRouteData([...routeData, { nodeId: '', virtualIP: '', subnetMask: '255.255.0.0' }]);
  };

  /**
   * @name 删除路由条目
   * @param index 条目索引
   */
  const handleRemoveRoute = (index: number) => {
    setRouteData(routeData.filter((_, i) => i !== index));
  };

  /**
   * @name 更新路由条目字段
   * @param index 条目索引
   * @param field 字段名
   * @param value 新值
   */
  const handleRouteChange = (index: number, field: keyof RouteEntry, value: any) => {
    const newData = [...routeData];
    newData[index] = { ...newData[index], [field]: value };
    setRouteData(newData);
  };

  /** 表格列定义 */
  const columns: ProColumns<SafeConfigSummary>[] = [
    {
      title: '节点ID',
      dataIndex: 'nodeId',
      key: 'nodeId',
      width: 100,
    },
    {
      title: '监听端口',
      dataIndex: 'listen',
      key: 'listen',
      width: 100,
    },
    {
      title: 'Multi-Socket',
      dataIndex: 'multiSocket',
      key: 'multiSocket',
      width: 110,
      render: (_, record) => renderOnOffTag(record.multiSocket),
    },
    {
      title: 'PF-Crypto',
      dataIndex: 'pfCrypto',
      key: 'pfCrypto',
      width: 100,
      render: (_, record) => renderOnOffTag(record.pfCrypto),
    },
    {
      title: '对端节点',
      key: 'peerNodes',
      width: 160,
      render: (_, record) => {
        const allNodes = [...(record.peerNodes || []), ...(record.indexNodes || [])];
        if (allNodes.length === 0) return <Text type="secondary">-</Text>;
        return (
          <Space size={4} wrap>
            {allNodes.map((node, idx) => (
              <Tag key={idx} color="blue">{node}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '路由数',
      dataIndex: 'routeCount',
      key: 'routeCount',
      width: 80,
      render: (_, record) => String(record.routeCount || 0),
    },
    {
      title: '密钥状态',
      key: 'keyStatus',
      width: 140,
      render: (_, record) => (
        <Space size={4}>
          {record.hasSecurityKey ? (
            <Tag color="green">Security</Tag>
          ) : (
            <Tag>Security</Tag>
          )}
          {record.hasEd25519Key ? (
            <Tag color="green">Ed25519</Tag>
          ) : (
            <Tag>Ed25519</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, record) => (
        <Space>
          <Tooltip title="编辑配置">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record.dirName)}
            >
              编辑
            </Button>
          </Tooltip>
          <Popconfirm
            title="确定要删除该配置吗？"
            description="删除后配置文件将无法恢复"
            onConfirm={() => handleDelete(record.dirName)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
          <Tooltip title="启动 Safe 模式节点">
            <Button
              id="safe-start-button"
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStart(record)}
            >
              启动
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  /** Node 对端节点表格列定义 */
  const nodeColumns = [
    {
      title: '节点ID',
      key: 'nodeId',
      width: 150,
      render: (_: any, __: AddressEntry, index: number) => (
        <Input
          value={nodeAddresses[index]?.nodeId || ''}
          onChange={(e) => handleNodeChange(index, 'nodeId', e.target.value)}
          placeholder="节点ID"
        />
      ),
    },
    {
      title: '地址',
      key: 'address',
      render: (_: any, __: AddressEntry, index: number) => (
        <Input
          value={nodeAddresses[index]?.address || ''}
          onChange={(e) => handleNodeChange(index, 'address', e.target.value)}
          placeholder="IP 地址或域名"
        />
      ),
    },
    {
      title: '端口',
      key: 'port',
      width: 110,
      render: (_: any, __: AddressEntry, index: number) => (
        <InputNumber
          value={nodeAddresses[index]?.port || 9001}
          onChange={(val) => handleNodeChange(index, 'port', val ?? 9001)}
          min={1}
          max={65535}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_: any, __: AddressEntry, index: number) => (
        <Button
          type="link"
          danger
          size="small"
          icon={<MinusCircleOutlined />}
          onClick={() => handleRemoveNode(index)}
        />
      ),
    },
  ];

  /** 路由配置表格列定义 */
  const routeColumns = [
    {
      title: '节点ID',
      key: 'nodeId',
      width: 150,
      render: (_: any, __: RouteEntry, index: number) => (
        <Input
          value={routeData[index]?.nodeId || ''}
          onChange={(e) => handleRouteChange(index, 'nodeId', e.target.value)}
          placeholder="节点ID"
        />
      ),
    },
    {
      title: '虚拟IP',
      key: 'virtualIP',
      render: (_: any, __: RouteEntry, index: number) => (
        <Input
          value={routeData[index]?.virtualIP || ''}
          onChange={(e) => handleRouteChange(index, 'virtualIP', e.target.value)}
          placeholder="例如: 172.31.0.1"
        />
      ),
    },
    {
      title: '子网掩码',
      key: 'subnetMask',
      width: 180,
      render: (_: any, __: RouteEntry, index: number) => (
        <Input
          value={routeData[index]?.subnetMask || ''}
          onChange={(e) => handleRouteChange(index, 'subnetMask', e.target.value)}
          placeholder="例如: 255.255.0.0"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_: any, __: RouteEntry, index: number) => (
        <Button
          type="link"
          danger
          size="small"
          icon={<MinusCircleOutlined />}
          onClick={() => handleRemoveRoute(index)}
        />
      ),
    },
  ];

  /**
   * @name 渲染密钥列表（支持点击查看/编辑、新增公钥、删除）
   * @param title 分组标题
   * @param keys 密钥文件列表
   * @param dirKey 目录标识（security 或 ed25519）
   */
  const renderKeyList = (title: string, keys: SafeKeyFileInfo[], dirKey: 'security' | 'ed25519') => (
    <Card
      title={title}
      size="small"
      style={{ marginBottom: 12 }}
      extra={
        dirKey === 'ed25519' ? (
          <Button
            type="link"
            size="small"
            icon={<FileAddOutlined />}
            onClick={() => handleAddPubKey(dirKey)}
          >
            新增公钥
          </Button>
        ) : null
      }
    >
      {keys.length === 0 ? (
        <Text type="secondary">暂无密钥文件</Text>
      ) : (
        <Table
          dataSource={keys}
          rowKey="path"
          pagination={false}
          size="small"
          columns={[
            {
              title: '文件名',
              dataIndex: 'name',
              key: 'name',
              render: (name: string, record: SafeKeyFileInfo) => (
                <Button
                  type="link"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => handleKeyClick(record)}
                  style={{ padding: 0 }}
                >
                  {name}
                </Button>
              ),
            },
            {
              title: '类型',
              dataIndex: 'type',
              key: 'type',
              width: 80,
              render: (type: string) =>
                type === 'public' ? (
                  <Tag color="blue">公钥</Tag>
                ) : (
                  <Tag color="red">私钥</Tag>
                ),
            },
            {
              title: '大小',
              dataIndex: 'size',
              key: 'size',
              width: 80,
              render: (size: number) => `${size} bytes`,
            },
            {
              title: '操作',
              key: 'action',
              width: 120,
              render: (_: any, record: SafeKeyFileInfo) => (
                <Space size={4}>
                  <Tooltip title="查看/编辑">
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleKeyClick(record)}
                    />
                  </Tooltip>
                  <Popconfirm
                    title="确定要删除该密钥文件吗？"
                    description={record.type === 'private' ? '删除私钥后将无法恢复，请确认' : '删除公钥后对端验证将失败'}
                    onConfirm={() => handleKeyDelete(record)}
                  >
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      )}
    </Card>
  );

  /** Safe 专业模式新手引导步骤 */
  const safeTourSteps = [
    {
      title: '欢迎来到 Safe专家模式新手教程',
      description: 'Safe 模式基于 Ed25519 密钥认证，提供更安全的节点认证和通信方式，适合固定成员组网。',
      target: null,
    },
    {
      title: '创建节点配置',
      description: '点击新建配置，输入节点ID，系统会自动生成配置目录和密钥对。',
      target: () => document.getElementById('safe-create-config') || document.body,
    },
    {
      title: '交换并导入公钥',
      description: 'Safe 模式需要双方交换公钥才能通信。如果是多方组网，需要将您的公钥发送给所有对端节点，同时获取所有对端的公钥并导入。',
      target: () => document.getElementById('safe-key-section') || document.body,
    },
    {
      title: '添加对端地址',
      description: '在地址配置中添加 Index 服务器和对端节点地址信息，确保节点能发现对方。',
      target: () => document.getElementById('safe-address-section') || document.body,
    },
    {
      title: '配置多方路由',
      description: '把多方的节点ID和虚拟网络IP都添加到“路由配置”页面，少一个都不行。同时，所有对端的 route.conf 也必须添加好本节点的节点ID、虚拟网络IP和掩码。',
      target: () => document.getElementById('safe-route-section') || document.body,
    },
    {
      title: '启动并测试连接',
      description: '配置完成后点击启动，节点将以 Safe 模式运行。通道通常在约20秒后建立完成，可在仪表盘查看连接状态，并在 CMD 中执行 ping 172.31.0.1 -t 这类命令持续测试对端虚拟IP。',
      target: () => document.getElementById('safe-start-button') || document.body,
    },
    {
      title: '连接不到排查',
      description: '如果超过30秒 ping 不通，需要排查两端的 address.conf。本机这里最好添加对端节点的ID、公网地址和端口；对端节点也需要在它自己的 address.conf 中添加本机节点的ID、公网地址和端口。同时检查双方防火墙对应端口是否放行。',
      target: () => document.getElementById('safe-node-peer-section') || document.body,
    },
  ];

  return (
    <PageContainer
      header={{
        title: '专业配置管理',
        subTitle: '管理 Safe 模式节点配置文件',
        extra: [
          <Button key="tour" icon={<QuestionCircleOutlined />} onClick={() => setSafeTourOpen(true)}>
            新手引导
          </Button>,
        ],
      }}
    >
      <ProTable<SafeConfigSummary>
        columns={columns}
        dataSource={configs}
        rowKey="dirName"
        loading={tableLoading}
        search={false}
        toolBarRender={() => [
          <Button
            id="safe-create-config"
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            新建配置
          </Button>,
          <Button key="refresh" icon={<ReloadOutlined />} onClick={loadConfigs}>
            刷新
          </Button>,
        ]}
        pagination={false}
      />

      {/* 新建配置弹窗 */}
      <ModalForm
        title="新建 Safe 配置"
        open={createModalVisible}
        onOpenChange={setCreateModalVisible}
        onFinish={handleCreate}
        modalProps={{ destroyOnHidden: true }}
      >
        <ProFormText
          name="nodeId"
          label="节点ID"
          placeholder="请输入节点 ID"
          rules={[{ required: true, message: '请输入节点 ID' }]}
        />
        <ProFormDigit
          name="listen"
          label="监听端口"
          placeholder="默认 9001"
          initialValue={9001}
          fieldProps={{ min: 1, max: 65535, precision: 0 }}
        />
        <ProFormText
          name="passcode"
          label="Passcode"
          placeholder="默认 999001"
          initialValue="999001"
          tooltip="节点通信密码，4-8 位纯数字"
          rules={[
            { pattern: /^[0-9]{4,8}$/, message: '请输入 4-8 位纯数字' },
          ]}
        />
        <Form.Item
          name="indexAddress"
          label="Index 节点"
          rules={[{ required: true, message: '请选择 Index 节点' }]}
          tooltip="从 Index 节点管理中选择，将自动写入 address.conf"
        >
          <Select
            placeholder="请选择 Index 节点"
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
        </Form.Item>
      </ModalForm>

      {/* 编辑配置抽屉 */}
      <Drawer
        title={
          <Space>
            <SafetyOutlined />
            <span>编辑 Safe 配置 - {currentDetail?.nodeConf?.nodeid || currentDirName}</span>
          </Space>
        }
        placement="right"
        width={720}
        open={drawerVisible}
        onClose={handleDrawerClose}
        loading={detailLoading}
        footer={
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={handleDrawerClose}>取消</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
            >
              保存
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeTabKey}
          onChange={setActiveTabKey}
          items={[
            {
              key: 'nodeConf',
              label: '基础配置',
              children: (
                <Form
                  form={nodeConfForm}
                  layout="vertical"
                >
                  <Form.Item name="nodeid" label="节点ID">
                    <Input placeholder="节点 ID" disabled />
                  </Form.Item>
                  <Form.Item name="listen" label="监听端口">
                    <Input placeholder="监听端口，例如 9001" />
                  </Form.Item>
                  <Form.Item name="passcode" label="Passcode">
                    <Input placeholder="通信密码，4-8 位纯数字" />
                  </Form.Item>
                  <Form.Item name="multi-socket" label="Multi-Socket">
                    <Select options={ON_OFF_OPTIONS} placeholder="选择 on/off" />
                  </Form.Item>
                  <Form.Item name="if-drv" label="网卡驱动">
                    <Select options={IF_DRV_OPTIONS} placeholder="选择网卡驱动" />
                  </Form.Item>
                  <Form.Item name="address-secure" label="Address-Secure">
                    <Select options={ON_OFF_OPTIONS} placeholder="选择 on/off" />
                  </Form.Item>
                  <Form.Item name="pf-crypto" label="PF-Crypto">
                    <Select options={ON_OFF_OPTIONS} placeholder="选择 on/off" />
                  </Form.Item>
                  <Divider plain>日志级别</Divider>
                  <Form.Item name="console-log-level" label="Console 日志级别">
                    <Select options={LOG_LEVEL_OPTIONS} placeholder="选择日志级别" allowClear />
                  </Form.Item>
                  <Form.Item name="index-log-level" label="Index 日志级别">
                    <Select options={LOG_LEVEL_OPTIONS} placeholder="选择日志级别" allowClear />
                  </Form.Item>
                  <Form.Item name="node-log-level" label="Node 日志级别">
                    <Select options={LOG_LEVEL_OPTIONS} placeholder="选择日志级别" allowClear />
                  </Form.Item>
                  <Divider plain>调试</Divider>
                  <Form.Item name="if-dump" label="IF-Dump">
                    <Select options={ON_OFF_OPTIONS} placeholder="选择 on/off" />
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'addressConf',
              label: '地址配置',
              children: (
                <div id="safe-address-section">
                  <Card title="Index 服务器" size="small" style={{ marginBottom: 16 }}>
                    <Form.Item label="Index 节点" tooltip="从 Index 节点管理中选择，切换时需确认">
                      <Select
                        value={indexAddress || undefined}
                        onChange={handleIndexChange}
                        placeholder="请选择 Index 服务器"
                        style={{ width: '100%' }}
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
                    </Form.Item>
                  </Card>
                  <Card
                    id="safe-node-peer-section"
                    title="Node 对端节点"
                    size="small"
                    extra={
                      <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={handleAddNode}>
                        添加节点
                      </Button>
                    }
                  >
                    <Table
                      dataSource={nodeAddresses}
                      columns={nodeColumns}
                      rowKey={(_, index) => String(index)}
                      pagination={false}
                      size="small"
                      locale={{ emptyText: '暂无对端节点，点击"添加节点"添加' }}
                    />
                  </Card>
                </div>
              ),
            },
            {
              key: 'routeConf',
              label: '路由配置',
              children: (
                <div id="safe-route-section">
                  <div style={{ marginBottom: 12 }}>
                    <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddRoute}>
                      添加路由
                    </Button>
                  </div>
                  <Table
                    dataSource={routeData}
                    columns={routeColumns}
                    rowKey={(_, index) => String(index)}
                    pagination={false}
                    size="small"
                    locale={{ emptyText: '暂无路由配置' }}
                  />
                </div>
              ),
            },
            {
              key: 'keyManage',
              label: '密钥管理',
              children: (
                <div id="safe-key-section">
                  <div style={{ marginBottom: 16 }}>
                    <Button
                      type="primary"
                      icon={<KeyOutlined />}
                      loading={genKeyLoading}
                      onClick={handleGenKey}
                    >
                      生成密钥对
                    </Button>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      生成 Security 密钥对（公钥+私钥），已有密钥时将提示确认覆盖
                    </Text>
                  </div>
                  {renderKeyList('Security 密钥', currentDetail?.securityKeys || [], 'security')}
                  {renderKeyList('Ed25519 密钥', currentDetail?.ed25519Keys || [], 'ed25519')}
                </div>
              ),
            },
          ]}
        />
      </Drawer>

      {/* 密钥查看/编辑弹窗 */}
      <Modal
        title={
          <Space>
            <KeyOutlined />
            <span>{currentKeyName}</span>
            {currentKeyIsPrivate ? <Tag color="red">私钥（只读）</Tag> : <Tag color="blue">公钥</Tag>}
          </Space>
        }
        open={keyModalVisible}
        onCancel={() => setKeyModalVisible(false)}
        width={600}
        loading={keyContentLoading}
        footer={
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => setKeyModalVisible(false)}>关闭</Button>
            <Button icon={<CopyOutlined />} onClick={handleKeyCopy}>
              复制
            </Button>
            {!currentKeyIsPrivate && (
              <Button type="primary" icon={<SaveOutlined />} onClick={handleKeySave}>
                保存
              </Button>
            )}
          </Space>
        }
      >
        <Input.TextArea
          value={currentKeyContent}
          onChange={(e) => setCurrentKeyContent(e.target.value)}
          readOnly={currentKeyIsPrivate}
          rows={10}
          style={{ fontFamily: 'monospace' }}
        />
        {currentKeyIsPrivate && (
          <Text type="warning" style={{ display: 'block', marginTop: 8 }}>
            私钥文件为只读，修改可能导致密钥对失效
          </Text>
        )}
      </Modal>

      {/* 新增公钥弹窗 */}
      <ModalForm
        title="新增公钥"
        open={addPubKeyModalVisible}
        onOpenChange={setAddPubKeyModalVisible}
        onFinish={handleAddPubKeySubmit}
        form={addPubKeyForm}
        modalProps={{ destroyOnHidden: true }}
      >
        <Form.Item
          name="fileName"
          label="文件名"
          rules={[{ required: true, message: '请输入文件名' }]}
          tooltip="例如: 1001.public（对端节点ID.public）"
        >
          <Input placeholder="例如: 1001.public" />
        </Form.Item>
        <Form.Item
          name="content"
          label="公钥内容"
          rules={[{ required: true, message: '请输入公钥内容' }]}
        >
          <Input.TextArea rows={8} placeholder="粘贴对端节点的公钥内容" style={{ fontFamily: 'monospace' }} />
        </Form.Item>
      </ModalForm>
      <Tour
        open={safeTourOpen}
        onClose={closeSafeTour}
        onChange={handleSafeTourChange}
        steps={safeTourSteps}
        scrollIntoViewOptions
      />
    </PageContainer>
  );
};

export default SafeConfig;
