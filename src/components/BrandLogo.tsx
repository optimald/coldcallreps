'use client';

import { useEffect, useState } from 'react';
import { brandInitials, resolveBrandLogoUrl } from '@/lib/brand-logo';

type Size = 'sm' | 'md' | 'lg' | 'hero';

const SIZE_PX: Record<Size, number> = {
  sm: 36,
  md: 48,
  lg: 72,
  hero: 112,
};

export default function BrandLogo({
  name,
  slug,
  logoUrl,
  size = 'md',
  className = '',
}: {
  name: string;
  slug?: string | null;
  logoUrl?: string | null;
  size?: Size;
  className?: string;
}) {
  const resolved = resolveBrandLogoUrl({ slug, logoUrl });
  const [broken, setBroken] = useState(false);
  const px = SIZE_PX[size];
  const initials = brandInitials(name);
  const showImg = Boolean(resolved) && !broken;

  useEffect(() => {
    setBroken(false);
  }, [resolved]);

  return (
    <span
      className={`brand-logo brand-logo--${size} ${className}`.trim()}
      style={{ width: px, height: px }}
      aria-hidden={showImg ? undefined : true}
      role={showImg ? 'img' : undefined}
      aria-label={showImg ? `${name} logo` : undefined}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved!}
          alt=""
          width={px}
          height={px}
          className="brand-logo__img"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="brand-logo__mono">{initials}</span>
      )}
    </span>
  );
}
