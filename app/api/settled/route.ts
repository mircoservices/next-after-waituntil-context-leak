import { after } from 'next/server';
import { withPayload } from '../../request-payload';

// Control 1: identical, except the promise settles, so the awaiter drops it.
export function GET() {
  return withPayload(() => {
    after(Promise.resolve());
    return Response.json({ registered: 'already-settled promise' });
  });
}
