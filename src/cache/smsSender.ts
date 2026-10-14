import type { SendSmsPayload } from "@/types";

/**
 * v0.1.0 local SMS send stub.
 *
 * There is no real transport in the client yet. This simulates a successful
 * send and resolves with the payload. The OutputWorker path still runs the
 * full command -> result -> handler flow, so replacing this stub with a real
 * transport later does not touch the pipeline.
 */

export async function sendSmsStub(
  _serveId: number,
  _payload: SendSmsPayload,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 80));
  return;
}
