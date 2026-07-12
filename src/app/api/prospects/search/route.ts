import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { searchMapsProspects } from '@/lib/maps/rapidapi';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    const {
      query,
      location,
      maxResults = 8,
      save = true,
      noWebsiteOnly = false,
    } = body;

    if (!query || !location) {
      return NextResponse.json({ error: 'query and location required' }, { status: 400 });
    }

    const results = await searchMapsProspects(
      String(query),
      String(location),
      Number(maxResults),
      { noWebsiteOnly: Boolean(noWebsiteOnly) }
    );

    let saved: { id: string; companyName: string; website: string | null }[] = [];
    if (save && results.length > 0) {
      saved = await Promise.all(
        results.slice(0, 12).map(async (r) => {
          const data = {
            companyName: r.companyName,
            industry: r.industry,
            city: r.city,
            state: r.state,
            phone: r.phone,
            website: r.website || null,
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
                r.phone ? `Phone: ${r.phone}` : null,
              ].filter(Boolean)
            ),
          };

          if (r.placeId) {
            const existing = await prisma.prospect.findFirst({
              where: { userId: profile.id, mapsPlaceId: r.placeId },
            });
            if (existing) {
              return prisma.prospect.update({
                where: { id: existing.id },
                data,
                select: { id: true, companyName: true, website: true },
              });
            }
          }

          return prisma.prospect.create({
            data: {
              userId: profile.id,
              ...data,
            },
            select: { id: true, companyName: true, website: true },
          });
        })
      );
    }

    return NextResponse.json({
      results,
      saved,
      noWebsiteOnly: Boolean(noWebsiteOnly),
      noWebsiteCount: results.filter((r) => !r.hasWebsite).length,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('Prospects search error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const profile = await requireUser();
    const { searchParams } = new URL(req.url);
    const noWebsiteOnly = searchParams.get('noWebsite') === '1';

    const prospects = await prisma.prospect.findMany({
      where: {
        userId: profile.id,
        ...(noWebsiteOnly ? { OR: [{ website: null }, { website: '' }] } : {}),
      },
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
