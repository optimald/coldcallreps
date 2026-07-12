import { NextResponse } from 'next/server';
import { requireUser, optionalUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { effectiveRole, isSuperadmin } from '@/lib/roles';

function stripPackSecrets<T extends { scriptsJSON?: string; objectionsJSON?: string; icpJSON?: string }>(
  pack: T,
  full: boolean
) {
  if (full) return pack;
  const { scriptsJSON: _s, objectionsJSON: _o, icpJSON: _i, ...rest } = pack as any;
  return { ...rest, hasContent: true };
}

function stripPlaybookSecrets<T extends { contentJSON?: string }>(playbook: T, full: boolean) {
  if (full) return playbook;
  const { contentJSON: _c, ...rest } = playbook as any;
  return { ...rest, hasContent: true };
}

/**
 * GET /api/brands
 * - Brand / Recruiter: **only brands you own** (never other companies)
 * - SDR / Manager: practice catalog (for trainer pack picker) unless ?mine=1
 * - Superadmin: all
 * - ?practice=1: force practice catalog (trainer)
 * - ?mine=1: force owned-only
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forceMine = searchParams.get('mine') === '1';
    const forcePractice = searchParams.get('practice') === '1';

    const userId = await optionalUserId();
    let where: { ownerId?: string } | undefined;

    if (userId) {
      const profile = await prisma.userProfile.findUnique({
        where: { id: userId },
        select: { id: true, platformRole: true, email: true },
      });
      if (profile) {
        const role = effectiveRole(profile);
        const wantsMine =
          forceMine ||
          (!forcePractice && (role === 'BRAND' || role === 'RECRUITER'));
        if (wantsMine && !isSuperadmin(profile)) {
          where = { ownerId: profile.id };
        }
        // Superadmin + practice / SDR catalog: no owner filter
      }
    } else if (!forcePractice) {
      // Anonymous: do not dump every company's brand list
      return NextResponse.json({ brands: [] });
    }

    const brands = await prisma.brand.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        packs: { where: { active: true }, take: 5 },
        playbooks: { take: 5, orderBy: { updatedAt: 'desc' } },
        _count: { select: { certifications: true, bounties: true } },
      },
    });

    const full = Boolean(userId);
    return NextResponse.json({
      brands: brands.map((b) => ({
        ...b,
        packs: b.packs.map((p) => stripPackSecrets(p, full)),
        playbooks: b.playbooks.map((pb) => stripPlaybookSecrets(pb, full)),
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const slug =
      String(body.slug || name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || `brand-${Date.now()}`;

    if (profile.platformRole === 'REP') {
      const { serializeUnlockedRoles, parseUnlockedRoles } = await import('@/lib/role-mode');
      const unlocked = new Set(
        parseUnlockedRoles(profile.unlockedRolesJSON, profile.platformRole).map(String)
      );
      unlocked.add('REP');
      unlocked.add('BRAND');
      await prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          platformRole: 'BRAND',
          brandOnboardedAt: profile.brandOnboardedAt || new Date(),
          unlockedRolesJSON: serializeUnlockedRoles(unlocked),
        },
      });
    }

    let logoUrl: string | null = null;
    if (body.logoUrl != null && String(body.logoUrl).trim()) {
      const raw = String(body.logoUrl).trim().slice(0, 500);
      if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) logoUrl = raw;
    }

    const brand = await prisma.brand.create({
      data: {
        ownerId: profile.id,
        name: name.slice(0, 120),
        slug,
        description: body.description ? String(body.description).slice(0, 1000) : null,
        logoUrl,
        packs: body.pack
          ? {
              create: {
                name: String(body.pack.name || 'Default pack').slice(0, 120),
                icpJSON: JSON.stringify(body.pack.icp || {}),
                scriptsJSON: JSON.stringify(body.pack.scripts || []),
                objectionsJSON: JSON.stringify(body.pack.objections || []),
              },
            }
          : undefined,
      },
      include: { packs: true },
    });
    return NextResponse.json({ brand });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
