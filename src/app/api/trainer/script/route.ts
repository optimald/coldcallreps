import { NextResponse } from 'next/server';
import { buildTrainingScript } from '@/lib/trainer/training-script';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prospectId, focus = 'standard', difficulty = 'medium', companyName } = body;
    const script = await buildTrainingScript({ prospectId, focus, difficulty, companyName });
    return NextResponse.json(script);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
