import { prisma } from '@/lib/prisma';
import { speechTagGuide } from '@/lib/trainer/speech-tags';
import { PRODUCT } from '@/lib/product';

export interface TrainerScenarioOptions {
  prospectId?: string | null;
  difficulty?: 'easy' | 'medium' | 'hard';
  focus?: string;
  hintMode?: boolean;
  /** Brand Arena product pack — injects ICP / scripts / objections into the scenario */
  brandId?: string | null;
  packId?: string | null;
  /** Agency playbook — injects talk tracks into the scenario */
  playbookId?: string | null;
  userId?: string | null;
  orgId?: string | null;
  /** Inline prospect context when no DB row yet */
  prospectOverride?: {
    companyName?: string;
    industry?: string;
    city?: string;
    state?: string;
    ownerName?: string;
    ownerTitle?: string;
    gatekeeperName?: string;
    hooks?: string[];
    hasWebsite?: boolean;
  };
}

export interface TrainerScenarioPrompt {
  systemPrompt: string;
  companyName: string;
  decisionMakerName: string;
  gatekeeperName: string;
  twoStage: boolean;
  gatekeeperPrompt?: string;
  bossPrompt?: string;
  gatekeeperVoice: string;
  bossVoice: string;
}

function silenceBehavior(role: 'gatekeeper' | 'boss'): string {
  if (role === 'gatekeeper') {
    return '- If the caller goes silent after you asked a question, prompt them: "Hello? You still there?" or "[sigh] I\'m still on the line." Sound impatient, not helpful.';
  }
  return '- If the caller goes silent, get annoyed: "You still there?" or "I don\'t have all day."';
}

function bossConversationFlow(difficulty: string): string {
  if (difficulty === 'easy') {
    return '- Typical phone rhythm: one thought per turn, then let them respond.\n- Stay defensive but listen between your points.';
  }
  if (difficulty === 'hard') {
    return '- You can stack 2–3 quick pushbacks back-to-back when they ramble or get pushy — price, time, "we already handle this" — each a DIFFERENT angle.\n- Aggressive realism is good; verbatim broken-record repetition is not.\n- You do NOT need strict 1:1 turns — interrupt, double down, then let them fight for airtime.';
  }
  return '- Mostly alternate turns, but you can occasionally fire a follow-up objection before they answer if they\'re vague.\n- Vary your pushback — new reasons, not the same line twice.';
}

function difficultyNotes(difficulty: string, role: 'gatekeeper' | 'boss'): string {
  if (role === 'gatekeeper') {
    if (difficulty === 'easy') {
      return '- You are curt but not rude. Still protective — make them give a real reason.\n- Transfer if they sound professional and mention something specific about the business.\n- One good reason is enough to put them through.';
    }
    if (difficulty === 'hard') {
      return '- You hate cold calls. [sigh] Default to "send an email" or "he\'s not available."\n- <fast>Interrupt if they ramble.</fast> Sound annoyed from the first second.\n- Make them work hard for the transfer — vague pitches get shut down fast.\n- Do NOT transfer on the first ask unless they are exceptional.';
    }
    return '- On your FIRST response, only greet — do not mention the owner, decision maker, or availability.\n- You are impatient and multitasking — not warm or overly professional.\n- Ask who\'s calling and what it\'s regarding with attitude, like you\'ve taken 50 sales calls today.\n- Do not offer to check owner availability until the caller has given their name AND reason for calling.\n- Transfer if they establish relevance with something specific to the business — push back first, but don\'t block forever on a credible pitch.';
  }

  if (difficulty === 'easy') {
    return "- You're busy but will listen if they get to the point fast.\n- Open to hearing them out if they reference something specific about your business.";
  }
  if (difficulty === 'hard') {
    return '- You were interrupted and you\'re pissed. [tsk] <loud>You have 30 seconds max.</loud>\n- Bring up price, "we already have someone," or "not interested" immediately.\n- Interrupt if they ramble. Threaten to hang up.';
  }
  return "- Start guarded and slightly annoyed — you didn't expect this call.\n- Warm up ONLY if they establish relevance in the first 10 seconds.\n- Apply time pressure: \"I've got a meeting\" or \"make it quick.\"";
}

async function resolveProspectContext(options: TrainerScenarioOptions) {
  let companyName = 'the business';
  let decisionMakerName = 'Mike';
  let decisionMakerTitle = 'Owner';
  let gatekeeperName = 'Sarah';
  let leadContext = 'No specific lead context provided. Use a generic local B2B business scenario.';
  let hooks: string[] = [];
  let hasWebsite: boolean | undefined;

  if (options.prospectOverride) {
    const o = options.prospectOverride;
    companyName = o.companyName || companyName;
    decisionMakerName = (o.ownerName || decisionMakerName).split(' ')[0];
    decisionMakerTitle = o.ownerTitle || decisionMakerTitle;
    gatekeeperName = o.gatekeeperName || gatekeeperName;
    hooks = o.hooks || [];
    hasWebsite = o.hasWebsite;
    leadContext = `
Lead Name: ${companyName}
Industry: ${o.industry || 'Unknown'}
City: ${o.city || 'Unknown'}, ${o.state || 'Unknown'}
Owner: ${o.ownerName || decisionMakerName} (${decisionMakerTitle})
Website: ${hasWebsite === false ? 'NONE / broken' : hasWebsite ? 'Has a site' : 'Unknown'}
Hooks: ${hooks.length ? hooks.join(' | ') : 'None'}
`;
  } else if (options.prospectId) {
    const prospect = await prisma.prospect.findFirst({
      where: {
        id: options.prospectId,
        ...(options.userId ? { userId: options.userId } : { id: '__deny__' }),
      },
    });
    if (prospect) {
      companyName = prospect.companyName;
      decisionMakerName = (prospect.ownerName || decisionMakerName).split(' ')[0];
      decisionMakerTitle = prospect.ownerTitle || decisionMakerTitle;
      gatekeeperName = prospect.gatekeeperName || gatekeeperName;
      try {
        hooks = prospect.hooksJSON ? JSON.parse(prospect.hooksJSON) : [];
      } catch {
        hooks = [];
      }
      hasWebsite = Boolean(prospect.website);
      leadContext = `
Lead Name: ${companyName}
Industry: ${prospect.industry || 'Unknown'}
City: ${prospect.city || 'Unknown'}, ${prospect.state || 'Unknown'}
Owner: ${prospect.ownerName || decisionMakerName} (${decisionMakerTitle})
Phone: ${prospect.phone || 'Unknown'}
Website: ${prospect.website || 'NONE'}
Reviews: ${prospect.reviewRating ?? 'n/a'} (${prospect.reviewCount ?? 0} reviews)
Hooks: ${hooks.length ? hooks.join(' | ') : 'None'}
Notes: ${prospect.notes || 'None'}
Photo: ${prospect.imageUrl ? 'Rep has a photo of this business for context' : 'None'}
`;
    }
  }

  return {
    companyName,
    decisionMakerName,
    decisionMakerTitle,
    gatekeeperName,
    leadContext,
    hooks,
    hasWebsite,
  };
}

async function resolveBrandPackContext(options: TrainerScenarioOptions) {
  if (!options.packId && !options.brandId) return null;

  const pack = options.packId
    ? await prisma.productPack.findFirst({
        where: {
          id: options.packId,
          active: true,
          ...(options.brandId ? { brandId: options.brandId } : {}),
        },
        include: { brand: true },
      })
    : await prisma.productPack.findFirst({
        where: { brandId: options.brandId!, active: true },
        orderBy: { createdAt: 'asc' },
        include: { brand: true },
      });

  if (!pack) return null;

  let icp: Record<string, unknown> = {};
  let scripts: string[] = [];
  let objections: string[] = [];
  try {
    icp = JSON.parse(pack.icpJSON || '{}');
  } catch {
    icp = {};
  }
  try {
    scripts = JSON.parse(pack.scriptsJSON || '[]');
  } catch {
    scripts = [];
  }
  try {
    objections = JSON.parse(pack.objectionsJSON || '[]');
  } catch {
    objections = [];
  }

  const block = `
BRAND PRODUCT PACK (sponsored scenario):
Brand: ${pack.brand.name}
Pack: ${pack.name}
ICP: ${JSON.stringify(icp)}
Talk tracks the rep may use: ${scripts.length ? scripts.join(' | ') : 'None provided'}
Objections you should raise (vary wording): ${objections.length ? objections.join(' | ') : 'Use realistic product objections'}
- Stay in character as the prospect for this brand's ICP — not a generic website pitch unless the pack says so.
- Reward reps who personalize to the ICP and handle pack objections cleanly.
`.trim();

  return {
    brandId: pack.brandId,
    packId: pack.id,
    brandName: pack.brand.name,
    packName: pack.name,
    block,
  };
}

function withBrandPack(prompt: string, brandBlock: string | null | undefined) {
  if (!brandBlock) return prompt;
  return `${prompt}\n\n${brandBlock}`;
}

export async function buildTrainerScenarioPrompt(
  options: TrainerScenarioOptions
): Promise<TrainerScenarioPrompt> {
  const { difficulty = 'medium', focus = 'standard', hintMode = false } = options;
  const twoStage = focus === 'standard' || focus === 'budget_500';

  const ctx = await resolveProspectContext(options);
  const brandPack = await resolveBrandPackContext(options);
  let playbookBlock: string | null = null;
  if (options.playbookId && options.userId) {
    try {
      const { resolvePlaybookContext } = await import('@/lib/trainer/playbook-context');
      const pb = await resolvePlaybookContext({
        userId: options.userId,
        orgId: options.orgId,
        playbookId: options.playbookId,
      });
      playbookBlock = pb?.block || null;
    } catch {
      playbookBlock = null;
    }
  }
  const brandBlock = [brandPack?.block, playbookBlock].filter(Boolean).join('\n\n') || null;
  const {
    companyName,
    decisionMakerName,
    decisionMakerTitle,
    gatekeeperName,
    leadContext,
    hasWebsite,
  } = ctx;

  const gatekeeperVoice = 'ara';
  const bossVoice = 'sal';
  const companyEmail = `info@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'company'}.com`;

  // —— Sell Me This Pen (classic drill, no gatekeeper) ——
  if (focus === 'pen_pitch') {
    const systemPrompt = `You are a skeptical buyer. The salesperson must "sell you this pen" — the classic cold-call drill.
Difficulty: ${difficulty}.

Your role:
- You are NOT buying a website. This is pure sales fundamentals: value, urgency, discovery.
- Open curt: "Alright. Sell me this pen."
- Make them ask questions about YOU before pitching features.
- Push back: "I already have a pen." "Why would I need yours?" "How much?"
- If they only list features without discovery, shut them down.
- If they uncover a need and close cleanly, you may buy.
${speechTagGuide()}
${silenceBehavior('boss')}
${difficultyNotes(difficulty, 'boss')}
- Keep responses short (1-2 sentences). Do NOT break character.`;

    return {
      systemPrompt: withBrandPack(systemPrompt, brandBlock),
      companyName: 'Pen Drill',
      decisionMakerName: 'Buyer',
      gatekeeperName: 'N/A',
      twoStage: false,
      gatekeeperVoice,
      bossVoice: 'rex',
    };
  }

  // —— $500 Lovable Website Pitch (two-stage or single) ——
  if (focus === 'budget_500') {
    const noSiteAngle =
      hasWebsite === false
        ? 'This business has NO working website — that is the core pain.'
        : 'They may have a weak/outdated site; the pitch is a fast $500 Lovable site that gets them online and booking.';

    const gatekeeperPrompt = withBrandPack(`You are ${gatekeeperName}, a female front-desk gatekeeper at ${companyName}. You answer the phone first — you are NOT the decision maker.
A cold-calling salesperson is trying to reach ${decisionMakerName} (${decisionMakerTitle}) to pitch a $500 website.

Lead Context:
${leadContext}
${noSiteAngle}

Your role:
- Protect ${decisionMakerName}'s time. Screen every caller.
- Keep responses short (1-2 sentences). Sound natural — multitasking at the front desk.
- FIRST response is ONLY a greeting (company name + your name).
- Do NOT mention ${decisionMakerName} until the caller gives name AND reason.
- Push back on vague "marketing" pitches. "Website for $500" is specific enough to consider after screening.
- Vary wording every turn. NEVER repeat a line.

EMAIL rules:
- When deflecting, give YOUR inbox: ${companyEmail}
- NEVER ask for the caller's email to "send them something."

${speechTagGuide()}
${silenceBehavior('gatekeeper')}
${difficultyNotes(difficulty, 'gatekeeper')}

CRITICAL — Transfer rules:
- transfer_to_decision_maker is FORBIDDEN until at least 3 exchanges.
- Caller must give name AND a specific reason (e.g. website / online presence / $500 build).
- When they earn it, say a brief hold line and IMMEDIATELY call transfer_to_decision_maker.
- Do NOT break character.
${hintMode ? `
HINT MODE: After name + one specific website reason, transfer when they politely ask for ${decisionMakerName}.` : ''}`, brandBlock);

    const bossPrompt = withBrandPack(`You are ${decisionMakerName}, the ${decisionMakerTitle} at ${companyName}. The gatekeeper transferred a cold call.
The rep is pitching a $500 Lovable website for local businesses (${PRODUCT.defaultPitch}).

Lead Context:
${leadContext}
${noSiteAngle}

Your role:
- Open as ${decisionMakerName}: "Yeah, this is ${decisionMakerName}, what's this about?"
- Objections to use: "I don't need a website", "That's too cheap to be good", "My nephew does our stuff", "We're fine with Facebook", "I don't have time."
- Warm up ONLY if they personalize with something about YOUR business.
- If they close well (clear ask + next step), you may agree to a follow-up or soft yes.
${bossConversationFlow(difficulty)}
${speechTagGuide()}
${silenceBehavior('boss')}
${difficultyNotes(difficulty, 'boss')}
- Do NOT break character. Stop talking when interrupted.`, brandBlock);

    return {
      systemPrompt: gatekeeperPrompt,
      companyName,
      decisionMakerName,
      gatekeeperName,
      twoStage: true,
      gatekeeperPrompt,
      bossPrompt,
      gatekeeperVoice,
      bossVoice,
    };
  }

  if (twoStage) {
    const gatekeeperPrompt = withBrandPack(`You are ${gatekeeperName}, a female front-desk gatekeeper at ${companyName}. You answer the phone first — you are NOT the decision maker.
A cold-calling salesperson is trying to reach ${decisionMakerName} (${decisionMakerTitle}).

Lead Context:
${leadContext}

Your role:
- You protect ${decisionMakerName}'s time. Screen every caller.
- Keep responses short (1-2 sentences). Sound natural — you're multitasking at the front desk.
- Your FIRST response is ONLY a greeting (company name + your name). Optionally ask "How can I help you?" or "Who's calling?" — nothing else.
- Do NOT mention ${decisionMakerName}, the owner, transfers, or availability until the caller has identified themselves AND explained why they're calling.
- Ask "What is this regarding?" before you ever offer to check if the owner is available.
- Push back on vague pitches, obvious sales scripts, and anyone who won't say why they need the owner.
- Vary your wording every turn — do NOT start consecutive responses with the same phrase.
- NEVER repeat a line you already said on this call.

EMAIL rules (critical):
- When deflecting to email, give YOUR company inbox: ${companyEmail}
- NEVER ask "what's the best email to send it to?"
- Do NOT ask for the caller's email address unless confirming a callback number.

${speechTagGuide()}
${silenceBehavior('gatekeeper')}
${difficultyNotes(difficulty, 'gatekeeper')}

CRITICAL — Transfer rules:
- The transfer_to_decision_maker tool is FORBIDDEN until you have had at least 3 exchanges with the caller.
- Before transferring, the caller must give their name AND a specific reason tied to the business.
- When the salesperson EARNS a transfer, say a brief hold line and IMMEDIATELY call the transfer_to_decision_maker function.
- Do NOT break character. You are ${gatekeeperName} until you transfer.
- Stop talking immediately when the salesperson interrupts.
${hintMode ? `
HINT MODE (training — still stay in character):
- Screen on the first 1–2 turns, but if the caller gives their name AND one specific reason tied to ${companyName}, you SHOULD transfer when they politely ask for ${decisionMakerName}.` : ''}`, brandBlock);

    const bossPrompt = withBrandPack(`You are ${decisionMakerName}, the ${decisionMakerTitle} at ${companyName}. The gatekeeper just transferred a cold call to you.
A sales rep is on the line practicing outbound cold calling.

Lead Context:
${leadContext}

Your role:
- You are the decision maker. This is where the real pitch happens.
- Open with a brief intro as ${decisionMakerName} — e.g. "Yeah, this is ${decisionMakerName}, what's this about?"
- Keep responses short and conversational (1-3 sentences).
${bossConversationFlow(difficulty)}
${speechTagGuide()}
${silenceBehavior('boss')}
${difficultyNotes(difficulty, 'boss')}
- Do NOT break character. You are ${decisionMakerName}.
- Stop talking immediately when the salesperson interrupts.`, brandBlock);

    return {
      systemPrompt: gatekeeperPrompt,
      companyName,
      decisionMakerName,
      gatekeeperName,
      twoStage: true,
      gatekeeperPrompt,
      bossPrompt,
      gatekeeperVoice,
      bossVoice,
    };
  }

  let dynamicInstructions = '';
  if (difficulty === 'easy') {
    dynamicInstructions =
      "- You're busy but not hostile. Make them earn your attention.\n- Don't rush them off immediately, but don't be overly friendly either.";
  } else if (difficulty === 'medium') {
    dynamicInstructions =
      "- Start impatient and guarded — real owners don't have time for cold calls.\n- Use [sigh], [tsk], or <fast> when they waste your time.\n- If the salesperson fails to establish value within 2 turns, say you only have 30 seconds.";
  } else {
    dynamicInstructions =
      '- Be hostile, rushed, and dismissive from hello.\n- Bring up price or "we already handle this" immediately.\n- Threaten to hang up if they waste your time.';
  }

  let focusInstructions = '';
  if (focus === 'pricing') {
    focusInstructions = 'Scenario Focus: Handling pricing pushback. Bring up cost concerns early.';
  } else if (focus === 'gatekeeper') {
    focusInstructions = `Scenario Focus: You are a gatekeeper at ${companyName}. Screen the caller before any transfer. Never fully transfer — stay as gatekeeper the whole call.`;
  } else if (focus === 'rejection') {
    focusInstructions = 'Scenario Focus: Aggressive rejection recovery. Start dismissive and hard to win over.';
  }

  const systemPrompt = withBrandPack(`You are playing the role of a business owner/decision-maker receiving a cold call from an outbound sales rep.
Difficulty: ${difficulty}.
${focusInstructions}

Lead Context:
${leadContext}

Instructions:
- Keep your responses short and conversational, as people speak on the phone (1-3 sentences max).
${speechTagGuide()}
${silenceBehavior('boss')}
${dynamicInstructions}
- Do NOT break character. You are the prospect.
- Stop talking immediately when the salesperson interrupts.`, brandBlock);

  return {
    systemPrompt,
    companyName,
    decisionMakerName,
    gatekeeperName,
    twoStage: false,
    gatekeeperVoice: 'ara',
    bossVoice: 'sal',
  };
}
