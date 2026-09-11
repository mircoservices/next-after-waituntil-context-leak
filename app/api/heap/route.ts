// Forces GC (server must run with --expose-gc) and reports heap usage, so the
// measurement is of retained memory rather than of garbage not yet collected.
export async function GET() {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (!gc) {
    return Response.json({ error: 'start the server with NODE_OPTIONS=--expose-gc' }, { status: 500 });
  }
  for (let i = 0; i < 3; i++) {
    gc();
    await new Promise((r) => setTimeout(r, 50));
  }
  const { heapUsed, arrayBuffers, rss } = process.memoryUsage();
  return Response.json({ heapUsed, arrayBuffers, rss });
}
