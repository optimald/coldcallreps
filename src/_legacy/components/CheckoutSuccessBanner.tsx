'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CheckoutSuccessBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setShow(true);
      router.replace('/dashboard');
    }
  }, [searchParams, router]);

  if (!show) return null;

  return (
    <div
      className="checkout-success-banner"
      role="status"
    >
      <span>Subscription active — your minutes are topped up. Time to grind.</span>
      <button
        type="button"
        className="checkout-success-banner__dismiss"
        onClick={() => setShow(false)}
      >
        Dismiss
      </button>
    </div>
  );
}
