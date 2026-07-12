import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TRAINING_SOURCE } from '@/lib/training-leads';

const MAX_ROWS = 200;
const ALLOWED_STATUS = new Set(['new', 'warming', 'dialing', 'done']);

type ImportRow = {
  companyName?: unknown;
  industry?: unknown;
  city?: unknown;
  state?: unknown;
  phone?: unknown;
  website?: unknown;
  ownerName?: unknown;
  status?: unknown;
  notes?: unknown;
};

function str(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

/** Bulk-create prospects from client-parsed CSV rows. */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json().catch(() => ({}));
    const brandId = body.brandId ? String(body.brandId) : null;
    const isTraining =
      body.training === true ||
      body.purpose === 'training' ||
      String(body.source || '') === TRAINING_SOURCE;
    const campaignId = isTraining
      ? null
      : body.campaignId
        ? String(body.campaignId)
        : null;

    if (brandId) {
      const { canManageBrandLeads } = await import('@/lib/brand-leads');
      if (!(await canManageBrandLeads(profile, brandId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (campaignId) {
        const campaign = await prisma.campaign.findFirst({
          where: { id: campaignId, brandId },
          select: { id: true },
        });
        if (!campaign) {
          return NextResponse.json({ error: 'Campaign not found for brand' }, { status: 400 });
        }
      }
    }

    const rawRows = Array.isArray(body.rows) ? (body.rows as ImportRow[]) : null;
    if (!rawRows) {
      return NextResponse.json({ error: 'rows array required' }, { status: 400 });
    }

    const rows = rawRows.slice(0, MAX_ROWS);
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const companyName = str(row.companyName, 160);
      if (!companyName) {
        skipped += 1;
        continue;
      }

      const statusRaw = str(row.status, 32)?.toLowerCase() || 'new';
      const status = ALLOWED_STATUS.has(statusRaw) ? statusRaw : 'new';

      try {
        await prisma.prospect.create({
          data: {
            userId: profile.id,
            brandId,
            campaignId,
            companyName,
            industry: str(row.industry, 80),
            city: str(row.city, 80),
            state: str(row.state, 40),
            phone: str(row.phone, 40),
            website: str(row.website, 300),
            ownerName: str(row.ownerName, 80),
            notes: str(row.notes, 4000) ||
              (isTraining ? 'Training lead — practice only, not a paid campaign dial.' : null),
            status,
            source: isTraining ? TRAINING_SOURCE : 'import',
          },
        });
        created += 1;
      } catch (err: any) {
        errors.push(`Row ${i + 1} (${companyName}): ${err?.message || 'create failed'}`);
      }
    }

    return NextResponse.json({
      created,
      skipped,
      errors,
      truncated: rawRows.length > MAX_ROWS,
      maxRows: MAX_ROWS,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
