'use client';

import { useState, useEffect } from 'react';
import { MARKETPOUNCE_SIGN_UP_REP } from '@/lib/marketpounce';
import { buildSignupUrl, getTrackingParams } from '@/lib/utm';

/**
 * Returns the rep signup URL with first-touch UTM/click ID params appended.
 *
 * On the server and during hydration, returns the static base URL.
 * After hydration, returns the URL with tracking params from sessionStorage
 * and/or the current page URL.
 */
export function useSignupUrl(): string {
  const [url, setUrl] = useState(MARKETPOUNCE_SIGN_UP_REP);

  useEffect(() => {
    const params = getTrackingParams();
    if (Object.keys(params).length > 0) {
      setUrl(buildSignupUrl(MARKETPOUNCE_SIGN_UP_REP, params));
    }
  }, []);

  return url;
}
