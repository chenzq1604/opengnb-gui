/**
 * @name 节点启动后等待 if_up 完成的弹窗
 * @description gnb.exe 启动后，gnb_es.exe 会在约 15 秒内自动完成：
 *   1. 启用 P2PNet 虚拟网卡
 *   2. 添加 172.31.0.0/16 路由
 *   3. 与对端建立 UDP 通道
 * 在此期间，前端应明确提示用户等待，避免误以为"已经起来却 ping 不通"。
 */
import React, { useEffect, useState } from 'react';
import { Modal, Progress, Typography, Space, Alert, Button } from 'antd';
import { ApiOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

/** 默认自动 if_up 完成耗时（秒） */
const DEFAULT_DURATION_SEC = 15;

/**
 * @name WaitingForIfUpModal 组件属性
 */
interface WaitingForIfUpModalProps {
  /** 是否显示 */
  open: boolean;
  /** 当前启动的节点 ID（用于提示文案） */
  nodeId: string;
  /** 倒计时秒数，默认 15 */
  durationSec?: number;
  /** 用户点击"知道了"或倒计时归零后的回调 */
  onClose: () => void;
}

/**
 * @name 节点启动后等待 if_up 的弹窗组件
 * @param props 组件属性
 * @returns 渲染的 Modal
 */
export const WaitingForIfUpModal: React.FC<WaitingForIfUpModalProps> = ({
  open,
  nodeId,
  durationSec = DEFAULT_DURATION_SEC,
  onClose,
}) => {
  /** 剩余秒数 */
  const [remaining, setRemaining] = useState<number>(durationSec);

  /**
   * @name 监听 open 变化，重置倒计时
   */
  useEffect(() => {
    if (!open) {
      setRemaining(durationSec);
      return;
    }
    setRemaining(durationSec);
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [open, durationSec]);

  /** 是否已等待完毕 */
  const finished = remaining === 0;
  /** 已完成的百分比 */
  const percent = Math.round(((durationSec - remaining) / durationSec) * 100);

  return (
    <Modal
      open={open}
      title={
        <Space>
          <ApiOutlined />
          <span>节点 {nodeId} 启动中</span>
        </Space>
      }
      footer={
        finished ? (
          <Button type="primary" onClick={onClose}>
            知道了
          </Button>
        ) : null
      }
      onCancel={() => {
        // 倒计时未完成时禁止通过遮罩/ESC 关闭
        if (finished) onClose();
      }}
      closable={finished}
      maskClosable={false}
      keyboard={finished}
      width={460}
      destroyOnHidden
    >
      {finished ? (
        <Alert
          message="虚拟网络已就绪"
          description={
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text>
                P2PNet 接口已自动启用，<Text code>172.31.0.0/16</Text> 路由已添加完成。
              </Text>
              <Text type="secondary">
                您现在可以 ping 对端节点（例如 <Text code>ping 172.31.0.1</Text>）。
              </Text>
            </Space>
          }
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
        />
      ) : (
        <>
          <Paragraph>
            <LoadingOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            gnb 正在自动启用虚拟网卡并添加路由，请稍候
            <Text strong style={{ margin: '0 6px', color: '#1677ff' }}>
              {remaining}
            </Text>
            秒…
          </Paragraph>
          <Progress
            percent={percent}
            status="active"
            strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
          />
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
            说明：gnb_es.exe 启动后会在约 {durationSec} 秒内完成 P2PNet 接口启用和 172.31.0.0/16
            路由添加。在此期间请勿操作网络配置，否则可能造成首包丢失。
          </Text>
        </>
      )}
    </Modal>
  );
};

export default WaitingForIfUpModal;
