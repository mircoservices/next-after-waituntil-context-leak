import { after } from 'next/server';
import { withPayload } from '../../request-payload';

// A background task that never settles. `after()` registers it on the server's
// process-lifetime awaiter, which only drains on server close.
export function GET() {
  return withPayload(() => {
    after(new Promise<void>(() => {}));
    return Response.json({ registered: 'never-settling promise' });
  });
}
