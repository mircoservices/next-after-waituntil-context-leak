import { after } from 'next/server';

// A rejecting after() task, to confirm error reporting is unchanged.
export function GET() {
  after(Promise.reject(new Error('after-task-failed-on-purpose')));
  return Response.json({ ok: true });
}
