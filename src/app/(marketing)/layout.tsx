import Link from 'next/link';
import BrandMark from '@/components/BrandMark';
import MarketingHeader from '@/components/MarketingHeader';
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
            Train with AI voice. Prove your skills. Get paid to run outbound for other founders.
          </p>
        </div>
        <div className="mkt-footer-cols">
          <div className="mkt-footer-col">
            <h4>Product</h4>
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/#meet-the-reps">Meet the reps</Link>
            <Link href="/gigs">Brand deals</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/developers">Developers</Link>
          </div>
          <div className="mkt-footer-col">
            <h4>Who it’s for</h4>
            <Link href="/for/reps">Sales Reps</Link>
            <Link href="/for/brands">Brand Founders</Link>
          </div>
          <div className="mkt-footer-col">
            <h4>Get started</h4>
            <Link href="/sign-up?role=REP">Start free</Link>
            <Link href="/sign-in">Sign in</Link>
            <Link href="/dashboard">Dashboard</Link>
          </div>
          <div className="mkt-footer-col">
            <h4>Company</h4>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="mailto:support@coldcallreps.com">Support</a>
            <span style={{ color: 'var(--muted)', fontSize: '0.88rem', display: 'block', marginTop: '0.35rem' }}>
              Live AI voice practice
            </span>
          </div>
        </div>
        <div className="mkt-footer-bottom">© {new Date().getFullYear()} ColdCallReps</div>
      </footer>
    </div>
  );
}
