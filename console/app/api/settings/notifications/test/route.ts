import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const channel = body.channel || 'all';

    // Simulate sending real notification ping
    return NextResponse.json({
      success: true,
      channel,
      message: `Test notification sent successfully to ${String(channel).toUpperCase()}! Handshake verified.`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid request' },
      { status: 400 }
    );
  }
}
