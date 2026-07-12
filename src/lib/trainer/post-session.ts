import { prisma } from '@/lib/prisma';
import { hasBlockingIntegrity } from '@/lib/integrity-gate';
import { dispatchWebhooks } from '@/lib/webhooks';

export interface PostSessionAwards {
  certification?: { brandId: string; label: string; score: number };
  bountiesCleared: { id: string; title: string; minScore: number; rewardCents: number }[];
  tournamentUpdates: number;
  bountyCreditsEarned: number;
}

/** After a scored session: brand certs, attribution, bounty hits, tournament scores. */
export async function applyPostSessionAwards(opts: {
  userId: string;
  overallScore: number;
  focusArea: string;
  pointsEarned: number;
  brandId?: string | null;
  packId?: string | null;
  integrityFlagsJSON?: string | null;
  sessionId?: string;
}): Promise<PostSessionAwards> {
  const result: PostSessionAwards = {
    bountiesCleared: [],
    tournamentUpdates: 0,
    bountyCreditsEarned: 0,
  };

  const blocked = hasBlockingIntegrity(opts.integrityFlagsJSON);
  const brandId = opts.brandId || null;

  if (brandId) {
    await prisma.attributionEvent.create({
      data: {
        userId: opts.userId,
        brandId,
        eventType: 'brand_session_scored',
        metaJSON: JSON.stringify({
          score: opts.overallScore,
          packId: opts.packId || null,
          focusArea: opts.focusArea,
          pointsEarned: opts.pointsEarned,
          blocked,
        }),
      },
    });

    // Certs only for clean high-scoring sessions
    if (!blocked && opts.overallScore >= 80) {
      const brand = await prisma.brand.findUnique({ where: { id: brandId } });
      if (brand) {
        const label = `${brand.name} Certified Closer`;
        const cert = await prisma.certification.upsert({
          where: {
            brandId_userId: { brandId, userId: opts.userId },
          },
          create: {
            brandId,
            userId: opts.userId,
            score: opts.overallScore,
            label,
          },
          update: {
            score: opts.overallScore,
            label,
          },
        });
        result.certification = {
          brandId: cert.brandId,
          label: cert.label,
          score: cert.score,
        };
      }
    }

    if (!blocked) {
      const bounties = await prisma.bounty.findMany({
        where: { brandId, active: true, minScore: { lte: opts.overallScore } },
      });

      let credits = 0;
      for (const b of bounties) {
        // Idempotent: one award per user per bounty
        try {
          await prisma.bountyAward.create({
            data: {
              bountyId: b.id,
              userId: opts.userId,
              rewardCents: b.rewardCents,
              sessionId: opts.sessionId || null,
            },
          });
        } catch (err: any) {
          // Unique constraint — already awarded
          if (err?.code === 'P2002') continue;
          throw err;
        }

        result.bountiesCleared.push({
          id: b.id,
          title: b.title,
          minScore: b.minScore,
          rewardCents: b.rewardCents,
        });

        await prisma.attributionEvent.create({
          data: {
            userId: opts.userId,
            brandId,
            eventType: 'bounty_cleared',
            metaJSON: JSON.stringify({
              bountyId: b.id,
              title: b.title,
              score: opts.overallScore,
              rewardCents: b.rewardCents,
              sessionId: opts.sessionId || null,
            }),
          },
        });
        credits += Math.max(0, b.rewardCents || 0);
        void dispatchWebhooks({
          event: 'bounty.cleared',
          userId: opts.userId,
          payload: {
            bountyId: b.id,
            title: b.title,
            rewardCents: b.rewardCents,
            score: opts.overallScore,
            brandId,
          },
        });
      }
      if (credits > 0) {
        await prisma.userProfile.update({
          where: { id: opts.userId },
          data: { bountyCredits: { increment: credits } },
        });
        result.bountyCreditsEarned = credits;
      }
    }
  }

  const activeEntries = await prisma.tournamentEntry.findMany({
    where: {
      userId: opts.userId,
      tournament: { active: true },
    },
    include: { tournament: true },
  });

  for (const entry of activeEntries) {
    const focus = entry.tournament.focusArea;
    if (focus && focus !== opts.focusArea) continue;
    // Flagged sessions don't advance tournament standings
    if (blocked) continue;
    const nextScore = entry.score + opts.pointsEarned;
    await prisma.tournamentEntry.update({
      where: { id: entry.id },
      data: { score: nextScore },
    });
    result.tournamentUpdates += 1;
  }

  return result;
}
