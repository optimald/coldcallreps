import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { checkRepHandleAvailable } from '@/lib/profile-slug';

/** Live handle availability for rep public profiles. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    if (!q.trim()) {
      return NextResponse.json({ available: false, handle: null, error: 'Enter a handle.' });
    }

    let userId: string | undefined;
    try {
      const { userId: clerkId } = await auth();
      // UserProfile.id is the Clerk user id
      if (clerkId) userId = clerkId;
    } catch {
      /* public check ok */
    }

    const result = await checkRepHandleAvailable(q, userId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
