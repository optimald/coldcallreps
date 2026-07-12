import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { ThemeProvider } from '@/components/ThemeProvider';
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
  title: {
    default: 'Cold Call Reps — Train. Prove. Get Paid.',
    template: '%s | ColdCallReps',
  },
  description:
    'Train with AI voice. Prove your skills. Get paid to run outbound for other founders. Practice → Prove → Get Paid.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com'),
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Cold Call Reps — Train. Prove. Get Paid.',
    description:
      'Training-first outbound marketplace: AI voice practice, quality gate, paid campaigns for bootstrapped founders.',
    url: 'https://coldcallreps.com',
    siteName: 'ColdCallReps',
    type: 'website',
    images: [{ url: '/og.svg', width: 1200, height: 630, alt: 'ColdCallReps' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cold Call Reps — Train. Prove. Get Paid.',
    description:
      'Train with AI voice. Prove your skills. Get paid to run outbound for other founders.',
    images: ['/og.svg'],
  },
};

/** Runs before paint to restore theme and avoid FOUC. Defaults to Forest Ink (charcoal-mint). */
const THEME_BOOT_SCRIPT = `(function(){try{var k='ccr-theme';var mk='ccr-theme-mig';var mv='refined-1';var v=localStorage.getItem(k);var mig=localStorage.getItem(mk);var ids=['signal-slate','ice-line','ember-ledger','night-dial','ink-voltage','charcoal-mint'];var dark=['night-dial','ink-voltage','charcoal-mint'];var id=v&&ids.indexOf(v)!==-1?v:'charcoal-mint';if(mig!==mv){if(mig!=='athlete-1'&&mig!=='refined-1'&&id==='ember-ledger'){id='charcoal-mint';localStorage.setItem(k,id);}localStorage.setItem(mk,mv);}var mode=dark.indexOf(id)!==-1?'dark':'light';var r=document.documentElement;r.setAttribute('data-theme',id);r.setAttribute('data-color-scheme',mode);r.style.colorScheme=mode;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: 'var(--accent)',
          colorBackground: 'var(--bg-elevated)',
          colorInputBackground: 'var(--bg-soft)',
          colorInputText: 'var(--ink)',
          colorText: 'var(--ink)',
          colorTextSecondary: 'var(--muted)',
          colorNeutral: 'var(--muted)',
          colorDanger: 'var(--bad)',
          colorSuccess: 'var(--good)',
          colorWarning: 'var(--warn)',
          borderRadius: '0.5rem',
        },
        elements: {
          card: {
            background: 'var(--bg-elevated)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--panel-shadow)',
          },
          formButtonPrimary: {
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            borderRadius: '2px',
            fontWeight: '700',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            boxShadow: 'var(--btn-glow)',
          },
          formFieldInput: {
            background: 'var(--bg-soft)',
            color: 'var(--ink)',
            borderColor: 'var(--line)',
          },
          footerActionLink: {
            color: 'var(--accent)',
          },
        },
      }}
    >
      <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        </head>
        <body
          style={
            {
              '--font-display': 'var(--font-display-loaded), sans-serif',
              '--font-body': 'var(--font-body-loaded), sans-serif',
            } as React.CSSProperties
          }
        >
          <ThemeProvider>
            <GoogleAnalytics />
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
