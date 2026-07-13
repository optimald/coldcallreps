export interface ScriptSection {
  title: string;
  points: string[];
}

export interface TrainingScript {
  companyName: string;
  focus: string;
  difficulty: string;
  sections: ScriptSection[];
  productUrl?: string;
  trainingImages?: string[];
  trainingVideoUrl?: string;
}

const FOCUS_FLOWS: Record<string, ScriptSection[]> = {
  standard: [
    {
      title: 'Phase 1 — Gatekeeper',
      points: [
        '"Hi, this is [Your Name] — who am I speaking with?"',
        'Get their name. Sound professional, not like a telemarketer.',
        '"I\'m trying to reach whoever handles [ops / marketing / the website] — is [Owner] available?"',
      ],
    },
    {
      title: 'Earn the transfer',
      points: [
        'Give ONE specific reason tied to their business.',
        '"It\'s not a long pitch — 2 minutes with the right person."',
        'Ask permission: "Would you mind checking if they have a quick minute?"',
      ],
    },
    {
      title: 'Phase 2 — Decision maker',
      points: [
        'Re-intro in 10 seconds. Acknowledge time.',
        'One discovery question before pitching.',
        'Clear ask + two time options to close.',
      ],
    },
  ],
  budget_500: [
    {
      title: '$500 Website — Gatekeeper',
      points: [
        'Name + company. "Calling about your online presence / website."',
        'Specific: "We build $500 sites for local businesses that are missing bookings online."',
        'Ask for the owner who handles marketing or the business itself.',
      ],
    },
    {
      title: '$500 Website — Owner pitch',
      points: [
        'Lead with THEIR gap: no site, broken site, or Facebook-only.',
        '"For $500 we ship a Lovable site that looks pro and takes inquiries."',
        'Handle "too cheap": process + speed, not cheap quality.',
        'Close: "Want me to send 2 examples and a 10-min walkthrough Thursday or Friday?"',
      ],
    },
  ],
  pen_pitch: [
    {
      title: 'Sell Me This Pen',
      points: [
        'Do NOT list pen features first.',
        'Ask: "When was the last time you used a pen?" / "What do you write most?"',
        'Uncover a need, then position the pen as the solution.',
        'Close with a clear ask: "Want to take this one?"',
      ],
    },
  ],
  gatekeeper: [
    {
      title: 'Gatekeeper mastery',
      points: [
        'Name + reason every time.',
        'Never pitch the product to the gatekeeper.',
        'Handle email deflect: get the right inbox + owner name.',
        'Callback window if blocked.',
      ],
    },
  ],
  pricing: [
    {
      title: 'Pricing pushback',
      points: [
        'Acknowledge. Pause. Clarify total vs timing.',
        'Reframe to ROI / one extra job per week.',
        'Offer a smaller starting point if needed.',
      ],
    },
  ],
  rejection: [
    {
      title: 'Rejection recovery',
      points: [
        'Don\'t argue. "Totally fair."',
        'One clarifying question to reopen.',
        'Leave a hook + permission to follow up.',
      ],
    },
  ],
};

export async function buildTrainingScript(options: {
  prospectId?: string | null;
  focus?: string;
  difficulty?: string;
  companyName?: string;
  userId?: string | null;
  orgId?: string | null;
  playbookId?: string | null;
}): Promise<TrainingScript> {
  const focus = options.focus || 'standard';
  const difficulty = options.difficulty || 'medium';
  let companyName = options.companyName || 'your prospect';

  if (options.prospectId) {
    try {
      const { prisma } = await import('@/lib/prisma');
      const p = await prisma.prospect.findUnique({ where: { id: options.prospectId } });
      if (p) companyName = p.companyName;
    } catch {
      /* ignore */
    }
  }

  let sections = (FOCUS_FLOWS[focus] || FOCUS_FLOWS.standard).map((s) => ({
    ...s,
    points: s.points.map((pt) => pt.replace(/\[Owner\]/g, 'the owner').replace(/\[Company\]/g, companyName)),
  }));

  let productUrl: string | undefined;
  let trainingImages: string[] | undefined;
  let trainingVideoUrl: string | undefined;

  if (options.playbookId && options.userId) {
    try {
      const { resolvePlaybookContext } = await import('@/lib/trainer/playbook-context');
      const pb = await resolvePlaybookContext({
        userId: options.userId,
        orgId: options.orgId,
        playbookId: options.playbookId,
      });
      if (pb?.sections?.length) {
        sections = [
          { title: `Playbook — ${pb.title}`, points: [`Using agency playbook: ${pb.title}`] },
          ...pb.sections,
        ];
        productUrl = pb.productUrl;
        trainingImages = pb.trainingImages;
        trainingVideoUrl = pb.trainingVideoUrl;
      }
    } catch {
      /* keep default sections */
    }
  }

  return {
    companyName,
    focus,
    difficulty,
    sections,
    ...(productUrl ? { productUrl } : {}),
    ...(trainingImages?.length ? { trainingImages } : {}),
    ...(trainingVideoUrl ? { trainingVideoUrl } : {}),
  };
}
