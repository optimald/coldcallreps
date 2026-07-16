'use client';

import { useState } from 'react';

/**
 * Segmented SDR/Brand switch for the pricing page. Renders both panels in the
 * DOM (good for SEO / no-JS) but only shows the active one when JS is on.
 */
export default function PricingSwitch({
  sdr,
  brand,
}: {
  sdr: React.ReactNode;
  brand: React.ReactNode;
}) {
  const [tab, setTab] = useState<'sdr' | 'brand'>('sdr');

  return (
    <div className="pricing-switch">
      <div className="pricing-seg" role="tablist" aria-label="Pricing audience">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sdr'}
          className={`pricing-seg__btn${tab === 'sdr' ? ' is-active' : ''}`}
          onClick={() => setTab('sdr')}
        >
          For sales reps
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'brand'}
          className={`pricing-seg__btn${tab === 'brand' ? ' is-active' : ''}`}
          onClick={() => setTab('brand')}
        >
          For brands
        </button>
      </div>

      <div role="tabpanel" hidden={tab !== 'sdr'}>
        {sdr}
      </div>
      <div role="tabpanel" hidden={tab !== 'brand'}>
        {brand}
      </div>
    </div>
  );
}
