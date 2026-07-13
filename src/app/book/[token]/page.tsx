import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  buildAttributionBookingUrl,
} from '@/lib/booking-attribution';

/**
 * /book/[token] — redirects the prospect (or SDR popup) to the brand calendar
 * with a success redirect back to /book/[token]/done.
 */
export default async function BookRedirectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const claim = await prisma.appointmentClaim.findFirst({
    where: { attributionToken: token },
    include: {
      campaign: { select: { bookingLink: true } },
    },
  });
  if (!claim?.campaign.bookingLink) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <h1>Booking link unavailable</h1>
        <p>This attribution token is invalid or the campaign has no calendar link.</p>
      </main>
    );
  }

  const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_ORIGIN || '').replace(/\/$/, '');
  const doneUrl = `${origin || ''}/book/${token}/done`;
  const { embedUrl } = buildAttributionBookingUrl({
    bookingLink: claim.campaign.bookingLink,
    doneUrl: doneUrl.startsWith('http') ? doneUrl : `https://coldcallreps.com/book/${token}/done`,
  });

  redirect(embedUrl);
}
