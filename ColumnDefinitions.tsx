import { useAppDispatch } from "@Hook";
import React, { useId, useMemo, useCallback, useState } from "react";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import { ExpandMoreIcon, InfoIcon, BugReportIcon } from "@IconSet";
import { ICellRendererParams, ColDef } from "ag-grid-community";
import { useTranslation } from "react-i18next";
import {
  setActiveMetrics,
  setSelectedConnection,
  setFilters,
} from "@Store/NetworkMiniMonitor/Reducer";
import { Connection, NetworkMiniMonitorState } from "@Store/NetworkMiniMonitor/Types";
import { styled } from "@mui/material/styles";
import useEventCallback from "@mui/utils/useEventCallback";

import {
  getConnectionQuality,
  formatLatency,
  formatThroughput,
  formatPacketLoss,
  getLatencyThreshold,
  getPacketLossThreshold,
} from "./NetworkUtils";

const StyledButton = styled(Button)(({ theme }) => ({
  textTransform: "none",
}));

const StyledChip = styled(Chip)(({ theme }) => ({
  marginRight: theme.spacing(0.5),
}));

const QualityRenderer: React.FC<ICellRendererParams> = React.memo((params) => {
  const quality = getConnectionQuality(params.data);
  const { t } = useTranslation();
  const label = t(`NETWORK_MONITOR_QUALITY_${quality.toUpperCase()}`);
  
  const getChipColor = (quality: string) => {
    switch (quality) {
      case "excellent": return "success";
      case "good": return "success";
      case "fair": return "warning";
      case "poor": return "error";
      default: return "default";
    }
  };

  return (
    <Tooltip 
      title={`Quality: ${label} (Latency: ${params.data.latency}ms, Packet Loss: ${params.data.packetLoss}%)`}
      placement="top"
    >
      <StyledChip
        label={label}
        color={getChipColor(quality)}
        variant="outlined"
        size="small"
        aria-label={`Quality: ${label}`}
        sx={{
          fontSize: '10px !important',
          height: '22px !important',
          '& .MuiChip-label': {
            padding: '0 6px !important',
            fontSize: '10px !important',
          }
        }}
      />
    </Tooltip>
  );
});

const NumericRenderer: React.FC<ICellRendererParams & { 
  formatter: (value: number) => string;
  thresholdFn?: (value: number) => React.CSSProperties;
}> = React.memo((params) => {
  const { formatter, thresholdFn } = params;
  const value = Number(params.value || 0);
  const formattedValue = formatter(value);
  const headerName = params.colDef?.headerName || "Value";
  
  const style: React.CSSProperties = {
    padding: '2px 4px',
    borderRadius: '4px',
    fontWeight: 500,
    fontSize: '11px',
    display: 'block',
    textAlign: 'center',
    width: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    ...(thresholdFn ? thresholdFn(value) : {})
  };

  return (
    <Tooltip title={`${headerName}: ${formattedValue}`} placement="top">
      <span style={style}>
        {formattedValue}
      </span>
    </Tooltip>
  );
});

const BooleanRenderer: React.FC<ICellRendererParams> = React.memo((params) => {
  const { t } = useTranslation();
  const value = Boolean(params.value);
  const label = value ? t("NETWORK_MONITOR_YES") : t("NETWORK_MONITOR_NO");
  const color = value ? "success" : "error";
  const headerName = params.colDef?.headerName || "Field";

  return (
    <Tooltip title={`${headerName}: ${label}`} placement="top">
      <StyledChip
        label={label}
        color={color}
        variant="outlined"
        size="small"
        sx={{
          fontSize: '9px !important',
          height: '20px !important',
          '& .MuiChip-label': {
            padding: '0 4px !important',
            fontSize: '9px !important',
          }
        }}
      />
    </Tooltip>
  );
});

const DateRenderer: React.FC<ICellRendererParams> = React.memo((params) => {
  if (!params.value) return <span style={{ fontSize: '10px', color: '#999' }}>N/A</span>;
  const date = new Date(params.value);
  return (
    <Tooltip title={`Connected: ${date.toLocaleString()}`} placement="top">
      <span style={{ 
        fontSize: '9px',
        display: 'block',
        lineHeight: '1.2',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '100%'
      }}>
        {date.toLocaleString()}
      </span>
    </Tooltip>
  );
});

// FIXED: Better ID renderer for long connection IDs
const IDRenderer: React.FC<ICellRendererParams> = React.memo((params) => {
  const fullId = params.value || '';
  const shortId = fullId.length > 12 ? `${fullId.slice(0, 8)}...${fullId.slice(-4)}` : fullId;
  
  return (
    <Tooltip title={`Full ID: ${fullId}`} placement="top">
      <span style={{ 
        fontWeight: 500, 
        fontSize: '10px',
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '100%'
      }}>
        {shortId}
      </span>
    </Tooltip>
  );
});

export const getColumns = (
  state: NetworkMiniMonitorState,
  t: (key: string) => string,
  setDetailedViewConnection: (record: Connection) => void,
  handleEnableADB: (record: Connection) => void
): ColDef[] => {
  
  const baseCols: ColDef[] = [
    // Checkbox column
    {
      headerName: "",
      width: 50,
      minWidth: 50,
      maxWidth: 50,
      resizable: false,
      sortable: false,
      filter: false,
      suppressHeaderMenuButton: true,
      suppressColumnsToolPanel: true,
      pinned: 'left',
      lockPosition: true,
      suppressMovable: true,
      headerTooltip: t("NETWORK_MONITOR_SELECT_ALL"),
      checkboxSelection: true,
      headerCheckboxSelection: true,
      showDisabledCheckboxes: true,
    },
    // FIXED: ID column with better width and rendering
    {
      headerName: t("NETWORK_MONITOR_CONNECTIONS"),
      field: "id",
      cellRenderer: IDRenderer, // FIXED: Use custom ID renderer
      sortable: true,
      filter: 'agTextColumnFilter',
      width: 140, // FIXED: Optimized width for truncated IDs
      minWidth: 100,
      maxWidth: 200,
      resizable: true,
      headerTooltip: t("NETWORK_MONITOR_CONNECTIONS"),
      filterParams: {
        filterOptions: ['contains', 'startsWith', 'endsWith', 'equals'],
        suppressAndOrCondition: false,
      },
      getQuickFilterText: (params: { value: any }) => params.value,
      cellStyle: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        padding: '4px 8px',
      }
    },
  ];

  const metricCols: ColDef[] = state.activeMetrics.map((metric) => {
    const headerName = t(`NETWORK_MONITOR_METRIC_${metric.toUpperCase()}`);
    const headerTooltip = t(`NETWORK_MONITOR_METRIC_TOOLTIP_${metric.toUpperCase()}`);

    // FIXED: Base column with better defaults to prevent overlap
    const column: ColDef = {
      headerName,
      field: metric,
      sortable: true,
      filter: true,
      width: 110, // FIXED: Smaller default width
      minWidth: 80,
      maxWidth: 180,
      resizable: true,
      headerTooltip,
      getQuickFilterText: (params: { value: any }) => String(params.value || ''),
      cellStyle: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        padding: '2px 6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    };

    switch (metric) {
      case "quality":
        return {
          ...column,
          cellRenderer: QualityRenderer,
          filter: 'agTextColumnFilter',
          width: 90, // FIXED: Specific width for quality
          minWidth: 80,
          filterParams: {
            values: ['excellent', 'good', 'fair', 'poor'],
            valueFormatter: (params: any) => getConnectionQuality(params.data),
          },
        };

      case "connectTime":
      case "connectedAt":
        return {
          ...column,
          field: "connectedAt",
          headerName: t("NETWORK_MONITOR_METRIC_CONNECTTIME") || "Connect Time",
          cellRenderer: DateRenderer,
          filter: 'agTextColumnFilter',
          width: 130, // FIXED: Optimized width for date
          minWidth: 120,
          maxWidth: 160,
        };

      case "latency":
      case "pingTime":
        return {
          ...column,
          cellRenderer: (params: ICellRendererParams) => (
            <NumericRenderer 
              {...params} 
              formatter={formatLatency}
              thresholdFn={getLatencyThreshold}
            />
          ),
          filter: 'agNumberColumnFilter',
          valueFormatter: (params) => formatLatency(Number(params.value || 0)),
          width: 90, // FIXED: Specific width
          minWidth: 80,
          maxWidth: 120,
        };

      case "throughput":
        return {
          ...column,
          cellRenderer: (params: ICellRendererParams) => (
            <NumericRenderer 
              {...params} 
              formatter={formatThroughput}
            />
          ),
          filter: 'agNumberColumnFilter',
          valueFormatter: (params) => formatThroughput(Number(params.value || 0)),
          width: 100, // FIXED: Specific width
          minWidth: 85,
          maxWidth: 130,
        };

      case "packetLoss":
        return {
          ...column,
          cellRenderer: (params: ICellRendererParams) => (
            <NumericRenderer 
              {...params} 
              formatter={formatPacketLoss}
              thresholdFn={getPacketLossThreshold}
            />
          ),
          filter: 'agNumberColumnFilter',
          valueFormatter: (params) => formatPacketLoss(Number(params.value || 0)),
          width: 85, // FIXED: Specific width
          minWidth: 75,
          maxWidth: 110,
        };

      case "adbStatus":
      case "isDevOptionsEnabled":
      case "isPhoneRooted":
        return {
          ...column,
          cellRenderer: BooleanRenderer,
          filter: 'agTextColumnFilter',
          width: 80, // FIXED: Specific width for boolean
          minWidth: 70,
          maxWidth: 100,
          filterParams: {
            values: [true, false],
            valueFormatter: (params: any) => params.value ? t("NETWORK_MONITOR_YES") : t("NETWORK_MONITOR_NO"),
          },
        };

      default:
        return {
          ...column,
          cellRenderer: (params: ICellRendererParams) => (
            <Tooltip title={`${headerName}: ${params.value || ''}`} placement="top">
              <span style={{ 
                fontSize: '10px',
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%'
              }}>
                {String(params.value || '')}
              </span>
            </Tooltip>
          ),
          filter: 'agTextColumnFilter',
          width: 100, // FIXED: Consistent width
          minWidth: 80,
        };
    }
  });

  const actionCol: ColDef = {
    headerName: t("NETWORK_MONITOR_ACTIONS"),
    field: "actions",
    width: 110, // FIXED: Reduced width
    minWidth: 100,
    maxWidth: 130,
    pinned: 'right',
    sortable: false,
    filter: false,
    suppressColumnsToolPanel: true,
    lockPosition: true,
    suppressMovable: true,
    headerTooltip: t("NETWORK_MONITOR_ACTIONS"),
    cellRenderer: (params: ICellRendererParams) => {
      const record: Connection = params.data;
      if (!record) return null;
      
      const menuId = useId();
      const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

      const openMenu = useEventCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setAnchorEl(e.currentTarget);
      });
      const closeMenu = useEventCallback(() => setAnchorEl(null));

      return (
        <>
          <StyledButton
            aria-controls={menuId}
            aria-haspopup="true"
            aria-expanded={anchorEl ? "true" : undefined}
            onClick={openMenu}
            endIcon={<ExpandMoreIcon />}
            size="small"
            sx={{
              fontSize: '9px !important',
              padding: '2px 4px !important',
              minWidth: 'auto'
            }}
          >
            Actions
          </StyledButton>
          <Menu
            id={menuId}
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={closeMenu}
          >
            <MenuItem
              onClick={() => {
                closeMenu();
                setDetailedViewConnection(record);
              }}
            >
              <IconButton size="small" sx={{ mr: 1 }}>
                <InfoIcon fontSize="inherit" />
              </IconButton>
              {t("NETWORK_MONITOR_DETAILED_VIEW")}
            </MenuItem>
            {record.isPhoneRooted && (
              <MenuItem
                onClick={() => {
                  closeMenu();
                  handleEnableADB(record);
                }}
              >
                <IconButton size="small" sx={{ mr: 1 }}>
                  <BugReportIcon fontSize="inherit" />
                </IconButton>
                {t("NETWORK_MONITOR_ENABLE_ADB")}
              </MenuItem>
            )}
          </Menu>
        </>
      );
    },
  };

  return [...baseCols, ...metricCols, actionCol];
};

// Keep the rest of the useColumnManagement hook exactly the same...
export const useColumnManagement = (
  state: NetworkMiniMonitorState,
  tableRef: React.RefObject<HTMLDivElement | null>,
  setDetailedViewConnection: (conn: Connection) => void,
  handleEnableADB: (conn: Connection) => void,
  activeMetrics: string[]
) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const moveColumn = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      
      const newMetrics = [...activeMetrics];
      const [removed] = newMetrics.splice(fromIndex, 1);
      newMetrics.splice(toIndex, 0, removed);
      dispatch(setActiveMetrics(newMetrics));
    },
    [activeMetrics, dispatch]
  );

  const columns = useMemo(() => {
    return getColumns(state, t, setDetailedViewConnection, handleEnableADB);
  }, [state.activeMetrics, state.connections.length, t]);

  const filteredConnections = useMemo(() => {
    return state.connections.filter((connection) =>
      Object.entries(state.filters).every(([key, value]) => {
        if (!value) return true;
        if (key === "quality") {
          return getConnectionQuality(connection) === value;
        }
        return connection[key as keyof Connection] === value;
      })
    );
  }, [state.connections, state.filters]);

  const handleRowClick = useCallback(
    (record: Connection) => {
      dispatch(setSelectedConnection(record));
    },
    [dispatch]
  );

  const addCustomMetric = useCallback(
    (metric: string) => {
      if (metric && !activeMetrics.includes(metric)) {
        dispatch(setActiveMetrics([...activeMetrics, metric]));
      }
    },
    [dispatch, activeMetrics]
  );

  const removeMetric = useCallback(
    (metric: string) => {
      dispatch(setActiveMetrics(activeMetrics.filter((m) => m !== metric)));
    },
    [dispatch, activeMetrics]
  );

  const handleFilter = useCallback(
    (key: string, value: string) => {
      dispatch(setFilters({ ...state.filters, [key]: value }));
    },
    [dispatch, state.filters]
  );

  return {
    filteredConnections,
    handleRowClick,
    addCustomMetric,
    removeMetric,
    handleFilter,
    columns,
    moveColumn,
  };
};
