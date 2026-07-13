import { redirect } from 'next/navigation';

/** Stats desk removed — redirect to Team. */
export default function SdrsStatsRedirect() {
  redirect('/sdrs/team');
}
