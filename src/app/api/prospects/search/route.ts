import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { canManageBrandLeads } from '@/lib/brand-leads';
import { searchMapsProspects } from '@/lib/maps/rapidapi';
import { prisma } from '@/lib/prisma';
import { trackEvent } from '@/lib/posthog/analytics';

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
      brandId: rawBrandId,
      campaignId: rawCampaignId,
    } = body;

    if (!query || !location) {
      return NextResponse.json({ error: 'query and location required' }, { status: 400 });
    }

    const brandId = rawBrandId ? String(rawBrandId) : null;
    const campaignId = rawCampaignId ? String(rawCampaignId) : null;

    if (brandId) {
      if (!(await canManageBrandLeads(profile, brandId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (!campaignId) {
        return NextResponse.json(
          { error: 'campaignId required — enroll saved leads in a campaign' },
          { status: 400 }
        );
      }
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, brandId },
        select: { id: true },
      });
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found for brand' }, { status: 400 });
      }
    }

    const results = await searchMapsProspects(
      String(query),
      String(location),
      Number(maxResults),
      { noWebsiteOnly: Boolean(noWebsiteOnly) }
    );

    trackEvent(profile.id, 'lead_search_started', {
      role: 'BRAND',
      brandId,
      campaignId,
      query: String(query).slice(0, 120),
      location: String(location).slice(0, 120),
      resultCount: results.length,
      save: Boolean(save),
    });

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
            scrapeStatus: 'completed',
            qualifyPhase1: Boolean(r.companyName && r.phone),
            webScanStatus: r.website ? 'queued' : 'skipped',
            enrichmentStatus: 'none',
            outreachReady: false,
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
            ...(brandId ? { brandId, campaignId: campaignId || null } : {}),
          };

          if (r.placeId) {
            const existing = await prisma.prospect.findFirst({
              where: brandId
                ? { brandId, mapsPlaceId: r.placeId }
                : { userId: profile.id, brandId: null, mapsPlaceId: r.placeId },
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
      brandId,
      campaignId,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('Prospects search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const profile = await requireUser();
    const { searchParams } = new URL(req.url);
    const noWebsiteOnly = searchParams.get('noWebsite') === '1';
    const brandId = searchParams.get('brandId')?.trim();

    if (brandId) {
      if (!(await canManageBrandLeads(profile, brandId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const prospects = await prisma.prospect.findMany({
        where: {
          brandId,
          ...(noWebsiteOnly ? { OR: [{ website: null }, { website: '' }] } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return NextResponse.json({ prospects });
    }

    const prospects = await prisma.prospect.findMany({
      where: {
        userId: profile.id,
        brandId: null,
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
