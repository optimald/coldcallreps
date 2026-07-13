/**
 * Idempotent demo brands + packs + playbooks for trainer practice.
 *
 * Run:
 *   npx tsx src/lib/seed-demo-brands.ts
 *
 * Upserts by slug (`demo-*`) so re-runs update content instead of duplicating.
 */

import { prisma } from './prisma';
import { seedTrainingLeads } from './training-leads';

type PlaybookStep = {
  title: string;
  script: string;
  objections: string[];
};

type DemoBrandSeed = {
  slug: string;
  name: string;
  description: string;
  pack: {
    name: string;
    icp: Record<string, unknown>;
    scripts: string[];
    objections: string[];
  };
  playbook: {
    title: string;
    steps: PlaybookStep[];
  };
};

const DEMO_BRANDS: DemoBrandSeed[] = [
  {
    slug: 'demo-meridianops',
    name: 'Demo · MeridianOps',
    description:
      'B2B SaaS — revenue operations platform for mid-market / enterprise sales orgs. High ACV ($28k–$90k ARR). Demo content for cold-call practice.',
    pack: {
      name: 'RevOps pipeline visibility',
      icp: {
        vertical: 'B2B SaaS / RevOps',
        titles: ['VP Sales', 'CRO', 'Head of RevOps', 'Sales Ops Manager'],
        companySize: '80–800 employees',
        acv: '$28k–$90k ARR',
        pain: 'Forecast miss, CRM hygiene, handoff leakage between SDR→AE→CS',
        trigger: 'Missed quarter, new CR O hire, Salesforce cleanup project',
      },
      scripts: [
        'Calling because most mid-market teams we talk to are still forecasting from spreadsheets bolted onto Salesforce — curious if that’s you.',
        'We help RevOps get a single source of truth for pipeline stages so leadership isn’t arguing about whose CRM is right in QBRs.',
        'Not pitching a rip-and-replace — 20 minutes to show how MeridianOps sits on your existing CRM and flags stale deals before they blow the forecast.',
      ],
      objections: [
        'We already use Salesforce / HubSpot — we’re fine.',
        'We built dashboards in-house.',
        'Send me a deck / email me.',
        'No budget this quarter / talk to procurement.',
        'We’re mid-implementation with another vendor.',
        'I don’t take cold calls.',
      ],
    },
    playbook: {
      title: 'MeridianOps enterprise cold call',
      steps: [
        {
          title: 'Open',
          script:
            'Pattern interrupt + relevance in under 12 seconds: “Hey [Name] — this is [Rep] with MeridianOps. I’ll be blunt: we work with RevOps and sales leaders who keep missing forecast by 10–15% because stage data in Salesforce is stale. Is that a fair description of your world, or am I off?” Pause. Confirm you’re on with VP Sales / CRO / Head of RevOps before any pitch.',
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
            'One discovery question tied to cost of the problem: “When you walk into a forecast call, how much time do you spend arguing about which deals are real vs. cleaning CRM?” Listen for: multi-tool mashup, SDR→AE leakage, CS churn surprises. Mirror their words. Qualify authority: “Who owns the forecast number with the CEO — you, or is that shared with RevOps?”',
          objections: [
            'We already have Salesforce dashboards.',
            'We built this in-house.',
            'I’m not the right person — talk to Ops.',
            'We’re happy with what we have.',
            'Call me next quarter.',
          ],
        },
        {
          title: 'Pitch',
          script:
            'Tie value to the gap they named — one outcome, one proof: “Teams like [similar ICP] use MeridianOps on top of Salesforce to auto-flag stale stages and cut forecast variance in half within a quarter — typically $28–90k ARR depending on seats. Not asking you to rip anything out. Worth 20 minutes to see if the same leak exists on your board?” Stop talking. Handle “we already use X” by differentiating: CRM stores deals; MeridianOps polices pipeline truth.',
          objections: [
            'We already use Salesforce / Gong / Clari.',
            'Too expensive / what’s the price?',
            'We tried something like this.',
            'Need to think about it.',
            'Talk to procurement first.',
          ],
        },
        {
          title: 'Close',
          script:
            'Clear calendar ask with two options: “If I send a 3-slide brief tonight, can we do Tuesday 10 or Thursday 2 for a 20-minute working session with you and whoever owns RevOps?” Confirm attendees, email, and what “good” looks like (e.g. show stale-deal detection on a sample pipeline). If they stall on “send a deck,” trade: “Happy to — and I’ll hold those two slots until you reply so this doesn’t die in inbox.”',
          objections: [
            'Just send a deck.',
            'I need to check with my partner / CRO.',
            'Not a priority until next fiscal year.',
            'Loop in procurement / security first.',
            'We’re locked into a contract.',
          ],
        },
      ],
    },
  },
  {
    slug: 'demo-harborline',
    name: 'Demo · Harborline Benefits',
    description:
      'Insurance — high-ticket life, commercial, and Medicare Advantage enrollments. Demo agency for phone sales practice ($3k–$25k+ first-year commission / case value).',
    pack: {
      name: 'Life · commercial · MA enrollments',
      icp: {
        vertical: 'Insurance (life / commercial / Medicare Advantage)',
        titles: ['Business owner', 'Benefits decision-maker', 'Medicare-eligible household'],
        caseValue: '$3k–$25k+ first-year value',
        pain: 'Underinsured gaps, rising group premiums, confusing MA plan changes',
        compliance: 'No pressure; educate and book licensed review — never guarantee coverage on a cold call',
      },
      scripts: [
        'Calling local employers who are seeing 12–20% group health renewals — we run a no-cost benefits review to see if there’s a better structure before the next anniversary.',
        'For Medicare: “Open enrollment windows move fast — I help people compare Advantage options so they’re not stuck with a plan that doesn’t cover their doctors.”',
        'For life: “Most business owners we talk to have a buy-sell or key-person gap they didn’t realize until something happened — 10 minutes to check coverage vs. payroll risk.”',
      ],
      objections: [
        'I’m not interested / we already have an agent.',
        'Can you mail me information?',
        'I’ve already taken care of my Medicare / insurance.',
        'I don’t want to deal with Medicare Advantage.',
        'Too expensive / we can’t afford more premium.',
        'Call me back after busy season.',
      ],
    },
    playbook: {
      title: 'Harborline high-ticket insurance call',
      steps: [
        {
          title: 'Open',
          script:
            'Warm, licensed-feeling, non-pushy: “Hi [Name], this is [Rep] with Harborline Benefits. I help [business owners / folks coming up on Medicare] make sure they’re not overpaying or under-covered before renewal / enrollment windows close. Did I catch you at an okay moment for 30 seconds?” Confirm decision-maker. Never pitch products off a cold open — earn permission to ask one question.',
          objections: [
            'I’m not interested.',
            'Who are you with?',
            'We already have an agent.',
            'Can you mail me something?',
            'How did you get my number?',
          ],
        },
        {
          title: 'Qualify',
          script:
            'Discover the gap without diagnosing on the call: Commercial — “When’s your group renewal, and have premiums moved more than 10% the last two years?” Life — “If something happened to you tomorrow, how many months of payroll or debt is actually covered today?” MA — “Are you on Original Medicare, an Advantage plan, or still deciding — and is your primary doctor still in-network?” Educate that an informed choice beats a rushed one. Confirm spouse/partner involvement early.',
          objections: [
            'I’ve already taken care of it.',
            'I don’t want Medicare Advantage.',
            'We’re happy with our broker.',
            'I don’t handle benefits — talk to my spouse / HR.',
            'We’re not taking new quotes.',
          ],
        },
        {
          title: 'Pitch',
          script:
            'Position a licensed review, not a product dump: “I don’t sell on this call — I run a side-by-side so you can see premium, network, and gaps in plain English. Most [owners / retirees] we help either save on renewal or fix a coverage hole they didn’t know about. If nothing’s better, you keep what you have.” Anchor trust: no pressure, cancel anytime where applicable, licensed appointment.',
          objections: [
            'Too expensive.',
            'I need to think about it.',
            'Just email me the options.',
            'I got burned by an agent before.',
            'My kids / accountant handle this.',
          ],
        },
        {
          title: 'Close',
          script:
            'Book the review with two times and confirm who must be present: “Let’s do a 20-minute licensed review — Tuesday 11 or Wednesday 4. Will [spouse/partner/benefits lead] join so we don’t redo this twice?” Collect best callback number and email. Confirm: “If we find you’re already optimized, I’ll say so in the first five minutes.” Log Do-Not-Call preferences if they decline.',
          objections: [
            'Call me after busy season / open enrollment.',
            'Send info first — then maybe.',
            'I need to check with my spouse.',
            'Not a priority right now.',
            'Put me on a do-not-call list.',
          ],
        },
      ],
    },
  },
  {
    slug: 'demo-summitshield',
    name: 'Demo · SummitShield Home',
    description:
      'Home services — high-ticket roofing, HVAC replacement, and residential solar. Demo contractor brand for phone sales ($8k–$45k project range).',
    pack: {
      name: 'Roof · HVAC · solar appointments',
      icp: {
        vertical: 'Home services (roofing / HVAC / solar)',
        titles: ['Homeowner', 'Property decision-maker'],
        projectSize: '$8k–$45k',
        pain: 'Storm damage, failing HVAC, rising energy bills, contractor trust',
        trigger: 'Storm season, summer heat, utility rate hike, age of roof/system 12+ years',
      },
      scripts: [
        'Calling neighbors in [ZIP] after the recent storms — checking if you’ve had a free roof inspection yet or if you’re waiting on an adjuster.',
        'HVAC: “If your system is 12+ years and summer bills spiked, we run a no-obligation load calc and quote — most replacements we do land $8–18k installed.”',
        'Solar: “Homeowners don’t usually write a $30k check — we walk financing and payback so you can see if the math works before anyone on your roof.”',
      ],
      objections: [
        'We don’t have $30,000 / too expensive.',
        'Gotta ask my spouse / the boss.',
        'We already have a guy / got three quotes.',
        'Just had it looked at / no damage.',
        'Send me something in the mail / email.',
        'We’re not interested in solar / contractors.',
      ],
    },
    playbook: {
      title: 'SummitShield home services appointment set',
      steps: [
        {
          title: 'Open',
          script:
            'Local + specific: “Hey [Name], this is [Rep] with SummitShield Home — we work roofs, HVAC, and solar for homeowners in [city]. I’m calling because [storms hit your area / systems your age usually fail in peak season / neighbors are locking in before install backlog]. Got 30 seconds?” Confirm homeowner / decision-maker. Sound like a local pro, not a robocall.',
          objections: [
            'Who is this?',
            'We’re not interested.',
            'We already have a contractor.',
            'No damage / system is fine.',
            'Take me off your list.',
          ],
        },
        {
          title: 'Qualify',
          script:
            'Surface urgency and authority: Roof — “Any leaks, missing shingles, or an adjuster visit still open?” HVAC — “How old is the system, and have repair bills stacked this year?” Solar — “What’s a typical summer electric bill, and do you own the home free-and-clear enough to consider financing?” Always ask: “Will you and [spouse] both want to be there for numbers?” Trust objection early: licensed, insured, local references.',
          objections: [
            'Just got three quotes.',
            'Gotta ask my spouse.',
            'We don’t have the money.',
            'I can DIY / wait another year.',
            'Insurance will handle it.',
          ],
        },
        {
          title: 'Pitch',
          script:
            'Sell the appointment, not the full job: “I’m not asking you to buy on this call. We do an on-site inspection / load calc / solar site survey — you get options with price ranges before anyone starts work. Most [roof/HVAC/solar] projects we run are $8–45k depending on scope; financing is available so you’re not writing a cash check.” Proof: storm claims help, manufacturer warranties, neighbor installs. For solar cash objection: “Most homeowners don’t pay cash — want to see if the monthly works vs. your utility bill?”',
          objections: [
            'We don’t have $30,000.',
            'Your competitor is cheaper.',
            'I need to think about it.',
            'Send me a price by email.',
            'Solar / contractors are a scam.',
          ],
        },
        {
          title: 'Close',
          script:
            'Two time options + both decision-makers: “Can we do Tuesday morning or Thursday evening so you and [spouse] can both hear the options? Inspection takes about [45–90] minutes and there’s no charge for the visit.” Confirm address, gate codes, pets, and best cell. Soft alternate: “If Thursday’s better after you talk it over, text me and I’ll hold the slot.” Never discount on the phone — protect the in-home close.',
          objections: [
            'Just email a quote.',
            'Call back after busy season / winter.',
            'I need my spouse first.',
            'Not a priority until we see insurance money.',
            'We’re talking to someone else already.',
          ],
        },
      ],
    },
  },
];

export async function seedDemoBrands() {
  const results: { slug: string; brandId: string; packId: string; playbookId: string }[] = [];

  for (const demo of DEMO_BRANDS) {
    const brand = await prisma.brand.upsert({
      where: { slug: demo.slug },
      create: {
        slug: demo.slug,
        name: demo.name,
        description: demo.description,
        ownerId: null,
      },
      update: {
        name: demo.name,
        description: demo.description,
      },
    });

    const existingPack = await prisma.productPack.findFirst({
      where: { brandId: brand.id },
      orderBy: { createdAt: 'asc' },
    });

    const packData = {
      name: demo.pack.name,
      icpJSON: JSON.stringify(demo.pack.icp),
      scriptsJSON: JSON.stringify(demo.pack.scripts),
      objectionsJSON: JSON.stringify(demo.pack.objections),
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
      title: demo.playbook.title,
      contentJSON: JSON.stringify({ steps: demo.playbook.steps }),
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

    results.push({
      slug: brand.slug,
      brandId: brand.id,
      packId: pack.id,
      playbookId: playbook.id,
    });
  }

  // Idempotent OPEN campaigns on each demo brand (gigs marketplace + practice)
  const campaignSeeds: {
    slug: string;
    title: string;
    description: string;
    icpText: string;
    goalType: 'QUALIFIED_LEAD' | 'BOOKED_MEETING';
    payoutCents: number;
    budgetCents: number;
    maxAwards: number;
  }[] = [
    {
      slug: 'demo-meridianops',
      title: '$30 qualified lead · MeridianOps',
      description:
        'Book discovery calls that meet MeridianOps ICP (VP Sales / CRO / Head of RevOps at 80–800 employee B2B SaaS). A qualified lead = decision-maker confirmed, pain acknowledged, and next step agreed. Practice the pack first — brands pay per result via Stripe Connect (~20% platform fee).',
      icpText:
        'Titles: VP Sales, CRO, Head of RevOps, Sales Ops Manager. Company size: 80–800. ACV: $28k–$90k ARR. Pain: forecast miss, CRM hygiene, SDR→AE handoff leakage.',
      goalType: 'QUALIFIED_LEAD',
      payoutCents: 3000,
      budgetCents: 150000,
      maxAwards: 50,
    },
    {
      slug: 'demo-meridianops',
      title: '$250 enterprise meeting · MeridianOps',
      description:
        'Booked 20-minute working session with VP Sales / CRO / Head of RevOps. Calendar hold + attendees confirmed. High ACV SaaS practice gig.',
      icpText:
        'Enterprise / upper mid-market SaaS. Decision-maker on forecast. Willing to review overlay tools on Salesforce.',
      goalType: 'BOOKED_MEETING',
      payoutCents: 25000,
      budgetCents: 200000,
      maxAwards: 20,
    },
    {
      slug: 'demo-harborline',
      title: '$175 life / commercial appointment · Harborline',
      description:
        'Set a licensed benefits review with a business owner or agency decision-maker. Appointment = calendar hold + decision-maker confirmed. Insurance practice gig ($3k–$25k+ case value).',
      icpText:
        'Business owners, benefits leads, life/commercial agency principals. Renewal pressure or underinsured gaps.',
      goalType: 'BOOKED_MEETING',
      payoutCents: 17500,
      budgetCents: 175000,
      maxAwards: 40,
    },
    {
      slug: 'demo-harborline',
      title: '$125 Medicare Advantage enrollment set · Harborline',
      description:
        'Book a licensed MA plan comparison review during AEP / OEP windows. Compliance-first: educate and schedule — never pressure or guarantee coverage on the cold call.',
      icpText:
        'Medicare-eligible households / Advantage shoppers. Primary doctor network concerns. Spouse often involved.',
      goalType: 'BOOKED_MEETING',
      payoutCents: 12500,
      budgetCents: 125000,
      maxAwards: 40,
    },
    {
      slug: 'demo-summitshield',
      title: '$85 roof inspection set · SummitShield',
      description:
        'Book an on-site roof inspection for homeowners with storm damage, aging roofs, or open adjuster visits. Inspection appointment = both decision-makers when possible.',
      icpText:
        'Homeowners, storm ZIP codes, roofs 12+ years, hail/wind claims open. Project size $8k–$45k.',
      goalType: 'BOOKED_MEETING',
      payoutCents: 8500,
      budgetCents: 85000,
      maxAwards: 50,
    },
    {
      slug: 'demo-summitshield',
      title: '$75 HVAC / solar appointment · SummitShield',
      description:
        'Set HVAC load-calc or solar site survey appointments. Sell the visit, not the full install. Financing-friendly close.',
      icpText:
        'Homeowners with aging HVAC, spiked summer bills, or solar curiosity. Spouse usually needed for numbers.',
      goalType: 'BOOKED_MEETING',
      payoutCents: 7500,
      budgetCents: 75000,
      maxAwards: 50,
    },
  ];

  for (const seed of campaignSeeds) {
    const brandRow = results.find((r) => r.slug === seed.slug);
    if (!brandRow) continue;
    const existingCampaign = await prisma.campaign.findFirst({
      where: { brandId: brandRow.brandId, title: seed.title },
    });
    const campaignData = {
      title: seed.title,
      description: seed.description,
      icpText: seed.icpText,
      goalType: seed.goalType,
      payoutCents: seed.payoutCents,
      platformFeeBps: 2000,
      status: 'OPEN' as const,
      minScore: 75,
      requireCertification: false,
      packId: brandRow.packId,
      playbookId: brandRow.playbookId,
      budgetCents: seed.budgetCents,
      maxAwards: seed.maxAwards,
    };
    if (existingCampaign) {
      await prisma.campaign.update({
        where: { id: existingCampaign.id },
        data: campaignData,
      });
    } else {
      await prisma.campaign.create({
        data: {
          brandId: brandRow.brandId,
          createdByUserId: null,
          ...campaignData,
        },
      });
    }
  }

  const training = await seedTrainingLeads();
  console.log(
    `Training leads: created=${training.created} updated=${training.updated} skipped=${training.skipped}`
  );

  return results;
}

async function main() {
  const results = await seedDemoBrands();
  console.log('Seeded demo brands:');
  for (const r of results) {
    console.log(
      `  ${r.slug}  brand=${r.brandId}  pack=${r.packId}  playbook=${r.playbookId}`
    );
  }
}

const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('seed-demo-brands.ts') ||
    process.argv[1].endsWith('seed-demo-brands.js'));

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
