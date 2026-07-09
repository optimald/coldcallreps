import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display-loaded',
  weight: ['500', '600', '700', '800'],
});

const body = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body-loaded',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Cold Call Reps — Master Your Reps. Become a Top Rep.',
  description:
    'Voice-based cold call training for SDRs and outbound hustlers. Practice gatekeeper calls, $500 website pitches, and climb the leaderboard.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${display.variable} ${body.variable}`}>
        <body
          style={
            {
              '--font-display': 'var(--font-display-loaded), sans-serif',
              '--font-body': 'var(--font-body-loaded), sans-serif',
            } as React.CSSProperties
          }
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
