import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { hasPaidRecruiterAccess } from '@/lib/plans';
import { PLAN } from '@/lib/product';

/** Direct Connect — deliver recruiter → rep messages (email when possible). */
export async function GET(req: Request) {
  try {
    const profile = await requireUser();
    const { searchParams } = new URL(req.url);
    const box = searchParams.get('box') || 'inbox';

    const messages = await prisma.directMessage.findMany({
      where: box === 'sent' ? { fromUserId: profile.id } : { toUserId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        fromUser: { select: { displayName: true, email: true } },
        toUser: { select: { displayName: true, email: true } },
      },
    });

    return NextResponse.json({ messages });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const { toUserId, body } = await req.json();
    if (!toUserId || !body) {
      return NextResponse.json({ error: 'toUserId and body required' }, { status: 400 });
    }

    let seat = await prisma.recruiterSeat.findUnique({ where: { userId: profile.id } });
    if (!hasPaidRecruiterAccess(profile, seat)) {
      return NextResponse.json(
        {
          error: 'Activate the free Recruiter desk to use Direct Connect.',
          code: 'ROLE_REQUIRED',
        },
        { status: 403 }
      );
    }

    // Auto-provision seat for free recruiter role so messaging works after role switch
    if (!seat?.active) {
      seat = await prisma.recruiterSeat.upsert({
        where: { userId: profile.id },
        create: {
          userId: profile.id,
          active: true,
          paid: true,
          creditsRemaining: PLAN.RECRUITER.credits || 100,
        },
        update: { active: true, paid: true },
      });
    }

    if (seat.creditsRemaining < 1) {
      return NextResponse.json(
        {
          error: 'No Direct Connect credits left this month.',
          code: 'CREDITS_EXHAUSTED',
        },
        { status: 402 }
      );
    }

    const recipient = await prisma.userProfile.findUnique({ where: { id: String(toUserId) } });
    if (!recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
    }

    const text = String(body).slice(0, 4000);

    if (recipient.email) {
      const sent = await sendEmail({
        to: recipient.email,
        subject: `Direct Connect from ${profile.displayName || seat.company || 'a recruiter'}`,
        html: `<p>${text.replace(/\n/g, '<br/>')}</p>
<p style="color:#666;font-size:12px">Sent via Cold Call Reps Direct Connect</p>`,
      });
      if (!sent.ok) {
        return NextResponse.json(
          {
            error: 'Email delivery failed. Credit not charged — try again shortly.',
            code: 'EMAIL_FAILED',
          },
          { status: 502 }
        );
      }

      const [msg, updatedSeat] = await prisma.$transaction([
        prisma.directMessage.create({
          data: {
            fromUserId: profile.id,
            toUserId: recipient.id,
            body: text,
            status: 'sent',
          },
        }),
        prisma.recruiterSeat.update({
          where: { id: seat.id },
          data: { creditsRemaining: { decrement: 1 } },
        }),
      ]);

      return NextResponse.json({
        message: msg,
        creditsRemaining: updatedSeat.creditsRemaining,
        notice: 'Message delivered.',
      });
    }

    const [msg, updatedSeat] = await prisma.$transaction([
      prisma.directMessage.create({
        data: {
          fromUserId: profile.id,
          toUserId: recipient.id,
          body: text,
          status: 'queued',
        },
      }),
      prisma.recruiterSeat.update({
        where: { id: seat.id },
        data: { creditsRemaining: { decrement: 1 } },
      }),
    ]);

    return NextResponse.json({
      message: msg,
      creditsRemaining: updatedSeat.creditsRemaining,
      notice: 'Queued in-app (recipient has no email on file).',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
