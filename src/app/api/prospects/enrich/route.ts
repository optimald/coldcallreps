import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { scrapeWebsiteHooks } from '@/lib/maps/scraper';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    const { url, companyName, prospectId } = body;

    if (!url && !prospectId) {
      return NextResponse.json({ error: 'url or prospectId required' }, { status: 400 });
    }

    let targetUrl = url;
    let existing = null as Awaited<ReturnType<typeof prisma.prospect.findUnique>>;

    if (prospectId) {
      existing = await prisma.prospect.findFirst({
        where: { id: prospectId, userId: profile.id },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
      }
      targetUrl = existing.website || url;
    }

    if (!targetUrl) {
      const hooks = [
        'No website on file — lead with the $500 Lovable site pitch for businesses with zero web presence.',
      ];
      if (existing) {
        await prisma.prospect.update({
          where: { id: existing.id },
          data: { hooksJSON: JSON.stringify(hooks) },
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
        },
      });
    } else {
      prospect = await prisma.prospect.create({
        data: {
          userId: profile.id,
          companyName: companyName || scraped.title || new URL(
            /^https?:/i.test(targetUrl) ? targetUrl : `https://${targetUrl}`
          ).hostname,
          website: String(targetUrl),
          source: 'url',
          hooksJSON: JSON.stringify(scraped.hooks),
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
