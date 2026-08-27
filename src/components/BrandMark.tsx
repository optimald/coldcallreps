import Link from 'next/link';
import { MARKETPOUNCE_SIGN_UP_REP } from '@/lib/marketpounce';

/** Headset mark + wordmark used in nav / marketing / app shell. */
export default function BrandMark({
  href = '/',
  size = 'md',
  className,
  showByline = true,
}: {
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** “by MarketPounce” under the wordmark — eases the auth domain handoff. */
  showByline?: boolean;
}) {
  const h = size === 'lg' ? 36 : size === 'sm' ? 24 : 32;
  const wordSize = size === 'lg' ? '1.35rem' : size === 'sm' ? '1rem' : '1.15rem';
  const bySize = size === 'lg' ? '0.72rem' : size === 'sm' ? '0.58rem' : '0.65rem';
  const gap = size === 'lg' ? 12 : 8;

  return (
    <div
      className={['brand-mark', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
      }}
    >
      <Link
        href={href}
        className="brand-mark__home"
        aria-label="ColdCallReps home"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap,
          flexShrink: 0,
          textDecoration: 'none',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/mark.webp"
          alt=""
          width={h}
          height={h}
          className="brand-mark__icon"
          style={{ display: 'block', borderRadius: 8, objectFit: 'cover' }}
        />
      </Link>
      <span className="brand-mark__text" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
        <Link
          href={href}
          className="brand-mark__wordmark"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: wordSize,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
            textDecoration: 'none',
          }}
        >
          ColdCallReps
        </Link>
        {showByline ? (
          <Link
            href={MARKETPOUNCE_SIGN_UP_REP}
            className="brand-mark__by"
            style={{
              fontFamily: 'var(--font-sans, system-ui, sans-serif)',
              fontWeight: 600,
              fontSize: bySize,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              marginTop: 2,
              textDecoration: 'none',
              width: 'fit-content',
            }}
          >
            by MarketPounce
          </Link>
        ) : null}
      </span>
    </div>
  );
}
