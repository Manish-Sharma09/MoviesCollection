// /live.json: the films in cinemas with their latest reported figures. The /live/ page reads it every
// few minutes while open, so a data update (every 3 hours) reaches it without a reload.
import { cinemaBoard } from '@/lib/data';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(cinemaBoard());
}
