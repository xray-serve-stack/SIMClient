// src/main.tsx

import { SharedSecretCache } from "@/network/SharedSecretCache";
import { base64ToBytes } from "@/cache/clientIdentity";
import {
  setActiveServeIdProvider,
  setActiveChatProvider,
} from "@/runtime/activeServeProvider";
import { CurrentServe } from "@/runtime/currentServe";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { initializeClient } from "./runtime/initializeClient";
import { closeDb } from "./cache/chatRepository";
import { startRuntime } from "./runtime/startRuntime";
import { useChatStore } from "./store/chatStore";
import { remoteConnection } from "./network/RemoteConnection";
import { enqueueCommand } from "./runtime/commandQueue";
import { CommandType } from "./runtime/commands";

async function bootstrap() {
  // 1. DB + config + identity + serves. Opens the single shared DB handle.
  const { identity, serves } = await initializeClient();

  // 2. Populate the shared-secret cache for every stored Serve, then point
  //    RemoteConnection at the initially selected Serve (if any).
  const clientPrivateKey = base64ToBytes(identity.privateKeyB64);

  for (const serve of serves) {
    try {
      await SharedSecretCache.ensure(serve.public_key, clientPrivateKey);
    } catch (error) {
      console.warn(
        `[SIMClient] failed to precompute shared secret for Serve ${serve.device_name}:`,
        error,
      );
    }
  }
  SharedSecretCache.retainOnly(serves.map((s) => s.public_key));

  const initialServe = serves[0];
  if (initialServe && typeof initialServe.id === "number") {
    CurrentServe.set(initialServe.id, initialServe.public_key);
    console.info(
      `[SIMServe][SERVE] initial serve set: serveId=${initialServe.id} pub=${initialServe.public_key}`,
    );
  }

  // 3. Network lifecycle.
  await remoteConnection.init();

  // WATCH_PEERS is issued once per successful authentication, including
  // every reconnect. The callback only enqueues the command; the worker
  // reads the Serve list, sorts the public keys, and sends the request.
  remoteConnection.setOnAuthenticated(() => {
    enqueueCommand({ type: CommandType.WATCH_PEERS });
  });

  remoteConnection.connect();

  // 4. Wire the runtime providers so ApplicationDispatcher can read the
  //    active serve id and the active conversation number without
  //    importing the store directly.
  setActiveServeIdProvider(() => useChatStore.getState().activeServeId);
  setActiveChatProvider(() => useChatStore.getState().activeChat);

  // 5. Runtime and initial data.
  startRuntime();
  useChatStore.getState().requestInitialData();

  // 6. Render.
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
}

// Close the shared DB handle on tab teardown.
window.addEventListener("beforeunload", () => {
  try {
    closeDb();
  } catch {
    /* ignore */
  }
});

bootstrap().catch((error) => {
  console.error("Failed to initialize SIMClient:", error);
});
