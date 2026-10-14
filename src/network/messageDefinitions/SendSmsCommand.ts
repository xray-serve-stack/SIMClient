// src/network/messageDefinitions/SendSmsCommand.ts

import type { SendSmsRequest } from "./SEND_SMS";

/**
 * Standalone SEND_SMS command.
 *
 * Only the request-data builder is implemented here. The response
 * processor is intentionally absent: the current SEND_SMS flow does not
 * send over the wire, has no dispatcher route for id 15, and has no
 * persisted destination or correlation scheme for a response. The
 * processor will be designed alongside the SEND_SMS flow redesign once
 * message correlation, persistence, status transitions, and UI behavior
 * are defined.
 *
 * Not connected to the runtime.
 */
export class SendSmsCommand {
  /**
   * Construct the `data` field of a SEND_SMS request.
   *
   * The codec validates `subscription_id`, `number`, and `body`. This
   * builder shapes the value only; it does not validate, normalize, or
   * look anything up.
   */
  buildSendSmsData(params: {
    subscription_id: number;
    number: string;
    body: string;
  }): SendSmsRequest["data"] {
    return {
      subscription_id: params.subscription_id,
      number: params.number,
      body: params.body,
    };
  }
}
