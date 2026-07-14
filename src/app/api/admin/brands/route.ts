import { NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth';
import { loadAdminBrandsMatrix } from '@/lib/admin-platform';
import { writeAudit } from '@/lib/audit';
import { creditWallet } from '@/lib/escrow';
import { grantLeadPack } from '@/lib/lead-credits';
import { prisma } from '@/lib/prisma';
import { assertAdminLiveWrites } from '@/lib/admin-demo-guard';

export async function GET() {
  try {
    await requireOps('admin.access');
    const data = await loadAdminBrandsMatrix();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH — admin overrides on a brand.
 * Body: { brandId, grantCredits?: number, walletAdjustCents?: number, note?: string }
 */
export async function PATCH(req: Request) {
  const demoBlock = await assertAdminLiveWrites();
  if (demoBlock) return demoBlock;

  try {
    const admin = await requireOps('brands.override');
    const body = await req.json();
    const brandId = String(body.brandId || '');
    if (!brandId) {
      return NextResponse.json({ error: 'brandId required' }, { status: 400 });
    }

    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    const note = body.note ? String(body.note).slice(0, 500) : undefined;
    const grantCredits =
      body.grantCredits != null ? Math.round(Number(body.grantCredits)) : null;
    const walletAdjustCents =
      body.walletAdjustCents != null
        ? Math.round(Number(body.walletAdjustCents))
        : null;

    if (
      (grantCredits == null || grantCredits === 0) &&
      (walletAdjustCents == null || walletAdjustCents === 0)
    ) {
      return NextResponse.json(
        { error: 'Provide grantCredits or walletAdjustCents' },
        { status: 400 }
      );
    }

    if (grantCredits != null && grantCredits > 0) {
      await grantLeadPack(brandId, grantCredits, {
        note: note || `Admin grant by ${admin.email}`,
      });
    }

    if (walletAdjustCents != null && walletAdjustCents !== 0) {
      if (walletAdjustCents > 0) {
        await creditWallet({
          brandId,
          amountCents: walletAdjustCents,
          type: 'ADJUSTMENT',
          note: note || `Admin wallet credit by ${admin.email}`,
        });
      } else {
        // Debit via negative adjustment: decrement balance in a ledgered way
        const wallet = await prisma.brandWallet.findUnique({ where: { brandId } });
        if (!wallet) {
          return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
        }
        const debit = Math.abs(walletAdjustCents);
        if (wallet.balanceCents < debit) {
          return NextResponse.json(
            { error: 'Insufficient wallet balance for debit' },
            { status: 400 }
          );
        }
        const balanceAfter = wallet.balanceCents - debit;
        await prisma.$transaction([
          prisma.brandWallet.update({
            where: { id: wallet.id },
            data: { balanceCents: balanceAfter },
          }),
          prisma.walletLedger.create({
            data: {
              walletId: wallet.id,
              type: 'ADJUSTMENT',
              amountCents: -debit,
              balanceAfter,
              note: note || `Admin wallet debit by ${admin.email}`,
            },
          }),
        ]);
      }
    }

    await writeAudit({
      actorId: admin.id,
      action: 'admin.brand.override',
      targetType: 'brand',
      targetId: brandId,
      meta: { grantCredits, walletAdjustCents, note },
    });

    const data = await loadAdminBrandsMatrix();
    return NextResponse.json({ ok: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Superadmin required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
