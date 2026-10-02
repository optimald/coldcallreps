import { describe, expect, it } from 'vitest';
import { extractTrackingParams, buildSignupUrl } from './utm';

describe('extractTrackingParams', () => {
  it('extracts utm_* params from search string', () => {
    const search = '?utm_source=facebook&utm_campaign=sdr_recruit_wk1&utm_content=3';
    const result = extractTrackingParams(search);
    expect(result).toEqual({
      utm_source: 'facebook',
      utm_campaign: 'sdr_recruit_wk1',
      utm_content: '3',
    });
  });

  it('extracts gclid and fbclid', () => {
    const search = '?gclid=abc123&fbclid=xyz789';
    const result = extractTrackingParams(search);
    expect(result).toEqual({
      gclid: 'abc123',
      fbclid: 'xyz789',
    });
  });

  it('extracts mixed tracking params', () => {
    const search = '?utm_source=google&gclid=abc&other=ignored';
    const result = extractTrackingParams(search);
    expect(result).toEqual({
      utm_source: 'google',
      gclid: 'abc',
    });
  });

  it('ignores non-tracking params', () => {
    const search = '?foo=bar&page=1&ref=someone';
    const result = extractTrackingParams(search);
    expect(result).toEqual({});
  });

  it('handles empty search string', () => {
    expect(extractTrackingParams('')).toEqual({});
    expect(extractTrackingParams('?')).toEqual({});
  });
});

describe('buildSignupUrl', () => {
  const baseUrl = 'https://www.marketpounce.com/sign-up?role=REP&from=ccr';

  it('appends tracking params to base URL', () => {
    const result = buildSignupUrl(baseUrl, {
      utm_source: 'facebook',
      utm_campaign: 'sdr_recruit_wk1',
      utm_content: '3',
    });
    expect(result).toBe(
      'https://www.marketpounce.com/sign-up?role=REP&from=ccr&utm_source=facebook&utm_campaign=sdr_recruit_wk1&utm_content=3'
    );
  });

  it('preserves role=REP and from=ccr even if incoming params try to override', () => {
    const result = buildSignupUrl(baseUrl, {
      role: 'BRAND',
      from: 'other',
      utm_source: 'facebook',
    });
    expect(result).toBe(
      'https://www.marketpounce.com/sign-up?role=REP&from=ccr&utm_source=facebook'
    );
    expect(result).not.toContain('role=BRAND');
    expect(result).not.toContain('from=other');
  });

  it('returns base URL when no tracking params', () => {
    const result = buildSignupUrl(baseUrl, {});
    expect(result).toBe(baseUrl);
  });

  it('handles gclid and fbclid', () => {
    const result = buildSignupUrl(baseUrl, {
      gclid: 'abc123',
      fbclid: 'xyz789',
    });
    expect(result).toBe(
      'https://www.marketpounce.com/sign-up?role=REP&from=ccr&gclid=abc123&fbclid=xyz789'
    );
  });

  it('example: full A/B test URL', () => {
    const result = buildSignupUrl(baseUrl, {
      utm_source: 'facebook',
      utm_campaign: 'sdr_recruit_wk1',
      utm_content: '3',
      utm_medium: 'cpc',
    });
    expect(result).toContain('utm_source=facebook');
    expect(result).toContain('utm_campaign=sdr_recruit_wk1');
    expect(result).toContain('utm_content=3');
    expect(result).toContain('utm_medium=cpc');
    expect(result).toContain('role=REP');
    expect(result).toContain('from=ccr');
  });
});
