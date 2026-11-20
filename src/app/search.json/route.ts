// /search.json: the index the search boxes load on first focus (films + people, kept compact).
import { searchIndex } from '@/lib/data';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(searchIndex());
}
