export function GET() {
  const log = (globalThis as { __afterLog?: string[] }).__afterLog ?? [];
  return Response.json({ entries: log });
}
