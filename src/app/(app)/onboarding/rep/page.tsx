import { redirect } from 'next/navigation';

/** Legacy Accept-SDR page — account type is chosen at /onboarding. */
export default function OnboardingRepRedirectPage() {
  redirect('/onboarding');
}
