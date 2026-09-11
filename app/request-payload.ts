import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Stands in for whatever a real request keeps in async context. In an App
 * Router render that is Next's own request/work-unit store, which holds the RSC
 * flight payload; here it is one megabyte we can actually measure.
 */
export const requestPayload = new AsyncLocalStorage<{ bytes: Buffer }>();

export const PAYLOAD_BYTES = 1024 * 1024;

export function withPayload<T>(fn: () => T): T {
  return requestPayload.run({ bytes: Buffer.allocUnsafe(PAYLOAD_BYTES) }, fn);
}
