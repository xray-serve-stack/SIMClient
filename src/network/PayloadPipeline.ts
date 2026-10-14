/**
 * PayloadPipeline ΓÇö the single place where payload protection is applied.
 *
 * Mirrors the Python reference in `payload_pipeline.py`.
 *
 * Responsibilities:
 *   - serialize/parse via the MessageDefinition's codec
 *   - apply/remove payload protection (PLAINTEXT vs ENCRYPTED)
 *   - emit diagnostic logs at the codec boundary (see note below)
 *
 * Non-responsibilities:
 *   - it does NOT decide which key to use (that is the caller's job; the
 *     caller resolves the peer's cached shared secret and passes a
 *     ready-to-use encrypt/decrypt function pair)
 *   - it does NOT construct packets
 *   - it does NOT know about specific message types
 *
 * Encryption functions are provided as plain callables so this module has
 * zero dependency on Crypto.ts, RemoteConnection, or IndexedDB. That keeps
 * it testable and reusable.
 *
 * Diagnostics:
 *   The pipeline logs the exact object handed to `codec.serialize` and the
 *   exact object returned by `codec.parse`, plus a `[PIPELINE][ERROR]` line
 *   when either call throws. Logging is scoped strictly to this file; no
 *   codec, definition, handler, worker, store, or crypto file is involved.
 *   The formatter is failure-tolerant so diagnostic formatting can never
 *   break packet processing, and thrown errors are rethrown unchanged so
 *   error semantics are preserved.
 */

import {
  MessageDefinition,
  PayloadProtection,
  PeerRole,
  ProtocolError,
} from "./protocol";

export type EncryptFn = (plaintext: Uint8Array) => Promise<Uint8Array>;
export type DecryptFn = (ciphertext: Uint8Array) => Promise<Uint8Array>;

/**
 * Safe formatter for log output.
 *
 * Tries a pretty-printed JSON form first. If serialization fails for any
 * reason (circular reference, BigInt value, a `toJSON` that throws, an
 * unsupported value type), falls back to a plain string form marked as
 * unformatted. Never throws. Never returns a non-string.
 */
function safeStringify(value: unknown): string {
  if (value === undefined) return "undefined";
  try {
    const json = JSON.stringify(value, null, 2);
    return json === undefined ? "undefined" : json;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    try {
      return `[unformattable: ${reason}] ${String(value)}`;
    } catch {
      return `[unformattable: ${reason}] [unstringifiable]`;
    }
  }
}

/**
 * Log metadata shared by all pipeline log lines. Reads only fields the
 * MessageDefinition contract guarantees, plus the local peer role the
 * pipeline was constructed with.
 */
function describeDefinition(definition: MessageDefinition<unknown>): string {
  return [
    `name=${definition.name}`,
    `id=${definition.id}`,
    // `kind=${definition.kind}`,
    // `category=${definition.category}`,
    // `protection=${definition.protection}`,
    // `peerRole=${peerRole}`,
  ].join(" ");
}

export class PayloadPipeline {
  constructor(private readonly peerRole: PeerRole) {}

  async send<T>(
    definition: MessageDefinition<T>,
    payload: T,
    encrypt: EncryptFn | null,
  ): Promise<Uint8Array> {
    console.log(
      `[PIPELINE][SERIALIZE] ${describeDefinition(
        definition as MessageDefinition<unknown>,
      )}`,
      // payload=${safeStringify(payload)}`,
    );

    let payloadBytes: Uint8Array;
    try {
      payloadBytes = definition.codec.serialize(this.peerRole, payload);
    } catch (error) {
      logPipelineError("serialize", definition, this.peerRole, payload, error);
      throw error;
    }

    switch (definition.protection) {
      case PayloadProtection.PLAINTEXT:
        return payloadBytes;

      case PayloadProtection.ENCRYPTED:
        if (encrypt === null) {
          throw new ProtocolError(
            `PayloadPipeline.send: ENCRYPTED message ${definition.name} has no encrypt function`,
          );
        }
        try {
          return await encrypt(payloadBytes);
        } catch (error) {
          logPipelineError(
            "serialize.encrypt",
            definition,
            this.peerRole,
            payload,
            error,
          );
          throw error;
        }

      default:
        throw new ProtocolError(
          `Unsupported payload protection: ${String(definition.protection)}`,
        );
    }
  }

  async receive<T>(
    definition: MessageDefinition<T>,
    payload: Uint8Array,
    decrypt: DecryptFn | null,
  ): Promise<T> {
    switch (definition.protection) {
      case PayloadProtection.PLAINTEXT: {
        let parsed: T;
        try {
          parsed = definition.codec.parse(this.peerRole, payload);
        } catch (error) {
          logPipelineError("parse", definition, this.peerRole, payload, error);
          throw error;
        }
        console.log(
          `[PIPELINE][PARSE] ${describeDefinition(
            definition as MessageDefinition<unknown>,
          )}`,
          // payloadBytes=${payload.byteLength} parsed=${safeStringify(parsed)}`,
        );
        return parsed;
      }

      case PayloadProtection.ENCRYPTED: {
        if (decrypt === null) {
          throw new ProtocolError(
            `PayloadPipeline.receive: ENCRYPTED message ${definition.name} has no decrypt function`,
          );
        }

        let plaintext: Uint8Array;
        try {
          plaintext = await decrypt(payload);
        } catch (error) {
          logPipelineError(
            "parse.decrypt",
            definition,
            this.peerRole,
            payload,
            error,
          );
          throw error;
        }

        let parsed: T;
        try {
          parsed = definition.codec.parse(this.peerRole, plaintext);
        } catch (error) {
          logPipelineError(
            "parse",
            definition,
            this.peerRole,
            plaintext,
            error,
          );
          throw error;
        }

        console.log(
          `[PIPELINE][PARSE] ${describeDefinition(
            definition as MessageDefinition<unknown>,
          )} payloadBytes=${payload.byteLength} decryptedBytes=${
            plaintext.byteLength
          }`,
          // parsed=${safeStringify(parsed)}`,
        );
        return parsed;
      }

      default:
        throw new ProtocolError(
          `Unsupported payload protection: ${String(definition.protection)}`,
        );
    }
  }
}

/**
 * Emit a `[PIPELINE][ERROR]` line for a failed operation. Reads only fields
 * that are guaranteed by the definition contract and the local state, and
 * is itself wrapped so a failure to log can never replace the original
 * error being propagated.
 */
function logPipelineError<T>(
  operation: string,
  definition: MessageDefinition<T>,
  _peerRole: PeerRole,
  input: unknown,
  error: unknown,
): void {
  try {
    const name =
      error instanceof Error
        ? error.name
        : typeof error === "object" && error !== null && "name" in error
          ? String((error as { name: unknown }).name)
          : typeof error;
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error);
    const stack =
      error instanceof Error && typeof error.stack === "string"
        ? error.stack
        : undefined;

    // Input bytes are logged as a length to avoid dumping binary payloads;
    // everything else is formatted in full.
    const inputForLog =
      input instanceof Uint8Array
        ? `Uint8Array(${input.byteLength})`
        : safeStringify(input);

    console.error(
      `[PIPELINE][ERROR] operation=${operation} ${describeDefinition(
        definition as MessageDefinition<unknown>,
      )} input=${inputForLog} errorName=${name} errorMessage=${message}${
        stack ? ` stack=${stack}` : ""
      }`,
    );
  } catch {
    // Diagnostics must never mask the original error. If logging fails for
    // any reason, drop the log rather than replacing the propagated error.
  }
}
