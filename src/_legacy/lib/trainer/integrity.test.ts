import { computeIntegrityFlags } from './integrity';
import { hasBlockingIntegrity, parseIntegrityFlags } from '../integrity-gate';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const short = computeIntegrityFlags({
  transcript: 'USER: hi\n',
  durationSeconds: 10,
  overallScore: 98,
});
assert(short.some((f) => f.code === 'short_duration'), 'short_duration');
assert(short.some((f) => f.code === 'thin_transcript'), 'thin_transcript');
assert(hasBlockingIntegrity(JSON.stringify(short)), 'blocking');

const clean = computeIntegrityFlags({
  transcript:
    'USER: Hi Sarah, this is Alex from Cold Call Reps.\nGATEKEEPER: What is this regarding?\nUSER: We help local businesses get a $500 website.\nPROSPECT: Tell me more.\nUSER: Happy to — do you have 10 minutes Thursday?\n',
  durationSeconds: 90,
  overallScore: 82,
});
assert(clean.length === 0, 'clean session should have no flags');
assert(!hasBlockingIntegrity(JSON.stringify(clean)), 'clean not blocking');
assert(parseIntegrityFlags(null).length === 0, 'null parse');

const repeated = computeIntegrityFlags({
  transcript:
    'USER: We build websites for five hundred dollars.\nGATEKEEPER: Ok.\nUSER: We build websites for five hundred dollars.\nPROSPECT: Ok.\nUSER: We build websites for five hundred dollars.\n',
  durationSeconds: 70,
  overallScore: 88,
});
assert(repeated.some((f) => f.code === 'repeated_user_turns'), 'repeated_user_turns');

console.log('integrity.test.ts OK');
