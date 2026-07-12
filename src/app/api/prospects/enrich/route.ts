import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { scrapeWebsiteHooks } from '@/lib/maps/scraper';
import { prisma } from '@/lib/prisma';
import { canManageBrandLeads } from '@/lib/brand-leads';

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    const { url, companyName, prospectId, brandId } = body;

    if (!url && !prospectId) {
      return NextResponse.json({ error: 'url or prospectId required' }, { status: 400 });
    }

    let targetUrl = url;
    let existing = null as Awaited<ReturnType<typeof prisma.prospect.findUnique>>;

    if (prospectId) {
      existing = await prisma.prospect.findUnique({ where: { id: prospectId } });
      if (!existing) {
        return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
      }
      const personal = existing.userId === profile.id && !existing.brandId;
      const brandOk =
        !!existing.brandId && (await canManageBrandLeads(profile, existing.brandId));
      if (!personal && !brandOk) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      targetUrl = existing.website || url;
    }

    if (!targetUrl) {
      const hooks = [
        'No website on file — lead with a discovery question about how they get customers today.',
      ];
      if (existing) {
        await prisma.prospect.update({
          where: { id: existing.id },
          data: {
            hooksJSON: JSON.stringify(hooks),
            enrichmentStatus: 'done',
          },
        });
      }
      return NextResponse.json({ hooks, hasWebsite: false, prospectId: existing?.id });
    }

    const scraped = await scrapeWebsiteHooks(String(targetUrl));

    let prospect;
    if (existing) {
      prospect = await prisma.prospect.update({
        where: { id: existing.id },
        data: {
          website: String(targetUrl),
          hooksJSON: JSON.stringify(scraped.hooks),
          enrichmentStatus: 'done',
        },
      });
    } else {
      const createBrandId = brandId ? String(brandId) : null;
      if (createBrandId && !(await canManageBrandLeads(profile, createBrandId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      prospect = await prisma.prospect.create({
        data: {
          userId: profile.id,
          brandId: createBrandId,
          companyName:
            companyName ||
            scraped.title ||
            new URL(/^https?:/i.test(targetUrl) ? targetUrl : `https://${targetUrl}`).hostname,
          website: String(targetUrl),
          source: 'url',
          hooksJSON: JSON.stringify(scraped.hooks),
          enrichmentStatus: 'done',
        },
      });
    }

    return NextResponse.json({
      prospectId: prospect.id,
      companyName: prospect.companyName,
      ...scraped,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('Enrich error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
