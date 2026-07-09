import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { searchMapsProspects } from '@/lib/maps/rapidapi';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    const { query, location, maxResults = 8, save = true } = body;

    if (!query || !location) {
      return NextResponse.json({ error: 'query and location required' }, { status: 400 });
    }

    const results = await searchMapsProspects(String(query), String(location), Number(maxResults));

    let saved: { id: string; companyName: string }[] = [];
    if (save && results.length > 0) {
      saved = await Promise.all(
        results.slice(0, 8).map(async (r) => {
          const p = await prisma.prospect.create({
            data: {
              userId: profile.id,
              companyName: r.companyName,
              industry: r.industry,
              city: r.city,
              state: r.state,
              phone: r.phone,
              website: r.website,
              reviewRating: r.reviewRating,
              reviewCount: r.reviewCount,
              mapsPlaceId: r.placeId,
              source: 'maps',
              hooksJSON: JSON.stringify(
                [
                  r.website
                    ? `Has website: ${r.website}`
                    : 'NO WEBSITE listed on Google Maps — strong $500 pitch angle',
                  r.reviewRating
                    ? `Rated ${r.reviewRating} (${r.reviewCount || 0} reviews)`
                    : null,
                ].filter(Boolean)
              ),
            },
            select: { id: true, companyName: true },
          });
          return p;
        })
      );
    }

    return NextResponse.json({ results, saved });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('Prospects search error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const profile = await requireUser();
    const prospects = await prisma.prospect.findMany({
      where: { userId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ prospects });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
