import { withPayload } from '../../request-payload';

// Control 2: the same never-settling promise is created in the same async
// context, but never handed to `after()`.
export function GET() {
  return withPayload(() => {
    void new Promise<void>(() => {});
    return Response.json({ registered: 'nothing' });
  });
}
