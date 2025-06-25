import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { NetworkMiniMonitorState, Connection, LiveUpdate } from "./Types";

const initialState: NetworkMiniMonitorState = {
  connections: [],
  liveUpdates: [],
  connectionStatus: 'disconnected',
  lastActivity: undefined,
  totalMessages: 0,
  selectedRowKeys: [],
  isMinimized: false,
  showGraph: false,
  isRefreshing: false,
  isRefreshingSelected: false,
  refreshInterval: 5000,
  activeMetrics: ["quality", "latency", "throughput", "packetLoss"],
  leftAxisMetrics: ["latency", "pingTime", "throughput"],
  rightAxisMetrics: ["packetLoss", "bytesSent", "bytesReceived"],
  filters: {},
  size: {
    width: 800,
    height: 600,
  },
  position: {
    x: 100,
    y: 100,
  },
  useMockConnection: true,
};

const networkMiniMonitorSlice = createSlice({
  name: "networkMiniMonitor",
  initialState,
  reducers: {
    // Connection reducers
    setConnections: (state, action: PayloadAction<Connection[]>) => {
      state.connections = action.payload;
    },
    addNewConnection: (state, action: PayloadAction<Connection>) => {
      const existingIndex = state.connections.findIndex(
        (c) => c.id === action.payload.id
      );
      if (existingIndex >= 0) {
        state.connections[existingIndex] = action.payload;
      } else {
        state.connections.push(action.payload);
      }
    },
    removeConnection: (state, action: PayloadAction<string>) => {
      state.connections = state.connections.filter(
        (c) => c.id !== action.payload
      );
    },
    updateConnection: (state, action: PayloadAction<Partial<Connection> & { id: string }>) => {
      const index = state.connections.findIndex(c => c.id === action.payload.id);
      if (index >= 0) {
        state.connections[index] = { ...state.connections[index], ...action.payload };
      }
    },

    // Live updates reducers
    setLiveUpdates: (state, action: PayloadAction<LiveUpdate[]>) => {
      state.liveUpdates = action.payload;
    },
    addLiveUpdate: (state, action: PayloadAction<LiveUpdate>) => {
      state.liveUpdates = [action.payload, ...state.liveUpdates.slice(0, 19)];
    },
    clearLiveUpdates: (state) => {
      state.liveUpdates = [];
    },

    // Connection status reducers
    setConnectionStatus: (state, action: PayloadAction<'connected' | 'disconnected' | 'connecting'>) => {
      state.connectionStatus = action.payload;
    },
    setLastActivity: (state, action: PayloadAction<Date>) => {
      state.lastActivity = action.payload;
    },
    incrementTotalMessages: (state) => {
      state.totalMessages += 1;
    },
    resetTotalMessages: (state) => {
      state.totalMessages = 0;
    },

    // UI state reducers
    setSelectedRowKeys: (state, action: PayloadAction<string[]>) => {
      state.selectedRowKeys = action.payload;
    },
    setSelectedConnection: (state, action: PayloadAction<Connection>) => {
      const connectionId = action.payload.id;
      if (!state.selectedRowKeys.includes(connectionId)) {
        state.selectedRowKeys.push(connectionId);
      }
    },
    setIsMinimized: (state, action: PayloadAction<boolean>) => {
      state.isMinimized = action.payload;
    },
    setShowGraph: (state, action: PayloadAction<boolean>) => {
      state.showGraph = action.payload;
    },
    setIsRefreshing: (state, action: PayloadAction<boolean>) => {
      state.isRefreshing = action.payload;
    },
    setIsRefreshingSelected: (state, action: PayloadAction<boolean>) => {
      state.isRefreshingSelected = action.payload;
    },
    setRefreshInterval: (state, action: PayloadAction<number>) => {
      state.refreshInterval = action.payload;
    },
    setActiveMetrics: (state, action: PayloadAction<string[]>) => {
      state.activeMetrics = action.payload;
    },
    setLeftAxisMetrics: (state, action: PayloadAction<string[]>) => {
      state.leftAxisMetrics = action.payload;
    },
    setRightAxisMetrics: (state, action: PayloadAction<string[]>) => {
      state.rightAxisMetrics = action.payload;
    },
    setFilters: (state, action: PayloadAction<Record<string, string>>) => {
      state.filters = action.payload;
    },
    setPosition: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.position = action.payload;
    },
    setSize: (state, action: PayloadAction<{ width: number | string; height: number | string }>) => {
      state.size = action.payload;
    },
    setUseMockConnection: (state, action: PayloadAction<boolean>) => {
      state.useMockConnection = action.payload;
    },
    restoreState(state, action: PayloadAction<Partial<NetworkMiniMonitorState>>) {
      Object.assign(state, action.payload);
    },
    resetState: () => {
      return initialState;
    },
  },
});

export const {
  setConnections,
  addNewConnection,
  removeConnection,
  updateConnection,
  setSelectedRowKeys,
  setSelectedConnection,
  setLiveUpdates,
  addLiveUpdate,
  clearLiveUpdates,
  setConnectionStatus,
  setLastActivity,
  incrementTotalMessages,
  resetTotalMessages,
  setIsMinimized,
  setShowGraph,
  setIsRefreshing,
  setIsRefreshingSelected,
  setRefreshInterval,
  setActiveMetrics,
  setLeftAxisMetrics,
  setRightAxisMetrics,
  setFilters,
  setPosition,
  setSize,
  setUseMockConnection,
  restoreState,
  resetState,
} = networkMiniMonitorSlice.actions;

export default networkMiniMonitorSlice.reducer;
