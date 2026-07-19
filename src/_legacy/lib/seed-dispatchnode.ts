/**
 * Idempotent first real test campaign: DispatchNode.
 *
 * Run:
 *   npm run seed:dispatchnode
 *   npx tsx src/lib/seed-dispatchnode.ts
 *
 * Upserts by brand slug `dispatchnode` and campaign title so re-runs update
 * content instead of duplicating.
 */

import { prisma } from './prisma';

const BRAND_SLUG = 'dispatchnode';
const CAMPAIGN_TITLE = '$40 booked discovery · DispatchNode';

type PlaybookStep = {
  title: string;
  script: string;
  objections: string[];
};

const DISPATCHNODE = {
  slug: BRAND_SLUG,
  name: 'DispatchNode',
  description:
    'B2B SaaS — AI dispatch & field-ops OS for service businesses. High ACV ($18k–$72k ARR). First live Cold Call Reps test campaign: founder-led outbound for booked discovery meetings.',
  pack: {
    name: 'DispatchNode field-ops outbound',
    icp: {
      vertical: 'B2B SaaS / field ops & dispatch',
      titles: [
        'Founder / CEO',
        'COO',
        'Head of Operations',
        'VP Field Ops',
        'Fleet / Dispatch Manager',
      ],
      companySize: '15–400 employees (multi-crew service businesses)',
      acv: '$18k–$72k ARR',
      pain: 'Manual dispatch boards, radio/Slack chaos, late jobs, no live ETA for customers, techs waiting on the next assignment',
      trigger:
        'Scaling past ~8 techs, missed SLAs, hiring a first ops lead, replacing spreadsheets / ServiceTitan lite workflows',
      offer: 'Book a 20-minute discovery with the founder — map current dispatch stack and whether DispatchNode fits',
    },
    scripts: [
      'Calling founders and ops leads who are still running dispatch from spreadsheets, group chats, or a board that broke the week they hired tech #10.',
      'DispatchNode is an AI-assisted field-ops OS — live board, tech routing, and customer ETAs without ripping out your CRM or accounting stack.',
      'Not selling a rip-and-replace on this call — 20 minutes with the founder to see if your dispatch pain is the kind we actually fix.',
    ],
    objections: [
      'We already use ServiceTitan / Jobber / Housecall Pro.',
      'We built our own dispatch in Notion / Sheets / Slack.',
      'Send me a deck / email me.',
      'No budget this quarter / talk to my partner.',
      'We’re mid-implementation with another vendor.',
      'I don’t take cold calls.',
      'We’re too small / too big for this.',
    ],
  },
  playbook: {
    title: 'DispatchNode founder outbound — book discovery',
    steps: [
      {
        title: 'Open',
        script:
          'Pattern interrupt + ops relevance in under 12 seconds: “Hey [Name] — this is [Rep] calling for DispatchNode. I’ll be straight: we work with founders and ops leads whose dispatch still lives in spreadsheets, group chats, or a board that fell apart after they hired more techs. Is that at all your world, or am I off?” Pause. Confirm you’re on with Founder / COO / Head of Ops / dispatch owner before any pitch.',
        objections: [
          'Who is this?',
          'How’d you get my number?',
          'We’re not interested.',
          'Just send an email.',
          'I don’t take cold calls.',
        ],
      },
      {
        title: 'Qualify',
        script:
          'One discovery question tied to cost of chaos: “When a job runs late or a tech is idle, how do you find out — the board, Slack, or the customer yelling?” Listen for: multi-crew routing, radio/Slack fire drills, no live ETA, spreadsheet “source of truth.” Qualify authority: “Who owns the dispatch board day-to-day — you, or is that a coordinator?” Soft ICP check: multi-tech service business, roughly 15–400 people, feeling scale pain.',
        objections: [
          'We already have ServiceTitan / Jobber.',
          'We built this in-house.',
          'I’m not the right person — talk to ops.',
          'We’re happy with what we have.',
          'Call me next quarter.',
        ],
      },
      {
        title: 'Pitch',
        script:
          'Tie value to the gap they named — one outcome, one proof: “Teams like yours use DispatchNode to keep a live board, route techs without the Slack scramble, and give customers ETAs that don’t lie — typically $18–72k ARR depending on seats and crews. Not asking you to rip CRM or accounting. Worth 20 minutes with our founder to see if the same leak exists on your board?” Stop talking. Differentiate vs. “we already use X”: scheduling software books jobs; DispatchNode runs the day-of chaos between booked and done.',
        objections: [
          'We already use ServiceTitan / Jobber / Housecall Pro.',
          'Too expensive / what’s the price?',
          'We tried something like this.',
          'Need to think about it.',
          'Talk to my co-founder / partner first.',
        ],
      },
      {
        title: 'Close',
        script:
          'Clear calendar ask with two options — goal is BOOKED discovery, not a demo dump: “If I send a one-pager tonight, can we do Tuesday 10 or Thursday 2 for a 20-minute working session with you and whoever owns dispatch?” Confirm attendees, email, and what “good” looks like (e.g. walk their current board and where jobs stall). If they stall on “send a deck,” trade: “Happy to — and I’ll hold those two slots until you reply so this doesn’t die in inbox.” Log: decision-maker confirmed, pain named, meeting time accepted = booked meeting.',
        objections: [
          'Just send a deck.',
          'I need to check with my partner / ops lead.',
          'Not a priority until next fiscal year.',
          'Loop in IT / security first.',
          'We’re locked into a contract.',
        ],
      },
    ] satisfies PlaybookStep[],
  },
};

export async function seedDispatchNode() {
  const brand = await prisma.brand.upsert({
    where: { slug: DISPATCHNODE.slug },
    create: {
      slug: DISPATCHNODE.slug,
      name: DISPATCHNODE.name,
      description: DISPATCHNODE.description,
      ownerId: null,
    },
    update: {
      name: DISPATCHNODE.name,
      description: DISPATCHNODE.description,
    },
  });

  const existingPack = await prisma.productPack.findFirst({
    where: { brandId: brand.id },
    orderBy: { createdAt: 'asc' },
  });

  const packData = {
    name: DISPATCHNODE.pack.name,
    icpJSON: JSON.stringify(DISPATCHNODE.pack.icp),
    scriptsJSON: JSON.stringify(DISPATCHNODE.pack.scripts),
    objectionsJSON: JSON.stringify(DISPATCHNODE.pack.objections),
    active: true,
  };

  const pack = existingPack
    ? await prisma.productPack.update({
        where: { id: existingPack.id },
        data: packData,
      })
    : await prisma.productPack.create({
        data: { brandId: brand.id, ...packData },
      });

  const existingPlaybook = await prisma.playbook.findFirst({
    where: { brandId: brand.id },
    orderBy: { createdAt: 'asc' },
  });

  const playbookData = {
    title: DISPATCHNODE.playbook.title,
    contentJSON: JSON.stringify({ steps: DISPATCHNODE.playbook.steps }),
    userId: null,
    orgId: null,
  };

  const playbook = existingPlaybook
    ? await prisma.playbook.update({
        where: { id: existingPlaybook.id },
        data: playbookData,
      })
    : await prisma.playbook.create({
        data: { brandId: brand.id, ...playbookData },
      });

  const existingCampaign = await prisma.campaign.findFirst({
    where: {
      brandId: brand.id,
      title: CAMPAIGN_TITLE,
    },
  });

  const campaignData = {
    title: CAMPAIGN_TITLE,
    description:
      'Book a 20-minute discovery meeting with a qualified decision-maker for DispatchNode (founder-led B2B SaaS / field-ops tooling). A booked meeting = calendar hold accepted, ICP fit confirmed (founder/ops lead at a multi-crew service business), and pain acknowledged. Practice the pack + playbook first — brands pay per result via Stripe Connect (~20% platform fee).',
    icpText:
      'Titles: Founder/CEO, COO, Head of Ops, VP Field Ops, Fleet/Dispatch Manager. Company: 15–400 employee multi-crew service businesses. ACV: $18k–$72k ARR. Pain: manual dispatch boards, Slack/radio chaos, late jobs, no live ETAs. Qualify: decision-maker confirmed, scale pain named, discovery meeting booked (not just “send a deck”).',
    goalType: 'BOOKED_MEETING' as const,
    payoutCents: 4000,
    platformFeeBps: 2000,
    status: 'OPEN' as const,
    minScore: 75,
    requireCertification: false,
    packId: pack.id,
    playbookId: playbook.id,
    budgetCents: 200000,
    maxAwards: 50,
  };

  const campaign = existingCampaign
    ? await prisma.campaign.update({
        where: { id: existingCampaign.id },
        data: campaignData,
      })
    : await prisma.campaign.create({
        data: {
          brandId: brand.id,
          createdByUserId: null,
          ...campaignData,
        },
      });

  return {
    slug: brand.slug,
    brandId: brand.id,
    packId: pack.id,
    playbookId: playbook.id,
    campaignId: campaign.id,
    campaignTitle: campaign.title,
  };
}

async function main() {
  const result = await seedDispatchNode();
  console.log('Seeded DispatchNode:');
  console.log(
    `  ${result.slug}  brand=${result.brandId}  pack=${result.packId}  playbook=${result.playbookId}`
  );
  console.log(`  campaign="${result.campaignTitle}"  id=${result.campaignId}`);
}

const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('seed-dispatchnode.ts') ||
    process.argv[1].endsWith('seed-dispatchnode.js'));

if (isDirectRun) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
