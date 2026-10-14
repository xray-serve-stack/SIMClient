// src/runtime/initializeClient.ts

import { openChatDbOnce } from "@/cache/chatRepository";
import { seedChatDb } from "@/cache/chatDb";
import {
  initializeClientIdentity,
  type ClientIdentity,
} from "@/cache/clientIdentity";
import { listServes, type Serve } from "@/cache/servesRepository";
import { loadAndApplyConfig } from "@/network/ConfigLoader";

export interface ClientInitResult {
  identity: ClientIdentity;
  serves: Serve[];
}

/**
 * The single, explicit startup sequence.
 *
 *   1. database: open ONCE (possibly rebuild + reseed if the version
 *      changed). The handle is cached for the page lifetime and shared by
 *      every repository function. It is NOT closed here.
 *   2. server config: load SERVER_HOST / SERVER_PORT from `meta`.
 *   3. client X25519 identity: load or generate.
 *   4. Serves: list the (now-seeded) store.
 */
export async function initializeClient(): Promise<ClientInitResult> {
  // 1. Database. Opens once, performs the rebuild if needed, caches the
  //    handle. Nothing below closes it.

  const { created } = await openChatDbOnce();
  await seedChatDb(created);

  // 2. Server config.
  await loadAndApplyConfig();

  // 3. Client identity.
  const identity = await initializeClientIdentity();

  // 4. Serves.
  const serves = await listServes();

  return { identity, serves };
}
