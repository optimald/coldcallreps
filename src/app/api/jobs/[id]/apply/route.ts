import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { dispatchWebhooks } from '@/lib/webhooks';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const job = await prisma.jobPost.findUnique({
      where: { id },
      include: { poster: { select: { id: true, email: true, displayName: true } } },
    });
    if (!job || !job.active) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (job.posterId === profile.id) {
      return NextResponse.json({ error: 'Cannot apply to your own job' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const message = body.message ? String(body.message).slice(0, 2000) : null;

    const application = await prisma.jobApplication.upsert({
      where: { jobId_userId: { jobId: job.id, userId: profile.id } },
      create: {
        jobId: job.id,
        userId: profile.id,
        message,
        status: 'submitted',
      },
      update: { message, status: 'submitted' },
    });

    // Notify poster via Direct Connect + email when possible
    const notifyBody =
      message ||
      `${profile.displayName || 'A rep'} applied to "${job.title}".`;
    await prisma.directMessage.create({
      data: {
        fromUserId: profile.id,
        toUserId: job.posterId,
        body: `[Job application] ${notifyBody}`.slice(0, 4000),
        status: job.poster.email ? 'queued' : 'queued',
      },
    });

    if (job.poster.email) {
      await sendEmail({
        to: job.poster.email,
        subject: `New application: ${job.title}`,
        html: `<p><strong>${profile.displayName || 'A rep'}</strong> applied to <em>${job.title}</em>.</p>
${message ? `<p>${message.replace(/\n/g, '<br/>')}</p>` : ''}
<p style="color:#666;font-size:12px">Cold Call Reps Jobs</p>`,
      });
    }

    void dispatchWebhooks({
      event: 'application.submitted',
      userId: job.posterId,
      payload: {
        jobId: job.id,
        title: job.title,
        applicantId: profile.id,
        applicantName: profile.displayName,
      },
    });

    return NextResponse.json({ application, notice: 'Application submitted.' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
