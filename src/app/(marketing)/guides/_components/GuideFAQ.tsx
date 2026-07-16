import Link from 'next/link';
import type { GuideFaqItem } from '@/lib/guides';

export default function GuideFAQ({ faqs }: { faqs: readonly GuideFaqItem[] }) {
  return (
    <section aria-labelledby="guide-faq-title">
      <h2 id="guide-faq-title" className="guide-h2">
        Frequently asked questions
      </h2>
      <div className="guide-faq">
        {faqs.map((item) => (
          <details key={item.question} className="guide-faq__item">
            <summary className="guide-faq__q">{item.question}</summary>
            <div className="guide-faq__a">
              <p>{item.answer}</p>
              {item.links && item.links.length > 0 ? (
                <div className="guide-faq__links">
                  {item.links.map((l) => (
                    <Link key={l.href} href={l.href} className="soft-link">
                      {l.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
