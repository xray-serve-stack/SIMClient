import {
  mockContacts,
  mockConversations,
  mockMessages,
  mockSims,
} from "@/mock/chatData";
import {
  __seedSims,
  __seedContacts,
  __seedConversations,
  __seedMessages,
  setMeta,
  EXPECTED_DB_VERSION,
} from "./chatRepository";

// Re-exported for backward compatibility. These now live in
// chatRepository.ts so that __insertDemoServe can own them without a
// chatDb <-> chatRepository import cycle.

/**
 * Demo Serve id is contractually 1.
 */
const DEMO_SERVE_ID = 1;

/**
 * Seed the database.
 *
 * Runs ONLY when `created === true`, i.e. when `openChatDbOnce()` deleted
 * and recreated the DB because its version did not match
 * `EXPECTED_DB_VERSION`.
 *
 * Ordering (must not change):
 *   1. `setMeta("DB_VERSION", ...)` — records the version.
 *   2. `__seedSims(1, mockSims)` — the three Demo SIMs.
 *   3. `getSims(1)` — readback, logged, using the same read path as the UI.
 *   4. contacts, conversations, messages.
 *
 * The Demo Serve (serves.id = 1) is written by `openChatDbOnce` BEFORE this
 * function runs, so at the moment `__seedSims` executes the owning Serve
 * already exists.
 */
export async function seedChatDb(created: boolean): Promise<void> {
  if (!created) return;

  await setMeta("DB_VERSION", String(EXPECTED_DB_VERSION));
  await __seedSims(DEMO_SERVE_ID, mockSims);
  await __seedContacts(DEMO_SERVE_ID, mockContacts);
  await __seedConversations(DEMO_SERVE_ID, mockConversations);
  await __seedMessages(DEMO_SERVE_ID, mockMessages);
}
