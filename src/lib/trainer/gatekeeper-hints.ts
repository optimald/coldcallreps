import type { TrainerPhase, TrainerTranscriptEntry } from '@/hooks/useXaiTrainerRealtime';

export interface TrainerHint {
  title: string;
  body: string;
  example?: string;
  checklist: { label: string; done: boolean }[];
}

function userText(transcript: TrainerTranscriptEntry[]): string {
  return transcript
    .filter((e) => e.role === 'user')
    .map((e) => e.text)
    .join(' ');
}

function lastProspectLine(transcript: TrainerTranscriptEntry[]): string {
  for (let i = transcript.length - 1; i >= 0; i--) {
    if (transcript[i].role !== 'user') return transcript[i].text;
  }
  return '';
}

function matches(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function hasCallerName(text: string): boolean {
  return matches(text, /\b(this is|my name'?s?|i'm|i am)\s+[a-z]/i);
}

function hasCallerCompany(text: string): boolean {
  return matches(text, /\bwith\s+[a-z0-9]/i);
}

function hasSpecificReason(text: string, companyName: string): boolean {
  const companyBit = companyName && companyName !== 'the business' ? companyName.split(/\s+/)[0] : '';
  const patterns = [
    /\bafter[- ]?hours?\b/i,
    /\b(voicemail|missed calls?|phone calls?|answering|handle.*calls?)\b/i,
    /\b(audit|website|online|reviews?|google|visibility|seo|leads?)\b/i,
    /\b\d+\s*(bucks|dollars|\$|\/mo|per month)\b/i,
    /\bfor your (business|company)\b/i,
    /\b(handle|handling|coverage)\b/i,
    /\btwo minutes?\b/i,
    /\bprospects?\b/i,
  ];
  if (companyBit.length > 3 && text.toLowerCase().includes(companyBit.toLowerCase())) return true;
  return patterns.some((p) => p.test(text));
}

function lastUserLine(transcript: TrainerTranscriptEntry[]): string {
  for (let i = transcript.length - 1; i >= 0; i--) {
    if (transcript[i].role === 'user') return transcript[i].text;
  }
  return '';
}

function wordOverlapRatio(a: string, b: string): number {
  const wordsA = a
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const wordsB = new Set(
    b
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  if (wordsA.length === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  for (const w of wordsA) if (wordsB.has(w)) shared += 1;
  return shared / Math.min(wordsA.length, wordsB.size);
}

/** Soft ask for the DM — "talk to the boss" counts, but is early-stage. */
function askedForDecisionMaker(text: string, dmName: string): boolean {
  const first = dmName.split(/\s+/)[0];
  return (
    matches(
      text,
      /\b(transfer|put me through|speak to|talk to|get (him|her)|available|quick minute|catch (him|her)|talk to the boss|need to talk)\b/i
    ) || (first.length > 2 && new RegExp(`\\b${first}\\b`, 'i').test(text))
  );
}

/** Strong transfer push — only after a real pitch/reason + ask. */
function userAlreadyAskedTransfer(text: string, dmName: string): boolean {
  return (
    matches(
      text,
      /\b(before i hang up|30 seconds|sixty seconds|60 seconds|quick minute|two minutes?|has.*minute|worth (his|her|their) time)\b/i
    ) || (askedForDecisionMaker(text, dmName) && hasSpecificReason(text, 'the business'))
  );
}

function echoesUserLine(suggestion: string, userLine: string): boolean {
  if (!userLine.trim()) return false;
  if (wordOverlapRatio(suggestion, userLine) >= 0.42) return true;
  const u = userLine.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  const s = suggestion.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  return s.includes(u.slice(0, Math.min(u.length, 48))) && u.length > 20;
}

function asksWho(text: string): boolean {
  return matches(text, /\b(who'?s calling|who is (this|calling)|your name|may i ask who)\b/i);
}

function asksWhat(text: string): boolean {
  return matches(
    text,
    /\b(what.*(regarding|about|discuss|calling (about|for)|need|is this)|reason for (the |your )?call|how can i help)\b/i
  );
}

function isBlockedOrBrushOff(text: string): boolean {
  return matches(
    text,
    /\b(in the middle|tied up|not available|try back|day or two|call back|busy|can'?t put you through|not putting you through|heard that pitch|send (an? )?email|put it in writing)\b/i
  );
}

function buildChecklist(text: string, companyName: string, dmName: string) {
  return [
    { label: 'Give your name', done: hasCallerName(text) },
    { label: 'Say who you represent', done: hasCallerCompany(text) || hasCallerName(text) },
    { label: 'One specific reason (their business)', done: hasSpecificReason(text, companyName) },
    { label: `Ask for ${dmName} politely`, done: askedForDecisionMaker(text, dmName) },
  ];
}

type GateIntent =
  | 'open'
  | 'who'
  | 'what'
  | 'who_and_what'
  | 'blocked'
  | 'email'
  | 'silence'
  | 'generic';

function detectGateIntent(prospect: string): GateIntent {
  if (!prospect.trim()) return 'open';
  if (matches(prospect, /\b(hello\?|you still there|still on the line)\b/i)) return 'silence';
  if (matches(prospect, /\b(email|send (the )?details|put it in writing|info@|@\w+\.com)\b/i)) {
    return 'email';
  }
  if (isBlockedOrBrushOff(prospect)) return 'blocked';
  const who = asksWho(prospect);
  const what = asksWhat(prospect);
  if (who && what) return 'who_and_what';
  if (who) return 'who';
  if (what) return 'what';
  return 'generic';
}

/** Context-aware alternate when the primary tip overlaps a prior coach line. */
function alternateForIntent(options: {
  intent: GateIntent;
  gatekeeperName: string;
  dmFirst: string;
  companyName: string;
  stageLate: boolean;
}): string {
  const { intent, gatekeeperName, dmFirst, companyName, stageLate } = options;

  switch (intent) {
    case 'who_and_what':
      return `Sure — [Your Name] with [Company]. Calling about missed after-hours calls at ${companyName}; is ${dmFirst} the right person?`;
    case 'who':
      return `[Your Name] with [Company] — thanks for asking.`;
    case 'what':
      return `Quick one — how ${companyName} covers missed calls after hours. Two minutes with ${dmFirst} if she's free.`;
    case 'email':
      return `Happy to email — who should I address it to so it reaches ${dmFirst}?`;
    case 'blocked':
      return stageLate
        ? `Understood. When's usually best to catch ${dmFirst} — morning or after lunch?`
        : `Totally fair. One sentence on why it's specific to ${companyName}, then you decide. Fair?`;
    case 'silence':
      return `Still here — would you mind checking if ${dmFirst} has a quick minute?`;
    case 'open':
      return `Hi ${gatekeeperName}, [Your Name] with [Company] — is ${dmFirst} available for a quick question?`;
    default:
      return stageLate
        ? `Appreciate it, ${gatekeeperName}. If ${dmFirst} isn't free, when's a better time to try again?`
        : `Would you mind seeing if ${dmFirst} has sixty seconds? I'll keep it short.`;
  }
}

/** One stable line to show for the current prospect turn — keyed off their last message. */
export function getInstantSayNext(options: {
  phase: TrainerPhase;
  transcript: TrainerTranscriptEntry[];
  gatekeeperName: string;
  decisionMakerName: string;
  companyName?: string;
  priorSuggestions?: string[];
}): string {
  const {
    phase,
    transcript,
    gatekeeperName,
    decisionMakerName,
    companyName = 'the business',
    priorSuggestions = [],
  } = options;

  const text = userText(transcript);
  const userLast = lastUserLine(transcript);
  const prospect = lastProspectLine(transcript);
  const dmFirst = decisionMakerName.split(/\s+/)[0];
  const intent = detectGateIntent(prospect);
  const userTurns = transcript.filter((e) => e.role === 'user').length;
  const stageLate =
    userTurns >= 3 &&
    (userAlreadyAskedTransfer(text, decisionMakerName) || isBlockedOrBrushOff(prospect));

  const emailTurns = transcript.filter(
    (e) => e.role !== 'user' && /\b(email|send (the )?details|info@|@\w+\.com)\b/i.test(e.text)
  ).length;

  let line: string;

  if (phase === 'decision_maker') {
    const bossLines = transcript.filter((e) => e.role === 'decision_maker').length;
    if (bossLines <= 1) {
      line = `Hi ${dmFirst}, [Your Name] with [Company] — ${gatekeeperName} connected me. I'll keep this to 30 seconds.`;
    } else if (bossLines <= 2) {
      line = `Quick question — how are you currently handling after-hours calls or missed leads?`;
    } else {
      line = `Would it help if I showed you one specific gap we spotted — takes about 10 minutes?`;
    }
  } else if (intent === 'open') {
    line = `Hi ${gatekeeperName}, this is [Your Name] with [Company] — is ${dmFirst} available?`;
  } else if (intent === 'silence') {
    line = `Yeah, still here — sorry about that. Would you mind checking if ${dmFirst} has a quick minute?`;
  } else if (intent === 'blocked') {
    if (userAlreadyAskedTransfer(userLast || text, decisionMakerName)) {
      line = `Fair enough — is there a better day or time when ${dmFirst} usually takes a quick call?`;
    } else {
      line = `I hear you — one sentence on why it's specific to ${companyName}, then you decide if she's free. Fair?`;
    }
  } else if (intent === 'email') {
    if (userAlreadyAskedTransfer(userLast || text, decisionMakerName)) {
      line = `Will do on the email. What's the best way to reach ${dmFirst} directly if she wants to skip the inbox?`;
    } else if (emailTurns >= 2) {
      line = `Happy to send details — who should I address it to so it reaches ${dmFirst}, not general info?`;
    } else if (emailTurns >= 1 && priorSuggestions.some((s) => /email|60 seconds/i.test(s))) {
      line = `Totally fair. Who should I address it to so it actually reaches ${dmFirst} — not just the general inbox?`;
    } else {
      line = `Happy to email — who should I address it to? Or could you see if ${dmFirst} has 60 seconds first?`;
    }
  } else if (intent === 'who_and_what') {
    line = `This is [Your Name] with [Company] — calling about how ${companyName} handles after-hours calls. Two minutes with ${dmFirst} if she's free.`;
  } else if (intent === 'who') {
    line = `Sure — this is [Your Name] with [Company].`;
  } else if (intent === 'what') {
    line = `It's about how ${companyName} handles calls after hours — takes two minutes with the right person.`;
  } else if (askedForDecisionMaker(text, decisionMakerName) && hasSpecificReason(text, companyName)) {
    if (priorSuggestions.some((s) => /60 seconds|not a generic/i.test(s))) {
      line = `${gatekeeperName}, I hear you — last ask: can you just check if she's free? I'll be brief.`;
    } else {
      line = `I understand — it's not a generic sales call. Could you just see if she's free for 60 seconds?`;
    }
  } else if (hasSpecificReason(text, companyName) && !askedForDecisionMaker(text, decisionMakerName)) {
    line = `Would you mind checking if ${dmFirst} has a quick minute? I'll keep it short.`;
  } else if (!hasCallerName(text)) {
    line = `Hi ${gatekeeperName}, this is [Your Name] with [Company].`;
  } else if (!hasSpecificReason(text, companyName)) {
    line = `It's about missed after-hours calls at ${companyName} — two minutes with ${dmFirst} if she's free.`;
  } else {
    line = `Would you mind checking if ${dmFirst} has two minutes? It's specific to ${companyName}.`;
  }

  if (userLast && echoesUserLine(line, userLast)) {
    line = alternateForIntent({
      intent,
      gatekeeperName,
      dmFirst,
      companyName,
      stageLate,
    });
  }

  if (priorSuggestions.some((s) => wordOverlapRatio(line, s) >= 0.55)) {
    const alt = alternateForIntent({
      intent,
      gatekeeperName,
      dmFirst,
      companyName,
      stageLate,
    });
    if (wordOverlapRatio(alt, line) < 0.55 && !priorSuggestions.some((s) => wordOverlapRatio(alt, s) >= 0.55)) {
      line = alt;
    } else if (intent === 'who_and_what' || intent === 'who' || intent === 'what') {
      // Stay on identity / purpose — never jump to vendor / last-try pivots this early.
      line =
        intent === 'who'
          ? `It's [Your Name] calling from [Company].`
          : intent === 'what'
            ? `Calling about after-hours coverage for ${companyName} — is ${dmFirst} the right person?`
            : `[Your Name] at [Company]. Short call about after-hours missed calls at ${companyName} — is ${dmFirst} free?`;
    } else if (stageLate || intent === 'blocked' || intent === 'email') {
      line = `If ${dmFirst} isn't free right now, who on your team handles vendor calls for ${companyName}?`;
    } else {
      line = `Appreciate it — [Your Name] again. Could you just check if ${dmFirst} has a minute?`;
    }
  }

  return line;
}

/** When instant rules would echo the trainee, suggest a forward move instead. */
export function getCoachForwardFallback(options: {
  gatekeeperName: string;
  decisionMakerName: string;
  companyName?: string;
  prospectLine?: string;
}): string {
  const {
    gatekeeperName,
    decisionMakerName,
    companyName = 'the business',
    prospectLine = '',
  } = options;
  const dmFirst = decisionMakerName.split(/\s+/)[0];
  const intent = detectGateIntent(prospectLine);
  return alternateForIntent({
    intent: intent === 'generic' ? 'what' : intent,
    gatekeeperName,
    dmFirst,
    companyName,
    stageLate: false,
  });
}

export function getTrainerHint(options: {
  phase: TrainerPhase;
  transcript: TrainerTranscriptEntry[];
  gatekeeperName: string;
  decisionMakerName: string;
  companyName?: string;
  isProspectSpeaking: boolean;
}): TrainerHint {
  const {
    phase,
    transcript,
    gatekeeperName,
    decisionMakerName,
    companyName = 'the business',
  } = options;

  const text = userText(transcript);
  const checklist = buildChecklist(text, companyName, decisionMakerName);
  const sayNext = getInstantSayNext({
    phase,
    transcript,
    gatekeeperName,
    decisionMakerName,
    companyName,
  });

  return {
    title: 'Next line',
    body: 'Respond to what they just said.',
    example: `"${sayNext}"`,
    checklist,
  };
}
