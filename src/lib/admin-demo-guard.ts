import { cookies } from 'next/headers';
import {
  ADMIN_DESK_MODE_COOKIE,
  parseAdminDeskModeCookie,
} from '@/lib/admin-context';

/** Block mutating admin APIs while ops desk is in Demo mode. */
export async function assertAdminLiveWrites(): Promise<Response | null> {
  const store = await cookies();
  const mode = parseAdminDeskModeCookie(store.get(ADMIN_DESK_MODE_COOKIE)?.value);
  if (mode === 'demo') {
    return Response.json(
      { error: 'Demo mode is read-only — switch to Live to mutate ops data' },
      { status: 403 }
    );
  }
  return null;
}
