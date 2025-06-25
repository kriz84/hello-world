import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import { useTranslation } from "react-i18next";

// FIXED: Import proper types
import { LiveUpdatesProps } from "@Store/NetworkMiniMonitor/Types";

const LiveUpdates: React.FC<LiveUpdatesProps> = ({ 
  updates, 
  connectionStatus = 'disconnected',
  lastActivity,
  totalMessages = 0 
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'connection': return 'success';
      case 'disconnection': return 'error';
      case 'data': return 'info';
      case 'websocket': return 'primary';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#4caf50';
      case 'connecting': return '#ff9800';
      case 'disconnected': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getTimeSince = (date?: Date) => {
    if (!date) return t('NETWORK_MONITOR_NEVER') || 'Never';
    const seconds = Math.floor((currentTime.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}${t('NETWORK_MONITOR_SECONDS_AGO') || 's ago'}`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}${t('NETWORK_MONITOR_MINUTES_AGO') || 'm ago'}`;
    return `${Math.floor(seconds / 3600)}${t('NETWORK_MONITOR_HOURS_AGO') || 'h ago'}`;
  };

  return (
    <Box sx={{ maxHeight: 140, overflow: 'auto', p: 1 }}>
      {/* Connection status header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography 
          variant="caption" 
          sx={{ 
            fontSize: '10px !important', 
            fontWeight: 600, 
            color: 'text.secondary',
            textTransform: 'uppercase'
          }}
        >
          {t('NETWORK_MONITOR_LIVE_MONITOR') || 'LIVE NETWORK MONITOR'}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: getConnectionStatusColor(),
              animation: connectionStatus === 'connected' ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.5 },
                '100%': { opacity: 1 },
              },
            }}
          />
          <Typography variant="caption" sx={{ fontSize: '9px', color: 'text.secondary' }}>
            {t(`NETWORK_MONITOR_STATUS_${connectionStatus.toUpperCase()}`) || connectionStatus.toUpperCase()}
          </Typography>
        </Box>
      </Box>

      {/* Connection statistics */}
      <Box sx={{ display: 'flex', gap: 2, mb: 1, fontSize: '9px' }}>
        <Typography variant="caption" sx={{ fontSize: '9px', color: 'text.secondary' }}>
          {t('NETWORK_MONITOR_MESSAGES') || 'Messages'}: {totalMessages}
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '9px', color: 'text.secondary' }}>
          {t('NETWORK_MONITOR_LAST_ACTIVITY') || 'Last Activity'}: {getTimeSince(lastActivity)}
        </Typography>
      </Box>

      <Divider sx={{ mb: 1 }} />
      
      {updates.length === 0 ? (
        <Box sx={{ textAlign: 'center', fontSize: '11px', color: 'text.secondary', py: 1 }}>
          {connectionStatus === 'connected' 
            ? (t('NETWORK_MONITOR_MONITORING_TRAFFIC') || 'Monitoring websocket traffic...') 
            : (t('NETWORK_MONITOR_CONNECT_TO_START') || 'Connect to start monitoring')
          }
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {/* FIXED: Properly handle LiveUpdate objects instead of strings */}
          {updates.slice(-8).reverse().map((update, index) => (
            <Box key={update.id || index} sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 0.5, 
              p: 0.5,
              backgroundColor: 'action.hover',
              borderRadius: 0.5,
              fontSize: '10px'
            }}>
              <Typography variant="caption" sx={{ fontSize: '9px', color: 'text.secondary', minWidth: 45 }}>
                {formatTime(update.timestamp)}
              </Typography>
              
              <Chip
                label={t(`NETWORK_MONITOR_TYPE_${update.type.toUpperCase()}`) || update.type}
                color={getTypeColor(update.type)}
                size="small"
                sx={{
                  fontSize: '8px !important',
                  height: '14px !important',
                  '& .MuiChip-label': {
                    padding: '0 3px !important',
                    fontSize: '8px !important',
                  }
                }}
              />
              
              {update.direction && (
                <Box sx={{ 
                  fontSize: '8px', 
                  color: update.direction === 'incoming' ? '#4caf50' : '#2196f3',
                  fontWeight: 'bold'
                }}>
                  {update.direction === 'incoming' ? '↓' : '↑'}
                </Box>
              )}
              
              <Typography variant="caption" sx={{ fontSize: '9px', flex: 1 }}>
                {update.message}
              </Typography>
              
              {update.size && (
                <Typography variant="caption" sx={{ fontSize: '8px', color: 'text.secondary' }}>
                  {update.size}b
                </Typography>
              )}
              
              {update.connectionId && (
                <Typography variant="caption" sx={{ fontSize: '8px', color: 'primary.main' }}>
                  #{update.connectionId}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default LiveUpdates;
