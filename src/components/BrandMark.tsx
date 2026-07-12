import Link from 'next/link';

/** Headset mark + wordmark used in nav / marketing / app shell. */
export default function BrandMark({
  href = '/',
  size = 'md',
  className,
}: {
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const h = size === 'lg' ? 36 : size === 'sm' ? 24 : 32;
  return (
    <Link
      href={href}
      className={['brand-mark', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'lg' ? 12 : 8,
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: size === 'lg' ? '1.35rem' : size === 'sm' ? '1rem' : '1.15rem',
        letterSpacing: '-0.02em',
        color: 'var(--ink)',
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
      <span className="brand-mark__wordmark">ColdCallReps</span>
    </Link>
  );
}
