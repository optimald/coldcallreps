'use client';

import { SignIn } from '@clerk/nextjs';
import ClerkAuthShell from '@/components/ClerkAuthShell';

export default function SignInPage() {
  return (
    <ClerkAuthShell mode="sign-in">
      <SignIn />
    </ClerkAuthShell>
  );
}
