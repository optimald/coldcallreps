import Link from 'next/link';
import BrandMark from '@/components/BrandMark';
import MarketingHeader from '@/components/MarketingHeader';
import { MARKETPOUNCE_SIGN_UP_REP } from '@/lib/marketpounce';
import './landing.css';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <MarketingHeader />
      <div style={{ flex: 1 }}>{children}</div>
      <footer className="mkt-footer">
        <div>
          <BrandMark size="sm" />
          <p className="mkt-footer-note" style={{ marginTop: '0.55rem' }}>
            Recruiting SDRs: train with AI voice, prove your skills, get paid on brand deals.
          </p>
        </div>
        <div className="mkt-footer-cols">
          <div className="mkt-footer-col">
            <h4>For SDRs</h4>
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/for/reps">SDR path</Link>
            <Link href="/pricing">Practice pricing</Link>
            <Link href="/guides">Guides</Link>
          </div>
          <div className="mkt-footer-col">
            <h4>Get started</h4>
            <a href={MARKETPOUNCE_SIGN_UP_REP}>Start free</a>
          </div>
          <div className="mkt-footer-col">
            <h4>Company</h4>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="mailto:support@coldcallreps.com">Support</a>
          </div>
        </div>
        <div className="mkt-footer-bottom">© {new Date().getFullYear()} ColdCallReps</div>
      </footer>
    </div>
  );
}
