/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";

// AG-Grid Community Imports
import { AgGridReact } from "ag-grid-react";
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  ModuleRegistry,
  ClientSideRowModelModule,
  RowSelectionModule,
  _ColumnFilterModule,
  NumberFilterModule,
  TextFilterModule,
  TooltipModule,
  ColumnAutoSizeModule,
  ValidationModule,
  RowAutoHeightModule,
  QuickFilterModule,
  ScrollApiModule,
  ColumnApiModule,
  RowApiModule,
  CellApiModule,
} from "ag-grid-community";
import type { GridOptions } from "ag-grid-community";
import { themeQuartz } from "ag-grid-community";

// MUI Imports
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { styled, alpha, useTheme } from "@mui/material/styles";

// Icon Imports
import {
  VisibilityIcon,
  VisibilityOffIcon,
  SyncDisabledIcon,
  AutorenewIcon,
  SearchIcon,
} from "@IconSet";

// Hook and Translation Imports
import { useAppDispatch, useAppSelector } from "@Hook";
import { useTranslation } from "react-i18next";
import useLocalStorage from "./useLocalStorage";
import { useColumnManagement } from "./ColumnDefinitions";
import useConnectionManagement from "./useConnectionManagement";
import useChartManagement from "./useChartManagement";

// Redux Store Imports
import {
  NetworkMiniMonitorProps,
  Connection,
} from "@Store/NetworkMiniMonitor/Types";
import {
  restoreState,
  setSelectedRowKeys,
  setPosition,
  setSize as setReduxSize,
  setIsMinimized as setReduxIsMinimized,
  setShowGraph,
  resetState,
} from "@Store/NetworkMiniMonitor/Reducer";

// Local Component Imports
import NetworkMonitorBoard from "./NetworkMonitorBoard";
import DetailedConnectionView from "./DetailedConnectionView";
import NetworkChart from "./NetworkChart";
import { availableMetrics, alwaysDisplayedMetrics } from "./Metrics";
import ActionToolbar from "./ActionButtons";
import LiveUpdates from "./LiveUpdates";

// --- AG Grid Module Registration ---
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  RowSelectionModule,
  _ColumnFilterModule,
  NumberFilterModule,
  TextFilterModule,
  TooltipModule,
  ColumnAutoSizeModule,
  RowAutoHeightModule,
  ValidationModule,
  QuickFilterModule,
  ScrollApiModule,
  ColumnApiModule,
  RowApiModule,
  CellApiModule,
]);

/* ——————————————————————————————————————————————————————————————————— */
/* STYLED COMPONENTS                                                  */
/* ——————————————————————————————————————————————————————————————————— */

const ActionSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  position: "relative",
  zIndex: 10000,
  flexShrink: 0,
}));

const ChartSection = styled(Box)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  position: "relative",
  flexShrink: 0,
  height: 400,
}));

const GridControlsSection = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: theme.spacing(1, 2),
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  borderBottom: `1px solid ${theme.palette.divider}`,
  position: "relative",
  zIndex: 10,
  flexShrink: 0,
  minHeight: 56,
}));

const GridSection = styled(Box)(({ theme }) => ({
  flex: 1,
  padding: theme.spacing(1, 2, 2, 2),
  overflow: "hidden",
  position: "relative",
  minHeight: 0,
  
  "& .ag-theme-quartz": {
    height: "100%",
    width: "100%",
    fontSize: "12px",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.spacing(1),
    
    "& .ag-header": {
      backgroundColor: theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5',
      borderBottom: `1px solid ${theme.palette.divider}`,
      fontWeight: 600,
      color: theme.palette.text.primary,
    },
    "& .ag-header-cell": {
      borderRight: `1px solid ${theme.palette.divider}`,
      fontWeight: 600,
      fontSize: "11px",
      color: theme.palette.text.primary,
    },
    
    "& .ag-row": {
      borderBottom: `1px solid ${theme.palette.divider}`,
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary,
      "&:hover": {
        backgroundColor: theme.palette.mode === 'dark' 
          ? 'rgba(255, 255, 255, 0.05)' 
          : 'rgba(0, 0, 0, 0.04)',
      },
      "&.ag-row-selected": {
        backgroundColor: theme.palette.mode === 'dark'
          ? 'rgba(25, 118, 210, 0.15)'
          : 'rgba(25, 118, 210, 0.1)',
      },
      "&.ag-row-odd": {
        backgroundColor: theme.palette.mode === 'dark' 
          ? '#252525' 
          : '#fafafa',
      },
    },
    
    "& .ag-cell": {
      borderRight: `1px solid ${theme.palette.divider}`,
      display: "flex",
      alignItems: "center",
      padding: theme.spacing(0.25, 0.5),
      fontSize: "10px",
      color: theme.palette.text.primary,
      backgroundColor: 'inherit',
    },
    
    "& .ag-menu": {
      zIndex: 99999,
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary,
    },
    "& .ag-popup": {
      zIndex: 99999,
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary,
    },
    "& .ag-select-list": {
      zIndex: 99999,
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary,
    },
    "& .ag-filter-menu": {
      zIndex: 99999,
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary,
    },
    
    "& .ag-input-field-input": {
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary,
      border: `1px solid ${theme.palette.divider}`,
    },
    "& .ag-filter-toolpanel": {
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary,
    },
  },
}));

const LiveUpdatesSection = styled(Box)(({ theme }) => ({
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  maxHeight: 120,
  overflow: "auto",
  flexShrink: 0,
}));

const QuickFilterComponent = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  backgroundColor: alpha(theme.palette.background.paper, 0.9),
  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
  borderRadius: theme.spacing(1),
  padding: theme.spacing(0.5, 1),
  minWidth: 160,
  position: "absolute",
  left: 16,
  top: "50%",
  transform: "translateY(-50%)",
}));

const ViewControls = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  position: "absolute",
  right: 16,
  top: "50%",
  transform: "translateY(-50%)",
}));

const ControlButton = styled(IconButton)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.background.paper, 0.9),
  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
  "&:hover": {
    backgroundColor: alpha(theme.palette.background.paper, 1),
    borderColor: theme.palette.primary.main,
  },
}));

const NetworkMiniMonitor: React.FC<NetworkMiniMonitorProps> = ({
  onClose,
  initialSize = { width: 800, height: 600 },
  initialPosition = { x: 100, y: 100 },
  minWidth = 600,
  minHeight = 400,
  startMinimized = false,
}) => {
  /* ——— Hooks ——— */
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s.networkMiniMonitor);
  const theme = useTheme();
  const { t } = useTranslation();

  /* ——— State and Refs ——— */
  const [savedState, setSavedState] = useLocalStorage<Partial<typeof state>>(
    "networkMonitorState", 
    {}
  );
  const [detailedViewConnection, setDetailedViewConnection] = useState<Connection | null>(null);
  const [showLiveUpdates, setShowLiveUpdates] = useState(true);
  const [quickFilterText, setQuickFilterText] = useState("");
  const gridApiRef = useRef<GridApi<Connection> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ——— Event Handlers ——— */
  const handleResetState = useCallback(() => {
    dispatch(resetState());
    dispatch(setReduxSize(initialSize));
    dispatch(setPosition(initialPosition));
    setQuickFilterText("");
    setShowLiveUpdates(true);
  }, [dispatch, initialSize, initialPosition]);

  const handleAutoSize = useCallback(() => {
    if (gridApiRef.current) {
      gridApiRef.current.sizeColumnsToFit();
    }
  }, []);

  const handleExportCSV = useCallback(() => {
    if (gridApiRef.current) {
      gridApiRef.current.exportDataAsCsv({
        fileName: `network-connections-${new Date().toISOString().split('T')[0]}.csv`
      });
    }
  }, []);

  const handleExportJSON = useCallback(() => {
    if (gridApiRef.current) {
      const data: Connection[] = [];
      gridApiRef.current.forEachNode((node) => {
        if (node.data) {
          data.push(node.data);
        }
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `network-connections-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  const handlePositionChange = useCallback((newPosition: { x: number; y: number }) => {
    dispatch(setPosition(newPosition));
  }, [dispatch]);

  const handleSizeChange = useCallback((newSize: { width: number; height: number }) => {
    dispatch(setReduxSize(newSize));
  }, [dispatch]);

  /* ——— Custom Hooks ——— */
  const {
    handleConnect,
    handleDisconnect,
    handleRefreshAll,
    handleRefreshSelected,
    handleRefreshIntervalChange,
    handleEnableADB,
    handleEnableADBGlobally,
    handleUseMockConnectionToggle,
  } = useConnectionManagement();

  const {
    filteredConnections,
    handleRowClick,
    addCustomMetric,
    removeMetric,
    handleFilter,
    columns,
    moveColumn,
  } = useColumnManagement(
    state,
    containerRef,
    setDetailedViewConnection,
    handleEnableADB,
    state.activeMetrics
  );

  const { toggleGraph } = useChartManagement();

  /* ——— Effects ——— */
  useEffect(() => {
    if (Object.keys(savedState).length > 0) {
      dispatch(restoreState(savedState));
    } else {
      dispatch(setReduxSize(initialSize));
      dispatch(setPosition(initialPosition));
      dispatch(setReduxIsMinimized(startMinimized));
    }
  }, []);

  useEffect(() => {
    setSavedState({
      isMinimized: state.isMinimized,
      showGraph: state.showGraph,
      filters: state.filters,
      size: state.size,
      position: state.position,
      refreshInterval: state.refreshInterval,
      activeMetrics: state.activeMetrics,
      leftAxisMetrics: state.leftAxisMetrics,
      rightAxisMetrics: state.rightAxisMetrics,
      useMockConnection: state.useMockConnection,
    });
  }, [state, setSavedState]);

  /* ——— Grid Configuration ——— */
  const gridTheme = useMemo(() => {
    return theme.palette.mode === "dark" 
      ? themeQuartz.withParams({
          backgroundColor: '#1e1e1e',
          headerBackgroundColor: '#2a2a2a',
          oddRowBackgroundColor: '#252525',
          borderColor: '#404040',
          headerTextColor: '#ffffff',
          cellTextColor: '#e0e0e0',
          selectedRowBackgroundColor: '#1976d220',
        })
      : themeQuartz.withParams({
          backgroundColor: '#ffffff',
          headerBackgroundColor: '#f5f5f5',
          oddRowBackgroundColor: '#fafafa',
          borderColor: '#e0e0e0',
          headerTextColor: '#333333',
          cellTextColor: '#333333',
          selectedRowBackgroundColor: '#1976d220',
        });
  }, [theme]);

  // FIXED: Column definition with better resizing
  const defaultColDef = useMemo<ColDef>(() => ({
    flex: 1,
    minWidth: 80, // FIXED: Smaller minimum width to allow more flexibility
    maxWidth: 400, // FIXED: Add max width to prevent over-expansion
    resizable: true,
    sortable: true,
    filter: true,
    suppressHeaderMenuButton: false,
    headerTooltip: "",
    suppressSizeToFit: false, // FIXED: Allow size to fit
  }), []);

  // FIXED: AG Grid configuration with checkboxes
  const gridOptions = useMemo<GridOptions<Connection>>(() => ({
    theme: gridTheme,
    animateRows: true,
    
    // FIXED: Enable checkboxes for row selection
    rowSelection: {
      mode: "multiRow",
      checkboxes: true, // FIXED: Enable checkboxes
      headerCheckbox: true, // FIXED: Enable header checkbox for select all
      enableSelectionWithoutKeys: true,
      enableClickSelection: false, // FIXED: Disable click selection, use checkboxes only
    },
    
    domLayout: "normal",
    enableCellTextSelection: true,
    ensureDomOrder: true,
    headerHeight: 45,
    rowHeight: 50,
    rowBuffer: 10,
    quickFilterText: quickFilterText,
    includeHiddenColumnsInQuickFilter: false,
    enableBrowserTooltips: true,
    suppressColumnVirtualisation: false,
    suppressAutoSize: false, // FIXED: Allow auto-sizing
  }), [gridTheme, quickFilterText]);

  /* ——— Callbacks ——— */
  const toggleMinimize = useCallback(() => {
    dispatch(setReduxIsMinimized(!state.isMinimized));
  }, [dispatch, state.isMinimized]);

  const onGridReady = useCallback((e: GridReadyEvent<Connection>) => {
    gridApiRef.current = e.api;
    setTimeout(() => {
      e.api.sizeColumnsToFit();
    }, 100);
  }, []);

  const handleToggleGraph = useCallback(() => {
    dispatch(setShowGraph(!state.showGraph));
  }, [dispatch, state.showGraph]);

  const handleQuickFilterChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setQuickFilterText(event.target.value);
  }, []);

  return (
    <NetworkMonitorBoard
      title={t("NETWORK_MONITOR_TITLE") || "Network Monitor"}
      onClose={onClose}
      onMinimize={toggleMinimize}
      isMinimized={state.isMinimized}
      position={state.position}
      size={{
        width: Number(state.size.width),
        height: Number(state.size.height),
      }}
      onPositionChange={handlePositionChange}
      onSizeChange={handleSizeChange}
      minWidth={minWidth}
      minHeight={minHeight}
      maxWidth={1400}
      maxHeight={900}
      zIndex={9999}
    >
      <Box 
        sx={{ 
          display: "flex", 
          flexDirection: "column", 
          height: "100%",
          overflow: "hidden",
        }}
      >
        
        {/* Action Toolbar Section */}
        <ActionSection>
          <ActionToolbar
            toggleMinimize={toggleMinimize}
            onClose={onClose}
            onResetState={handleResetState}
            onAutoSize={handleAutoSize}
            onExportCSV={handleExportCSV}
            onExportJSON={handleExportJSON}
            t={t}
            handleConnect={handleConnect}
            handleDisconnect={handleDisconnect}
            handleRefreshAll={handleRefreshAll}
            handleRefreshSelected={handleRefreshSelected}
            handleRefreshIntervalChange={handleRefreshIntervalChange}
            handleEnableADBGlobally={handleEnableADBGlobally}
            toggleGraph={handleToggleGraph}
            handleUseMockConnectionToggle={handleUseMockConnectionToggle}
            useMockConnection={state.useMockConnection}
            addCustomMetric={addCustomMetric}
            removeMetric={removeMetric}
            handleFilter={handleFilter}
            availableMetrics={availableMetrics}
            isRefreshing={state.isRefreshing}
            isRefreshingSelected={state.isRefreshingSelected}
            selectedRowKeys={state.selectedRowKeys}
            showGraph={state.showGraph}
            refreshInterval={state.refreshInterval}
            activeMetrics={state.activeMetrics}
            filters={state.filters}
            minWidth={minWidth}
            minHeight={minHeight}
          />
        </ActionSection>

        {/* Scrollable main content area */}
        <Box 
          sx={{ 
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(0,0,0,0.05)',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '3px',
              '&:hover': {
                background: 'rgba(0,0,0,0.4)',
              },
            },
          }}
        >
          {/* Chart Section */}
          {state.showGraph && (
            <ChartSection>
              <NetworkChart
                connections={filteredConnections}
                leftAxisMetrics={state.leftAxisMetrics}
                rightAxisMetrics={state.rightAxisMetrics}
                availableMetrics={availableMetrics}
                handleLeftAxisMetricChange={(metrics) => {}}
                handleRightAxisMetricChange={(metrics) => {}}
                t={t}
              />
            </ChartSection>
          )}

          {/* Grid Controls Section */}
          <GridControlsSection>
            <QuickFilterComponent>
              <SearchIcon color="primary" fontSize="small" />
              <TextField
                size="small"
                placeholder={t("NETWORK_MONITOR_QUICK_FILTER") || "Quick Filter..."}
                value={quickFilterText}
                onChange={handleQuickFilterChange}
                variant="standard"
                InputProps={{ disableUnderline: true }}
                sx={{ 
                  width: 140,
                  '& .MuiInputBase-input': {
                    fontSize: '12px',
                    padding: 0,
                  }
                }}
              />
            </QuickFilterComponent>

            <ViewControls>
              {!state.showGraph && (
                <Tooltip title={t("NETWORK_MONITOR_SHOW_GRAPH") || "Show Graph"}>
                  <ControlButton size="small" onClick={handleToggleGraph}>
                    <VisibilityIcon />
                  </ControlButton>
                </Tooltip>
              )}
              <Tooltip title={showLiveUpdates ? "Hide Live Updates" : "Show Live Updates"}>
                <ControlButton 
                  size="small" 
                  onClick={() => {
                    console.log('Live updates toggled:', !showLiveUpdates);
                    setShowLiveUpdates(!showLiveUpdates);
                  }}
                  sx={{
                    backgroundColor: showLiveUpdates ? 'primary.main' : 'transparent',
                    color: showLiveUpdates ? 'primary.contrastText' : 'inherit',
                    position: 'relative',
                    '&:hover': {
                      backgroundColor: showLiveUpdates ? 'primary.dark' : 'action.hover',
                    }
                  }}
                >
                  {showLiveUpdates ? <SyncDisabledIcon fontSize="small" /> : <AutorenewIcon fontSize="small" />}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: state.connectionStatus === 'connected' ? '#4caf50' : '#f44336',
                      border: '1px solid white',
                    }}
                  />
                </ControlButton>
              </Tooltip>
            </ViewControls>
          </GridControlsSection>

          {/* FIXED: Grid Section with checkboxes */}
          <GridSection>
            <div className="ag-theme-quartz" style={{ height: "100%", width: "100%" }}>
              <AgGridReact<Connection>
                {...gridOptions}
                rowData={filteredConnections}
                columnDefs={columns}
                defaultColDef={defaultColDef}
                onGridReady={onGridReady}
                onSelectionChanged={(e) =>
                  dispatch(
                    setSelectedRowKeys(e.api.getSelectedRows().map((r) => r.id))
                  )
                }
                onRowClicked={(e) => e.data && handleRowClick(e.data)}
                getRowId={(p) => p.data.id}
                
                loadingOverlayComponent={() => (
                  <Box sx={{ p: 2, textAlign: "center" }}>
                    <Typography>Loading connections...</Typography>
                  </Box>
                )}
                noRowsOverlayComponent={() => (
                  <Box sx={{ p: 2, textAlign: "center" }}>
                    <Typography>No connections available. Try enabling mock connection.</Typography>
                  </Box>
                )}
              />
            </div>
          </GridSection>

          {/* Live Updates Section */}
          {showLiveUpdates && (
            <LiveUpdatesSection>
              {state.liveUpdates && state.liveUpdates.length > 0 ? (
                <LiveUpdates 
                  updates={state.liveUpdates} 
                  connectionStatus={state.connectionStatus}
                  lastActivity={state.lastActivity}
                  totalMessages={state.totalMessages}
                />
              ) : (
                <Box sx={{ p: 1, textAlign: 'center', fontSize: '11px', color: 'text.secondary' }}>
                  <Typography variant="caption" sx={{ fontSize: '11px' }}>
                    Live Updates Active - Events will appear here
                  </Typography>
                </Box>
              )}
            </LiveUpdatesSection>
          )}
        </Box>
      </Box>

      {/* Details Modal */}
      {detailedViewConnection && (
        <DetailedConnectionView
          connection={detailedViewConnection}
          onClose={() => setDetailedViewConnection(null)}
          setLayoutKey={() => {}}
          activeMetrics={state.activeMetrics}
          alwaysDisplayedMetrics={alwaysDisplayedMetrics}
        />
      )}
    </NetworkMonitorBoard>
  );
};

export default React.memo(NetworkMiniMonitor);
