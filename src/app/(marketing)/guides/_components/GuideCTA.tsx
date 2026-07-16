import Link from 'next/link';
import type { GuideCta } from '@/lib/guides';

export default function GuideCTA({
  title,
  sub,
  ctas,
}: {
  title: string;
  sub: string;
  ctas: GuideCta[];
}) {
  return (
    <section className="guide-cta">
      <h2 className="guide-cta__title">{title}</h2>
      <p className="guide-cta__sub">{sub}</p>
      <div className="guide-cta__row">
        {ctas.map((cta) => (
          <Link
            key={cta.href}
            href={cta.href}
            className={cta.primary ? 'btn' : 'btn-ghost'}
          >
            {cta.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
