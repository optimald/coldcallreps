import { NextResponse } from 'next/server';
import { optionalUserId, requireUser } from '@/lib/auth';
import { lookupTwilioPhoneSid, parseBrandPhoneE164 } from '@/lib/brand-phone';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await optionalUserId();
    const brand = await prisma.brand.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        packs: true,
        playbooks: { orderBy: { updatedAt: 'desc' }, take: 20 },
        sponsoredBoards: { where: { active: true } },
        bounties: { where: { active: true } },
        certifications: {
          take: 20,
          orderBy: { score: 'desc' },
          include: { user: { select: { displayName: true } } },
        },
        _count: { select: { campaigns: true } },
      },
    });
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let canEdit = false;
    if (userId) {
      const profile = await prisma.userProfile.findUnique({
        where: { id: userId },
        select: { id: true, platformRole: true, email: true },
      });
      if (profile) canEdit = canManageBrand(profile, brand.ownerId);
    }

    const full = canEdit;
    const stripPack = (p: (typeof brand.packs)[number]) => {
      const { scriptsJSON: _s, objectionsJSON: _o, icpJSON: _i, ...rest } = p;
      return { ...rest, hasContent: true };
    };
    const stripPlaybook = (pb: (typeof brand.playbooks)[number]) => {
      const { contentJSON: _c, ...rest } = pb;
      return { ...rest, hasContent: true };
    };

    return NextResponse.json({
      brand: {
        ...brand,
        canEdit,
        packs: full ? brand.packs : brand.packs.map(stripPack),
        playbooks: full ? brand.playbooks : brand.playbooks.map(stripPlaybook),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH — update name, description, logoUrl, twilioPhoneE164 (owner / superadmin). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const brand = await prisma.brand.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId)) {
      return NextResponse.json({ error: 'Only the brand owner can edit' }, { status: 403 });
    }

    const body = await req.json();
    const data: {
      name?: string;
      description?: string | null;
      logoUrl?: string | null;
      twilioPhoneE164?: string | null;
      twilioPhoneSid?: string | null;
    } = {};

    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
      data.name = name.slice(0, 120);
    }
    if (body.description !== undefined) {
      const d = body.description == null ? '' : String(body.description).trim();
      data.description = d ? d.slice(0, 1000) : null;
    }
    if (body.logoUrl !== undefined) {
      const raw = body.logoUrl == null ? '' : String(body.logoUrl).trim();
      if (!raw) {
        data.logoUrl = null;
      } else if (raw.length > 500) {
        return NextResponse.json({ error: 'logoUrl too long' }, { status: 400 });
      } else if (!/^https?:\/\//i.test(raw) && !raw.startsWith('/')) {
        return NextResponse.json(
          { error: 'logoUrl must be an http(s) URL or a site path like /brands/logo.svg' },
          { status: 400 }
        );
      } else {
        data.logoUrl = raw;
      }
    }

    if (body.twilioPhoneE164 !== undefined || body.twilioPhone !== undefined) {
      try {
        const e164 = parseBrandPhoneE164(body.twilioPhoneE164 ?? body.twilioPhone);
        data.twilioPhoneE164 = e164;
        if (!e164) {
          data.twilioPhoneSid = null;
        } else if (body.twilioPhoneSid !== undefined) {
          const sid = body.twilioPhoneSid == null ? '' : String(body.twilioPhoneSid).trim();
          data.twilioPhoneSid = sid && /^PN[a-f0-9]{32}$/i.test(sid) ? sid : null;
        } else if (body.lookupTwilioSid !== false) {
          const sid = await lookupTwilioPhoneSid(e164);
          data.twilioPhoneSid = sid;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Invalid phone';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    } else if (body.twilioPhoneSid !== undefined) {
      const sid = body.twilioPhoneSid == null ? '' : String(body.twilioPhoneSid).trim();
      if (!sid) {
        data.twilioPhoneSid = null;
      } else if (!/^PN[a-f0-9]{32}$/i.test(sid)) {
        return NextResponse.json(
          { error: 'twilioPhoneSid must look like PN… (IncomingPhoneNumber SID)' },
          { status: 400 }
        );
      } else {
        data.twilioPhoneSid = sid;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await prisma.brand.update({
      where: { id: brand.id },
      data,
    });
    return NextResponse.json({ brand: updated });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
