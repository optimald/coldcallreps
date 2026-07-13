/** Client-safe default copy for accept/reject modals. */

export function defaultAcceptMessage(opts: {
  brandName: string;
  campaignTitle: string;
}) {
  return `You're in. ${opts.brandName} accepted you on “${opts.campaignTitle}”. Open the campaign, finish any practice gate, and start dialing with brand caller ID. Live calls already in progress aren’t affected if the campaign later pauses.`;
}

export function defaultRejectMessage(opts: {
  brandName: string;
  campaignTitle: string;
}) {
  return `Thanks for applying to “${opts.campaignTitle}” with ${opts.brandName}. They’re moving forward with other reps this round — keep practicing and watch Brand deals for the next open campaign.`;
}
