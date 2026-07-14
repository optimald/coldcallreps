import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import BrandMark from '@/components/BrandMark';
import ThemePicker from '@/components/ThemePicker';

/** Logged-in vanity profile / team pages — minimal chrome, no marketing footer. */
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pub-shell">
      <header className="pub-shell__header">
        <BrandMark href="/dashboard" size="sm" />
        <div className="pub-shell__actions">
          <ThemePicker compact lightDarkOnly />
          <Link href="/dashboard" className="pub-shell__dash">
            Dashboard
          </Link>
          <UserButton
            appearance={{
              elements: {
                avatarBox: { width: 28, height: 28 },
              },
            }}
          />
        </div>
      </header>
      <div className="pub-shell__body">{children}</div>
    </div>
  );
}
