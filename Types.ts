import React, { Dispatch, SetStateAction } from "react";

export interface LiveUpdate {
  id: string;
  timestamp: Date;
  type: 'connection' | 'disconnection' | 'data' | 'error' | 'websocket';
  message: string;
  connectionId?: string;
  size?: number;
  direction?: 'incoming' | 'outgoing';
}

export interface Connection {
  id: string;
  deviceName: string;
  brand: string;
  model: string;
  androidVersion: string;
  ipAddress: string;
  port: number;
  state: "connected" | "disconnected";
  latency: number;
  throughput: number;
  packetLoss: number;
  pingTime: number;
  adbStatus: boolean;
  isDevOptionsEnabled: boolean;
  isPhoneRooted: boolean;
  batteryLevel: number;
  isCharging: boolean;
  screenResolution: string;
  cpuUsage: number;
  memoryUsage: number;
  storageUsage: number;
  networkType: string;
  signalStrength: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  lastSeen: Date;
  connectedAt: Date;
  dataTransferred: {
    sent: number;
    received: number;
  };
}

export interface NetworkMiniMonitorState {
  connections: Connection[];
  liveUpdates: LiveUpdate[];
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  lastActivity?: Date;
  totalMessages: number;
  selectedRowKeys: string[];
  isMinimized: boolean;
  showGraph: boolean;
  isRefreshing: boolean;
  isRefreshingSelected: boolean;
  refreshInterval: number;
  activeMetrics: string[];
  leftAxisMetrics: string[];
  rightAxisMetrics: string[];
  filters: Record<string, string>;
  size: {
    width: number | string;
    height: number | string;
  };
  position: {
    x: number;
    y: number;
  };
  useMockConnection: boolean;
}

export interface NetworkMiniMonitorProps {
  onClose: () => void;
  initialSize?: { width: number; height: number };
  initialPosition?: { x: number; y: number };
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  startMinimized?: boolean;
}

export interface NetworkChartProps {
  connections: Connection[];
  leftAxisMetrics: string[];
  rightAxisMetrics: string[];
  availableMetrics: string[];
  handleLeftAxisMetricChange: (metrics: string[]) => void;
  handleRightAxisMetricChange: (metrics: string[]) => void;
  t: (key: string) => string;
}

export interface FilterControlsProps {
  addCustomMetric: (metric: string) => void;
  removeMetric: (metric: string) => void;
  handleFilter: (key: string, value: string) => void;
  availableMetrics: string[];
  activeMetrics: string[];
  filters: Record<string, string>;
  t: (key: string) => string;
}

// FIXED: Complete ColumnMoveControlsProps interface
export interface ColumnMoveControlsProps {
  columnIndex: number;
  totalColumns: number;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  t: (key: string) => string;
}

// FIXED: Complete LiveUpdatesProps interface
export interface LiveUpdatesProps {
  updates: LiveUpdate[];
  connectionStatus?: 'connected' | 'disconnected' | 'connecting';
  lastActivity?: Date;
  totalMessages?: number;
}

// FIXED: Complete DetailedConnectionViewProps interface  
export interface DetailedConnectionViewProps {
  connection: Connection;
  onClose: () => void;
  setLayoutKey: Dispatch<SetStateAction<number>>;
  activeMetrics: string[];
  alwaysDisplayedMetrics: string[];
}

export interface ActionToolbarProps {
  toggleMinimize: () => void;
  onClose: () => void;
  onResetState?: () => void;
  onAutoSize?: () => void;
  onExportCSV?: () => void;
  onExportJSON?: () => void;
  t: (key: string) => string;
  handleConnect: () => void;
  handleDisconnect: () => void;
  handleRefreshAll: () => void;
  handleRefreshSelected: () => void;
  handleRefreshIntervalChange: (interval: number) => void;
  handleEnableADBGlobally: () => void;
  toggleGraph: () => void;
  handleUseMockConnectionToggle: () => void;
  useMockConnection: boolean;
  addCustomMetric: (metric: string) => void;
  removeMetric: (metric: string) => void;
  handleFilter: (key: string, value: string) => void;
  availableMetrics: string[];
  isRefreshing: boolean;
  isRefreshingSelected: boolean;
  selectedRowKeys: string[];
  showGraph: boolean;
  refreshInterval: number;
  activeMetrics: string[];
  filters: Record<string, string>;
  minWidth: number;
  minHeight: number;
}

export interface NetworkMonitorBoardProps {
  title: string;
  onClose: () => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  position: { x: number; y: number };
  size: { width: number | string; height: number | string };
  onPositionChange: (position: { x: number; y: number }) => void;
  onSizeChange: (size: { width: number; height: number }) => void;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  zIndex?: number;
  children: React.ReactNode;
}

// Additional utility interfaces
export interface MetricDefinition {
  key: string;
  label: string;
  formatter?: (value: any) => string;
  type: 'number' | 'string' | 'boolean' | 'date';
}

export interface ChartDataPoint {
  name: string;
  latency: number;
  throughput: number;
  packetLoss: number;
  pingTime: number;
  cpuUsage: number;
  memoryUsage: number;
  bytesSent: number;
  bytesReceived: number;
  time: number;
}

export interface UseColumnManagementReturn {
  filteredConnections: Connection[];
  handleRowClick: (connection: Connection) => void;
  addCustomMetric: (metric: string) => void;
  removeMetric: (metric: string) => void;
  handleFilter: (key: string, value: string) => void;
  columns: any[];
  moveColumn: (fromIndex: number, toIndex: number) => void;
}
