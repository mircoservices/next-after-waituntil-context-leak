import { after } from 'next/server';
import { headers } from 'next/headers';
import { requestPayload, withPayload } from '../../request-payload';

// Verifies that `after()` still (a) runs function tasks, (b) runs promise
// tasks, and (c) sees the async context captured at the call site.
const log: string[] = [];
(globalThis as { __afterLog?: string[] }).__afterLog = log;

export async function GET() {
  const marker = String(Date.now());
  return withPayload(() => {
    // (a) function task, which must see request headers and our ALS store
    after(async () => {
      const h = await headers();
      log.push(
        `fn:${marker} host=${h.get('host') ?? 'none'} als=${
          requestPayload.getStore() ? 'visible' : 'missing'
        }`
      );
    });
    // (b) promise task that settles
    after(
      (async () => {
        log.push(`promise:${marker}`);
      })()
    );
    return Response.json({ marker });
  });
}
