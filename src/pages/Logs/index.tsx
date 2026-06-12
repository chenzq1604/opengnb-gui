/**
 * @name 日志查看页面
 * @description 实时日志流显示，支持日志级别筛选、搜索和导出
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  Card,
  Select,
  Input,
  Button,
  Space,
  Tag,
  Typography,
  App,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  ClearOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { logService, gnbService } from '@/services/gnb';
import type { NodeStatus } from '@/typings';
// @ts-ignore - umi 运行时导出
import { useLocation } from '@umijs/max';

const { Text } = Typography;

/** 日志级别 */
type LogLevel = 'all' | 'info' | 'warn' | 'error';

/** 日志条目 */
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  content: string;
  raw: string;
}

/**
 * @name 日志查看页面组件
 */
const Logs: React.FC = () => {
  const { message } = App.useApp();
  const location = useLocation();
  const [nodes, setNodes] = useState<NodeStatus[]>([]);
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logLevel, setLogLevel] = useState<LogLevel>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [subscribed, setSubscribed] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  /** 加载节点列表 */
  const loadNodes = async () => {
    const status = await gnbService.getAllStatus();
    setNodes(status);
    if (status.length > 0 && !selectedNode) {
      setSelectedNode(status[0].nodeId);
    }
  };

  useEffect(() => {
    loadNodes();
    return () => {
      // 清理订阅
      unsubscribeRef.current?.();
    };
  }, []);

  // 从URL参数获取nodeId，自动选中并订阅
  useEffect(() => {
    if (nodes.length > 0) {
      const params = new URLSearchParams(location.search);
      const targetNodeId = params.get('nodeId');
      if (targetNodeId) {
        const exists = nodes.some(n => n.nodeId === targetNodeId);
        if (exists) {
          // 先取消现有订阅
          if (subscribed && selectedNode !== targetNodeId) {
            handleUnsubscribe();
          }
          setSelectedNode(targetNodeId);
          // 延迟执行，确保selectedNode已更新
          setTimeout(() => {
            if (!subscribed) {
              handleSubscribe();
            }
          }, 100);
        }
      }
    }
  }, [nodes, location.search]);

  /** 订阅日志 */
  const handleSubscribe = async () => {
    if (!selectedNode) {
      message.warning('请先选择节点');
      return;
    }

    const result = await logService.subscribe(selectedNode);
    if (result.success) {
      setSubscribed(true);
      // 监听日志数据
      const unsub = logService.onData((data) => {
        if (data.nodeId === selectedNode) {
          const lines = data.data.split('\n').filter((l) => l.trim());
          const entries: LogEntry[] = lines.map((line) => ({
            timestamp: new Date().toISOString(),
            level: line.includes('[ERROR]') ? 'error' : line.includes('[WARN]') ? 'warn' : 'info',
            content: line.replace(/^\[[\d-T:.Z]+\]\s*/, ''),
            raw: line,
          }));
          setLogs((prev) => [...prev, ...entries].slice(-5000));
        }
      });
      unsubscribeRef.current = unsub;
      message.success('已订阅日志');
    }
  };

  /** 取消订阅 */
  const handleUnsubscribe = async () => {
    if (!selectedNode) return;
    await logService.unsubscribe(selectedNode);
    unsubscribeRef.current?.();
    setSubscribed(false);
    message.info('已取消订阅');
  };

  /** 清空日志 */
  const handleClear = () => {
    setLogs([]);
  };

  /** 导出日志 */
  const handleExport = () => {
    const content = filteredLogs.map((entry) => entry.raw).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gnb_${selectedNode}_${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('日志已导出');
  };

  /** 过滤后的日志 */
  const filteredLogs = logs.filter((entry) => {
    if (logLevel !== 'all' && entry.level !== logLevel) return false;
    if (searchText && !entry.raw.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  /** 自动滚动到底部 */
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs]);

  /** 日志级别颜色映射 */
  const levelColorMap = {
    info: 'blue',
    warn: 'orange',
    error: 'red',
  };

  return (
    <PageContainer
      header={{
        title: '日志查看',
        subTitle: '实时查看 GNB 节点运行日志',
      }}
    >
      <Card>
        {/* 工具栏 */}
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
          <Space wrap>
            <Select
              style={{ width: 200 }}
              placeholder="选择节点"
              value={selectedNode || undefined}
              onChange={setSelectedNode}
              options={nodes.map((n) => ({
                label: `节点 ${n.nodeId} ${n.running ? '(运行中)' : '(已停止)'}`,
                value: n.nodeId,
              }))}
            />
            <Select
              style={{ width: 120 }}
              value={logLevel}
              onChange={setLogLevel}
              options={[
                { label: '全部', value: 'all' },
                { label: 'Info', value: 'info' },
                { label: 'Warn', value: 'warn' },
                { label: 'Error', value: 'error' },
              ]}
            />
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索日志"
              style={{ width: 200 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Space>
          <Space>
            {!subscribed ? (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleSubscribe}
                disabled={!selectedNode}
              >
                订阅日志
              </Button>
            ) : (
              <Button
                danger
                icon={<PauseCircleOutlined />}
                onClick={handleUnsubscribe}
              >
                取消订阅
              </Button>
            )}
            <Button icon={<ClearOutlined />} onClick={handleClear}>
              清空
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={filteredLogs.length === 0}>
              导出
            </Button>
          </Space>
        </Space>

        {/* 日志显示区域 */}
        <div
          ref={logContainerRef}
          style={{
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: '13px',
            lineHeight: '1.6',
            padding: '12px',
            borderRadius: '4px',
            height: '500px',
            overflowY: 'auto',
          }}
        >
          {filteredLogs.length === 0 ? (
            <div style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
              暂无日志数据，请选择节点并订阅日志
            </div>
          ) : (
            filteredLogs.map((entry, index) => (
              <div key={index} style={{ marginBottom: '2px' }}>
                <Tag
                  color={levelColorMap[entry.level]}
                  style={{ fontSize: '11px', marginRight: '8px' }}
                >
                  {entry.level.toUpperCase()}
                </Tag>
                <span style={{ color: '#6a9955', marginRight: '8px' }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span style={{ color: entry.level === 'error' ? '#f44747' : entry.level === 'warn' ? '#cca700' : '#d4d4d4' }}>
                  {entry.content}
                </span>
              </div>
            ))
          )}
        </div>

        {/* 日志统计 */}
        <div style={{ marginTop: 8, color: '#999' }}>
          <Text type="secondary">
            共 {filteredLogs.length} 条日志
            {searchText && ` (搜索: "${searchText}")`}
          </Text>
        </div>
      </Card>
    </PageContainer>
  );
};

export default Logs;
