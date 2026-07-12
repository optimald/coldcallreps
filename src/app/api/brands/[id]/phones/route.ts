import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  BRAND_PHONE_POOL_MAX,
  areaCodeFromE164,
  configureBrandNumberWebhooks,
  lookupTwilioPhoneSid,
  parseBrandPhoneE164,
} from '@/lib/brand-phone';

async function assertCanManageBrand(profileId: string, brandId: string, role: string) {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return { error: 'Brand not found', status: 404 as const };
  if (role !== 'SUPERADMIN' && brand.ownerId !== profileId) {
    return { error: 'Forbidden', status: 403 as const };
  }
  return { brand };
}

/** GET — list brand phone pool + fallback. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const gate = await assertCanManageBrand(profile.id, id, profile.platformRole);
    if ('error' in gate) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const [numbers, brand] = await Promise.all([
      prisma.brandPhoneNumber.findMany({
        where: { brandId: id },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.brand.findUnique({
        where: { id },
        select: { fallbackPhoneE164: true, inboundGreeting: true },
      }),
    ]);

    return NextResponse.json({
      numbers,
      fallbackPhoneE164: brand?.fallbackPhoneE164 ?? null,
      inboundGreeting: brand?.inboundGreeting ?? null,
      maxPool: BRAND_PHONE_POOL_MAX,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[brands/phones GET]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

/** POST — attach existing Twilio DID to pool { e164, label? }. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const gate = await assertCanManageBrand(profile.id, id, profile.platformRole);
    if ('error' in gate) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const body = await request.json();
    const e164 = parseBrandPhoneE164(body.e164 ?? body.phone);
    if (!e164) {
      return NextResponse.json({ error: 'e164 is required' }, { status: 400 });
    }

    const count = await prisma.brandPhoneNumber.count({ where: { brandId: id, isActive: true } });
    if (count >= BRAND_PHONE_POOL_MAX) {
      return NextResponse.json(
        { error: `Pool max is ${BRAND_PHONE_POOL_MAX} active numbers` },
        { status: 400 }
      );
    }

    const areaCode = areaCodeFromE164(e164);
    if (!areaCode) {
      return NextResponse.json({ error: 'Could not parse area code from number' }, { status: 400 });
    }

    let twilioSid =
      typeof body.twilioSid === 'string' && /^PN[a-f0-9]{32}$/i.test(body.twilioSid.trim())
        ? body.twilioSid.trim()
        : await lookupTwilioPhoneSid(e164);

    const row = await prisma.brandPhoneNumber.upsert({
      where: { brandId_e164: { brandId: id, e164 } },
      create: {
        brandId: id,
        e164,
        twilioSid,
        areaCode,
        label: typeof body.label === 'string' ? body.label.trim() || null : null,
        isActive: true,
      },
      update: {
        twilioSid: twilioSid || undefined,
        areaCode,
        label: typeof body.label === 'string' ? body.label.trim() || null : undefined,
        isActive: true,
      },
    });

    if (row.twilioSid) {
      await configureBrandNumberWebhooks(row.twilioSid);
    }

    // Keep legacy field in sync with first active DID for older code paths
    await prisma.brand.update({
      where: { id },
      data: { twilioPhoneE164: e164, twilioPhoneSid: twilioSid },
    });

    return NextResponse.json({ number: row });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('E.164')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[brands/phones POST]', error);
    return NextResponse.json({ error: 'Failed to attach number' }, { status: 500 });
  }
}

/** PATCH — update fallback / greeting / deactivate number. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const gate = await assertCanManageBrand(profile.id, id, profile.platformRole);
    if ('error' in gate) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const body = await request.json();

    if (body.fallbackPhoneE164 !== undefined || body.inboundGreeting !== undefined) {
      const data: { fallbackPhoneE164?: string | null; inboundGreeting?: string | null } = {};
      if (body.fallbackPhoneE164 !== undefined) {
        data.fallbackPhoneE164 = parseBrandPhoneE164(body.fallbackPhoneE164);
      }
      if (body.inboundGreeting !== undefined) {
        data.inboundGreeting =
          body.inboundGreeting == null ? null : String(body.inboundGreeting).slice(0, 500);
      }
      await prisma.brand.update({ where: { id }, data });
    }

    if (body.numberId && body.isActive === false) {
      await prisma.brandPhoneNumber.updateMany({
        where: { id: body.numberId, brandId: id },
        data: { isActive: false },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('E.164')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[brands/phones PATCH]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

/** DELETE — remove number from pool ?numberId= */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const gate = await assertCanManageBrand(profile.id, id, profile.platformRole);
    if ('error' in gate) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const numberId = request.nextUrl.searchParams.get('numberId');
    if (!numberId) {
      return NextResponse.json({ error: 'numberId required' }, { status: 400 });
    }

    await prisma.brandPhoneNumber.deleteMany({
      where: { id: numberId, brandId: id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[brands/phones DELETE]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
