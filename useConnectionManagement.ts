import { useAppDispatch, useAppSelector } from "@Hook";
import { useEffect, useRef, useCallback } from "react";
import i18next from "i18next";
import {
  setUseMockConnection,
  setConnections,
  setIsRefreshing,
  setIsRefreshingSelected,
  setRefreshInterval,
} from "@Store/NetworkMiniMonitor/Reducer";
import { Connection } from "@Store/NetworkMiniMonitor/Types";
import { socket } from "@/index";
import { successNotify, errorNotify } from "@Config";
import { MockConnection } from "./MockConnection";
import { encrypt, decrypt } from "@Thunks/Commands/Crypto";

const useConnectionManagement = () => {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s.networkMiniMonitor);
  const { useMockConnection, selectedRowKeys, refreshInterval, isRefreshing, isRefreshingSelected } = state;
  const mockConnectionRef = useRef<MockConnection | null>(null);
  
  // ADDED: Refs for interval management
  const refreshAllIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshSelectedIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize mock connection and listen to events
  useEffect(() => {
    if (useMockConnection && !mockConnectionRef.current) {
      mockConnectionRef.current = new MockConnection();
      
      const mockConnection = mockConnectionRef.current;
      
      const handleUpdateConnections = (connections: Connection[]) => {
        console.log('MockConnection event: updateConnections', connections.length);
        dispatch(setConnections(connections));
      };
      
      const handleNewConnection = (connection: Connection) => {
        console.log('MockConnection event: newConnection', connection.id);
      };
      
      const handleDisconnection = (connectionId: string) => {
        console.log('MockConnection event: disconnection', connectionId);
      };
      
      mockConnection.on('updateConnections', handleUpdateConnections);
      mockConnection.on('newConnection', handleNewConnection);
      mockConnection.on('disconnection', handleDisconnection);
      
      return () => {
        mockConnection.off('updateConnections', handleUpdateConnections);
        mockConnection.off('newConnection', handleNewConnection);
        mockConnection.off('disconnection', handleDisconnection);
      };
    }
  }, [useMockConnection, dispatch]);

  // ADDED: Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (refreshAllIntervalRef.current) {
        clearInterval(refreshAllIntervalRef.current);
        refreshAllIntervalRef.current = null;
      }
      if (refreshSelectedIntervalRef.current) {
        clearInterval(refreshSelectedIntervalRef.current);
        refreshSelectedIntervalRef.current = null;
      }
    };
  }, []);

  // FIXED: Refresh all with toggle functionality and intervals
  const handleRefreshAll = useCallback(() => {
    if (isRefreshing) {
      // FIXED: If already refreshing, stop it
      console.log("Stopping refresh all interval");
      dispatch(setIsRefreshing(false));
      
      if (refreshAllIntervalRef.current) {
        clearInterval(refreshAllIntervalRef.current);
        refreshAllIntervalRef.current = null;
      }
      
      successNotify(i18next.t("NETWORK_MONITOR_REFRESH_STOPPED") || "Auto-refresh stopped", i18next.t("SUCCESS") || "Success");
      return;
    }

    // FIXED: Start refreshing
    console.log("Starting refresh all with interval:", refreshInterval);
    dispatch(setIsRefreshing(true));

    const performRefresh = () => {
      console.log("Performing refresh all...");
      if (useMockConnection) {
        if (!mockConnectionRef.current) {
          mockConnectionRef.current = new MockConnection();
        }
        mockConnectionRef.current.getConnections();
      } else {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(encrypt(JSON.stringify({ event: "getConnectionsRequest" })));
        } else {
          console.error("WebSocket not ready for refresh");
        }
      }
    };

    // Perform initial refresh
    performRefresh();
    successNotify(i18next.t("NETWORK_MONITOR_AUTO_REFRESH_STARTED") || "Auto-refresh started", i18next.t("SUCCESS") || "Success");

    // ADDED: Set up interval refreshing
    refreshAllIntervalRef.current = setInterval(() => {
      console.log(`Auto-refresh triggered every ${refreshInterval}ms`);
      performRefresh();
    }, refreshInterval);

  }, [isRefreshing, useMockConnection, socket, dispatch, refreshInterval]);

  // FIXED: Refresh selected with toggle functionality and intervals
  const handleRefreshSelected = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      errorNotify(i18next.t("NETWORK_MONITOR_NO_SELECTION") || "No connections selected", i18next.t("INFO") || "Info");
      return;
    }

    if (isRefreshingSelected) {
      // FIXED: If already refreshing, stop it
      console.log("Stopping refresh selected interval");
      dispatch(setIsRefreshingSelected(false));
      
      if (refreshSelectedIntervalRef.current) {
        clearInterval(refreshSelectedIntervalRef.current);
        refreshSelectedIntervalRef.current = null;
      }
      
      successNotify(i18next.t("NETWORK_MONITOR_REFRESH_SELECTED_STOPPED") || "Selected auto-refresh stopped", i18next.t("SUCCESS") || "Success");
      return;
    }

    // FIXED: Start refreshing selected
    console.log("Starting refresh selected with interval:", refreshInterval);
    dispatch(setIsRefreshingSelected(true));
    
    const performRefreshSelected = () => {
      console.log("Performing refresh selected...");
      if (useMockConnection && mockConnectionRef.current) {
        mockConnectionRef.current.refreshSelectedConnections(selectedRowKeys.map(String));
      } else {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(encrypt(JSON.stringify({
            event: "refreshSelectedRequest",
            data: selectedRowKeys
          })));
        } else {
          console.error("WebSocket not ready for refresh selected");
        }
      }
    };

    // Perform initial refresh
    performRefreshSelected();
    successNotify(i18next.t("NETWORK_MONITOR_AUTO_REFRESH_SELECTED_STARTED") || "Selected auto-refresh started", i18next.t("SUCCESS") || "Success");

    // ADDED: Set up interval refreshing
    refreshSelectedIntervalRef.current = setInterval(() => {
      console.log(`Auto-refresh selected triggered every ${refreshInterval}ms`);
      performRefreshSelected();
    }, refreshInterval);

  }, [selectedRowKeys, isRefreshingSelected, useMockConnection, dispatch, refreshInterval, socket]);

  // ADDED: Stop refresh selected when no items are selected
  useEffect(() => {
    if (selectedRowKeys.length === 0 && isRefreshingSelected) {
      console.log("No items selected, stopping refresh selected");
      dispatch(setIsRefreshingSelected(false));
      if (refreshSelectedIntervalRef.current) {
        clearInterval(refreshSelectedIntervalRef.current);
        refreshSelectedIntervalRef.current = null;
      }
    }
  }, [selectedRowKeys.length, isRefreshingSelected, dispatch]);

  const handleConnect = useCallback(() => {
    console.log("Connecting, mock:", useMockConnection);
    
    if (useMockConnection) {
      if (!mockConnectionRef.current) {
        mockConnectionRef.current = new MockConnection();
      }
      mockConnectionRef.current.connect();
    } else {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(encrypt(JSON.stringify({ event: "connectRequest" })));
      } else {
        errorNotify(i18next.t("NETWORK_MONITOR_CONNECT_FAIL") || "Connection Failed", i18next.t("WEBSOCKET_NOT_READY") || "WebSocket Not Ready");
      }
    }
  }, [useMockConnection, socket]);

  const handleDisconnect = useCallback(() => {
    console.log("Disconnecting selected, mock:", useMockConnection);
    if (selectedRowKeys.length === 0) {
      errorNotify(i18next.t("NETWORK_MONITOR_NO_SELECTION") || "No Selection", i18next.t("INFO") || "Info");
      return;
    }
    
    if (useMockConnection) {
      selectedRowKeys.forEach((id) => 
        mockConnectionRef.current?.disconnect(String(id))
      );
    } else {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          encrypt(JSON.stringify({
            event: "disconnectRequest",
            data: selectedRowKeys,
          }))
        );
      } else {
        errorNotify(i18next.t("NETWORK_MONITOR_DISCONNECT_FAIL") || "Disconnect Failed", i18next.t("WEBSOCKET_NOT_READY") || "WebSocket Not Ready");
      }
    }
  }, [useMockConnection, selectedRowKeys, socket]);

  // FIXED: Handle refresh interval change and update active intervals
  const handleRefreshIntervalChange = useCallback((value: number) => {
    console.log("Changing refresh interval to:", value);
    dispatch(setRefreshInterval(value));
    
    // ADDED: Update active intervals with new value
    if (isRefreshing && refreshAllIntervalRef.current) {
      console.log("Updating refresh all interval");
      clearInterval(refreshAllIntervalRef.current);
      
      const performRefresh = () => {
        if (useMockConnection && mockConnectionRef.current) {
          mockConnectionRef.current.getConnections();
        } else if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(encrypt(JSON.stringify({ event: "getConnectionsRequest" })));
        }
      };
      
      refreshAllIntervalRef.current = setInterval(() => {
        console.log("Updated interval refresh all triggered");
        performRefresh();
      }, value);
    }
    
    if (isRefreshingSelected && refreshSelectedIntervalRef.current) {
      console.log("Updating refresh selected interval");
      clearInterval(refreshSelectedIntervalRef.current);
      
      const performRefreshSelected = () => {
        if (useMockConnection && mockConnectionRef.current) {
          mockConnectionRef.current.refreshSelectedConnections(selectedRowKeys.map(String));
        } else if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(encrypt(JSON.stringify({
            event: "refreshSelectedRequest",
            data: selectedRowKeys
          })));
        }
      };
      
      refreshSelectedIntervalRef.current = setInterval(() => {
        console.log("Updated interval refresh selected triggered");
        performRefreshSelected();
      }, value);
    }
    
    if (useMockConnection && mockConnectionRef.current) {
      mockConnectionRef.current.setUpdateInterval?.(value);
    }
  }, [useMockConnection, dispatch, isRefreshing, isRefreshingSelected, selectedRowKeys, socket]);

  const handleEnableADB = useCallback((connection: Connection) => {
    console.log("Enabling ADB for connection:", connection.id);
    
    if (connection.isPhoneRooted) {
      if (useMockConnection) {
        mockConnectionRef.current?.enableADB?.(connection.id);
        successNotify(`ADB enabled for ${connection.id}`, "Success");
      } else {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(encrypt(JSON.stringify({
            event: "enableADBRequest",
            data: { connectionId: connection.id }
          })));
        } else {
          errorNotify("ADB enable failed", "WebSocket not ready");
        }
      }
    } else {
      errorNotify("Cannot enable ADB", "Device is not rooted");
    }
  }, [useMockConnection, socket]);

  const handleEnableADBGlobally = useCallback(() => {
    console.log("Enabling ADB globally");
    
    const rootedConnections = state.connections.filter(c => c.isPhoneRooted);
    
    if (rootedConnections.length === 0) {
      errorNotify("No rooted devices found", "Info");
      return;
    }
    
    if (useMockConnection) {
      rootedConnections.forEach(connection => {
        mockConnectionRef.current?.enableADB?.(connection.id);
      });
      successNotify(`ADB enabled for ${rootedConnections.length} devices`, "Success");
    } else {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(encrypt(JSON.stringify({
          event: "enableADBGloballyRequest",
          data: rootedConnections.map(c => c.id)
        })));
      } else {
        errorNotify("Global ADB enable failed", "WebSocket not ready");
      }
    }
  }, [useMockConnection, socket, state.connections]);

  const handleUseMockConnectionToggle = useCallback(() => {
    const newMockState = !useMockConnection;
    dispatch(setUseMockConnection(newMockState));
    
    // ADDED: Stop all active refreshing when switching modes
    if (isRefreshing) {
      dispatch(setIsRefreshing(false));
      if (refreshAllIntervalRef.current) {
        clearInterval(refreshAllIntervalRef.current);
        refreshAllIntervalRef.current = null;
      }
    }
    
    if (isRefreshingSelected) {
      dispatch(setIsRefreshingSelected(false));
      if (refreshSelectedIntervalRef.current) {
        clearInterval(refreshSelectedIntervalRef.current);
        refreshSelectedIntervalRef.current = null;
      }
    }
    
    dispatch(setConnections([]));
    
    if (!newMockState && mockConnectionRef.current) {
      mockConnectionRef.current.stopUpdating?.();
      mockConnectionRef.current = null;
    }
  }, [useMockConnection, dispatch, isRefreshing, isRefreshingSelected]);

  return {
    handleConnect,
    handleDisconnect,
    handleRefreshAll,
    handleRefreshSelected,
    handleRefreshIntervalChange,
    handleEnableADB,
    handleEnableADBGlobally,
    handleUseMockConnectionToggle,
  };
};

export default useConnectionManagement;
