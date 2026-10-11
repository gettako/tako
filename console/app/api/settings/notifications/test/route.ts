import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Outbound notification adapters are planned for Phase 5 and not yet enabled.',
    },
    { status: 501 }
  );
}
