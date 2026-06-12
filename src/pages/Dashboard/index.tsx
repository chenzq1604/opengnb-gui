/**
 * @name 仪表盘页面
 * @description 方案 F：左侧节点状态列表（主区），右侧四宫格（在线/离线/入站趋势/出站趋势）
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Card,
  Col,
  Row,
  Statistic,
  Tag,
  Typography,
  Flex,
  Empty,
  Tooltip,
} from 'antd';
import {
  CheckCircleOutlined,
  DesktopOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Line } from '@ant-design/plots';
import { gnbService } from '@/services/gnb';
import type { NodeStatus, PeerNodeStatus } from '@/typings';

const { Text } = Typography;

/** 流量历史数据点 */
interface TrafficDataPoint {
  time: string;
  value: number;
  type: '入站' | '出站';
}

/** 节点实时速率 */
interface NodeSpeed {
  inRate: number;
  outRate: number;
  peerInRate: Record<string, number>;
  peerOutRate: Record<string, number>;
}

/** 仪表盘状态 */
interface DashboardState {
  nodes: NodeStatus[];
  totalInBytes: number;
  totalOutBytes: number;
  onlineCount: number;
  offlineCount: number;
  /** 各节点实时速率（字节/秒），在 loadData 中计算后存入 state */
  nodeSpeeds: Record<string, NodeSpeed>;
}

/** 最大历史数据点数 */
const MAX_HISTORY_POINTS = 30;

/**
 * @name 格式化字节数为可读字符串
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * @name 格式化运行时长
 */
function formatDuration(startTime: number): string {
  const ms = Date.now() - startTime;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}秒`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分钟`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时${min % 60}分钟`;
  return `${Math.floor(hr / 24)}天${hr % 24}小时`;
}

/**
 * @name 推算 TUN 虚拟 IP
 */
function getTunIP(nodeId: string, mode: 'lite' | 'safe' | undefined): string {
  const lastDigit = nodeId.slice(-1);
  if (mode === 'safe') return `172.31.0.${lastDigit}`;
  if (mode === 'lite') return `10.1.0.${lastDigit}`;
  return '-';
}

/**
 * @name 格式化延迟（微秒 → 可读）
 */
function formatLatency(usec: number): string {
  if (usec === 0) return '-';
  if (usec < 1000) return `${usec}μs`;
  const ms = usec / 1000;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * @name 获取连接类型标签颜色
 */
function getConnTypeColor(ipv4Type: string): string {
  if (ipv4Type.includes('Direct')) return '#52c41a';
  if (ipv4Type === 'InDirect') return '#faad14';
  return '#bfbfbf';
}

/**
 * @name 获取连接类型简写
 */
function getConnTypeLabel(ipv4Type: string): string {
  if (ipv4Type.includes('Direct Point to Point')) return '直连';
  if (ipv4Type === 'InDirect') return '间接';
  if (ipv4Type === 'Local node') return '本机';
  return ipv4Type || '未知';
}

/**
 * @name 仪表盘页面组件
 */
const Dashboard: React.FC = () => {
  const [state, setState] = useState<DashboardState>({
    nodes: [],
    totalInBytes: 0,
    totalOutBytes: 0,
    onlineCount: 0,
    offlineCount: 0,
    nodeSpeeds: {},
  });

  /** 流量历史数据 */
  const [trafficHistory, setTrafficHistory] = useState<TrafficDataPoint[]>([]);

  /** 上一次的各节点流量值（累计），用于计算实时速率 */
  const prevNodeTrafficRef = useRef<Record<string, { in: number; out: number; peerIn: Record<string, number>; peerOut: Record<string, number> }>>({});

  /** 上一次刷新的时间戳，用于精确计算速率 */
  const lastRefreshTimeRef = useRef<number>(0);

  /** 加载数据 */
  const loadData = async () => {
    const nodes = await gnbService.getAllStatus();
    const onlineCount = nodes.filter((n) => n.running).length;
    const offlineCount = nodes.filter((n) => !n.running).length;
    const totalInBytes = nodes.reduce((sum, n) => sum + (n.running ? (n.inBytes || 0) : 0), 0);
    const totalOutBytes = nodes.reduce((sum, n) => sum + (n.running ? (n.outBytes || 0) : 0), 0);

    // ① 先保存旧的 prev 值（深拷贝），用于计算速率差值
    const oldPrev: typeof prevNodeTrafficRef.current = {};
    for (const nodeId of Object.keys(prevNodeTrafficRef.current)) {
      const old = prevNodeTrafficRef.current[nodeId];
      oldPrev[nodeId] = {
        in: old.in,
        out: old.out,
        peerIn: { ...old.peerIn },
        peerOut: { ...old.peerOut },
      };
    }

    // ② 计算时间间隔（秒），用于精确速率计算
    const now = Date.now();
    const intervalSec = lastRefreshTimeRef.current > 0
      ? Math.max(1, (now - lastRefreshTimeRef.current) / 1000)
      : 2; // 首次加载无旧值，不计算速率
    lastRefreshTimeRef.current = now;

    // ③ 计算各节点的实时速率（当前累计值 - 旧累计值）/ 时间间隔
    const nodeSpeeds: Record<string, NodeSpeed> = {};
    nodes.forEach(node => {
      const oldNodeTraffic = oldPrev[node.nodeId];
      if (oldNodeTraffic) {
        // 有旧值，计算速率
        const inRate = Math.max(0, ((node.inBytes || 0) - oldNodeTraffic.in) / intervalSec);
        const outRate = Math.max(0, ((node.outBytes || 0) - oldNodeTraffic.out) / intervalSec);
        const peerInRate: Record<string, number> = {};
        const peerOutRate: Record<string, number> = {};
        if (node.peerNodes) {
          node.peerNodes.forEach(peer => {
            peerInRate[peer.nodeId] = Math.max(0, ((peer.inBytes || 0) - (oldNodeTraffic.peerIn[peer.nodeId] || 0)) / intervalSec);
            peerOutRate[peer.nodeId] = Math.max(0, ((peer.outBytes || 0) - (oldNodeTraffic.peerOut[peer.nodeId] || 0)) / intervalSec);
          });
        }
        nodeSpeeds[node.nodeId] = { inRate, outRate, peerInRate, peerOutRate };
      } else {
        // 首次加载无旧值，速率为0
        nodeSpeeds[node.nodeId] = { inRate: 0, outRate: 0, peerInRate: {}, peerOutRate: {} };
      }
    });

    // ④ 计算总增量速率（用于流量趋势图）
    const prevTotalIn = Object.values(oldPrev).reduce((sum, t) => sum + t.in, 0);
    const prevTotalOut = Object.values(oldPrev).reduce((sum, t) => sum + t.out, 0);
    const inDelta = Math.max(0, totalInBytes - prevTotalIn);
    const outDelta = Math.max(0, totalOutBytes - prevTotalOut);

    // ⑤ 更新流量历史
    const timeLabel = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}:${String(new Date().getSeconds()).padStart(2, '0')}`;
    setTrafficHistory((prev) => {
      const newHistory = [
        ...prev,
        { time: timeLabel, value: inDelta, type: '入站' as const },
        { time: timeLabel, value: outDelta, type: '出站' as const },
      ];
      const maxLen = MAX_HISTORY_POINTS * 2;
      return newHistory.length > maxLen ? newHistory.slice(newHistory.length - maxLen) : newHistory;
    });

    // ⑥ 更新 state（包含计算好的速率）
    setState({ nodes, totalInBytes, totalOutBytes, onlineCount, offlineCount, nodeSpeeds });

    // ⑦ 最后更新 prev 为当前累计值（供下次计算使用）
    const currentTraffic: typeof prevNodeTrafficRef.current = {};
    nodes.forEach(node => {
      currentTraffic[node.nodeId] = {
        in: node.inBytes || 0,
        out: node.outBytes || 0,
        peerIn: {},
        peerOut: {},
      };
      if (node.peerNodes) {
        node.peerNodes.forEach(peer => {
          currentTraffic[node.nodeId].peerIn[peer.nodeId] = peer.inBytes || 0;
          currentTraffic[node.nodeId].peerOut[peer.nodeId] = peer.outBytes || 0;
        });
      }
    });
    prevNodeTrafficRef.current = currentTraffic;
  };

  useEffect(() => {
    loadData();
    /** 节点状态每 2 秒自动刷新一次，无需手动操作 */
    const timer = setInterval(loadData, 2000);
    return () => clearInterval(timer);
  }, []);

  // 排序：在线节点在前，离线节点在后
  const sortedNodes = [...state.nodes].sort((a, b) => {
    if (a.running && !b.running) return -1;
    if (!a.running && b.running) return 1;
    return a.nodeId.localeCompare(b.nodeId);
  });

  // 折线图配置
  const lineAxis = {
    x: {
      labelAutoRotate: false,
      labelFormatter: (text: string) => {
        const parts = text.split(':');
        return parts.length >= 2 ? `${parts[1]}:${parts[2]}` : text;
      },
    },
    y: {
      labelFormatter: (text: string) => {
        const val = parseFloat(text);
        if (val < 1024) return `${val.toFixed(0)} B/s`;
        if (val < 1024 * 1024) return `${(val / 1024).toFixed(1)} KB/s`;
        return `${(val / (1024 * 1024)).toFixed(1)} MB/s`;
      },
    },
  };

  // 入站 + 出站合并到一张图
  const trafficLineConfig = {
    data: trafficHistory,
    xField: 'time',
    yField: 'value',
    colorField: 'type',
    height: 240,
    smooth: true,
    scale: {
      y: { nice: true },
      color: {
        range: ['#1677ff', '#722ed1'],
      },
    },
    axis: lineAxis,
    style: { lineWidth: 2 },
    interaction: { tooltip: { marker: false } },
  };

  return (
    <PageContainer
      header={{
        title: '仪表盘',
        subTitle: 'OpenGNB 节点状态概览',
      }}
    >
      <Row gutter={16}>
        {/* 左侧：节点状态列表（主区域） */}
        <Col xs={24} lg={17}>
          <Card
            title="节点状态"
            extra={<Text type="secondary" style={{ fontSize: 12 }}>2 秒自动刷新</Text>}
            bodyStyle={{ padding: '12px 24px', minHeight: 600 }}
          >
            {sortedNodes.length === 0 ? (
              <Empty
                description="暂无节点，请先添加或启动节点"
                style={{ padding: '100px 0' }}
              />
            ) : (
              <Flex vertical>
                {sortedNodes.map((node) => (
                  <div key={node.nodeId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 0',
                      }}
                    >
                      <Flex align="center" gap={16}>
                        {/* 图标 */}
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: node.running
                              ? (node.mode === 'safe' ? '#f6ffed' : '#e6f4ff')
                              : '#fafafa',
                            border: node.running
                              ? (node.mode === 'safe' ? '1px solid #b7eb8f' : '1px solid #91caff')
                              : '1px solid #f0f0f0',
                          }}
                        >
                          {node.running ? (
                            node.mode === 'lite' ? (
                              <ThunderboltOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                            ) : (
                              <SafetyOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                            )
                          ) : (
                            <DesktopOutlined style={{ fontSize: 20, color: '#bfbfbf' }} />
                          )}
                        </div>
                        {/* 节点信息 */}
                        <Flex vertical gap={4}>
                          <Flex align="center" gap={8}>
                            <Text strong style={{ fontSize: 15 }}>节点 {node.nodeId}</Text>
                            {node.mode === 'safe' ? (
                              <Tag color="green" style={{ margin: 0 }}>Safe</Tag>
                            ) : node.mode === 'lite' ? (
                              <Tag color="blue" style={{ margin: 0 }}>Lite</Tag>
                            ) : null}
                            {node.running ? (
                              <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0 }}>运行中</Tag>
                            ) : (
                              <Tag style={{ margin: 0, color: '#bfbfbf', borderColor: '#f0f0f0' }}>离线</Tag>
                            )}
                          </Flex>
                          <Flex gap={16}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              虚拟 IP: <Text strong style={{ color: '#52c41a' }}>{getTunIP(node.nodeId, node.mode)}</Text>
                            </Text>
                            {node.startTime && (
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                运行: {formatDuration(node.startTime)}
                              </Text>
                            )}
                          </Flex>
                        </Flex>
                      </Flex>
                      {/* 流量 */}
            {node.running ? (
              <Flex vertical align="end" gap={2}>
                <Flex align="center" gap={4}>
                  <ArrowDownOutlined style={{ color: '#1677ff', fontSize: 12 }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>入:</Text>
                  <Text style={{ fontSize: 12, fontWeight: 600, color: '#1677ff' }}>
                    {formatBytes(state.nodeSpeeds[node.nodeId]?.inRate || 0)}/s
                  </Text>
                </Flex>
                <Flex align="center" gap={4}>
                  <ArrowUpOutlined style={{ color: '#722ed1', fontSize: 12 }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>出:</Text>
                  <Text style={{ fontSize: 12, fontWeight: 600, color: '#722ed1' }}>
                    {formatBytes(state.nodeSpeeds[node.nodeId]?.outRate || 0)}/s
                  </Text>
                </Flex>
              </Flex>
            ) : (
              <Tooltip title="启动后显示流量">
                <Text type="secondary" style={{ fontSize: 12 }}>--</Text>
              </Tooltip>
            )}
                    </div>
                    {/* 对端节点列表 */}
                    {node.running && node.peerNodes && node.peerNodes.length > 0 && (
                      (() => {
                        // 过滤已上线的对端节点：有虚拟IP + (有流量/有延迟/公网地址有效)
                        const onlinePeers = node.peerNodes.filter(peer => 
                          peer.tunIPv4 && peer.tunIPv4.trim() && 
                          (peer.latencyUsec > 0 || peer.inBytes > 0 || peer.outBytes > 0 || 
                          (peer.wanIPv4 && peer.wanIPv4.trim() !== '0.0.0.0:0'))
                        );
                        return onlinePeers.length > 0 ? (
                          <div style={{ paddingLeft: 56, paddingBottom: 12 }}>
                            <Text type="secondary" style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>
                              对端节点 ({onlinePeers.length})
                            </Text>
                            {onlinePeers.map((peer) => (
                          <div
                            key={peer.nodeId}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 12px',
                              marginBottom: 4,
                              background: '#fafafa',
                              borderRadius: 6,
                              fontSize: 12,
                            }}
                          >
                            <Flex align="center" gap={12}>
                              <Text strong style={{ fontSize: 12 }}>节点 {peer.nodeId}</Text>
                              <Tag
                                color={getConnTypeColor(peer.ipv4Type)}
                                style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 4px' }}
                              >
                                {getConnTypeLabel(peer.ipv4Type)}
                              </Tag>
                              {peer.tunIPv4 && (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  虚拟IP: <Text strong style={{ color: '#52c41a' }}>{peer.tunIPv4}</Text>
                                </Text>
                              )}
                              {peer.wanIPv4 && (
                                <Tooltip title="公网地址">
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    公网: {peer.wanIPv4}
                                  </Text>
                                </Tooltip>
                              )}
                            </Flex>
                            <Flex align="center" gap={16}>
                      <Tooltip title="延迟">
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatLatency(peer.latencyUsec)}
                        </Text>
                      </Tooltip>
                      <Flex align="center" gap={4}>
                        <ArrowDownOutlined style={{ color: '#1677ff', fontSize: 10 }} />
                        <Text style={{ fontSize: 11, color: '#1677ff' }}>
                          {formatBytes(state.nodeSpeeds[node.nodeId]?.peerInRate?.[peer.nodeId] || 0)}/s
                        </Text>
                      </Flex>
                      <Flex align="center" gap={4}>
                        <ArrowUpOutlined style={{ color: '#722ed1', fontSize: 10 }} />
                        <Text style={{ fontSize: 11, color: '#722ed1' }}>
                          {formatBytes(state.nodeSpeeds[node.nodeId]?.peerOutRate?.[peer.nodeId] || 0)}/s
                        </Text>
                      </Flex>
                    </Flex>
                          </div>
                        ))}
                          </div>
                        ) : null;
                      })()
                    )}
                  </div>
                ))}
              </Flex>
            )}
          </Card>
        </Col>

        {/* 右侧：统计卡片 */}
        <Col xs={24} lg={7}>
          <Flex vertical gap={16} style={{ height: '100%' }}>
            {/* 在线节点 */}
            <Card size="small" bodyStyle={{ padding: '16px 24px' }}>
              <Statistic
                title="在线节点"
                value={state.onlineCount}
                prefix={<CheckCircleOutlined />}
                styles={{ content: { color: '#52c41a', fontSize: 28 } }}
              />
            </Card>

            {/* 离线节点 */}
            <Card size="small" bodyStyle={{ padding: '16px 24px' }}>
              <Statistic
                title="离线节点"
                value={state.offlineCount}
                prefix={<DesktopOutlined />}
                styles={{ content: { color: '#bfbfbf', fontSize: 28 } }}
              />
            </Card>

            {/* 累计入站 */}
            <Card size="small" bodyStyle={{ padding: '16px 24px' }}>
              <Statistic
                title="累计入站"
                value={formatBytes(state.totalInBytes)}
                prefix={<ArrowDownOutlined style={{ color: '#1677ff' }} />}
                styles={{ content: { color: '#1677ff', fontSize: 24 } }}
              />
            </Card>

            {/* 累计出站 */}
            <Card size="small" bodyStyle={{ padding: '16px 24px' }}>
              <Statistic
                title="累计出站"
                value={formatBytes(state.totalOutBytes)}
                prefix={<ArrowUpOutlined style={{ color: '#722ed1' }} />}
                styles={{ content: { color: '#722ed1', fontSize: 24 } }}
              />
            </Card>
          </Flex>
        </Col>
      </Row>

      {/* 底部：流量趋势图 */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title="流量趋势" bodyStyle={{ padding: '16px 24px' }}>
            {trafficHistory.length > 1 ? (
              <Line {...trafficLineConfig} style={{ height: 280 }} />
            ) : (
              <div style={{ textAlign: 'center', padding: '100px 0', color: '#999' }}>
                等待数据...
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default Dashboard;
