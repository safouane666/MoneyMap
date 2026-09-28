import { NextResponse } from 'next/server';
import { runAiChat } from '@/lib/ai/chat';
import type { AiChatMessage, AiLedgerContext } from '@/lib/ai/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

const API_URL = (
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_INTERNAL_URL ||
  'http://127.0.0.1:3011'
).replace(/\/$/, '');

const CONTENT_MAX = 4000;

function isContext(value: unknown): value is AiLedgerContext {
  if (!value || typeof value !== 'object') return false;
  const v = value as AiLedgerContext;
  return (
    typeof v.currency === 'string' &&
    typeof v.spaceName === 'string' &&
    typeof v.spaceId === 'string' &&
    Array.isArray(v.categories) &&
    !!v.totals &&
    Array.isArray(v.recent)
  );
}

async function logPennyTurns(
  cookie: string,
  payload: {
    spaceId?: string | null;
    sessionId?: string;
    turns: Array<{
      role: 'user' | 'assistant';
      content: string;
      source?: 'text' | 'voice';
      locale?: string;
      model?: string;
      latencyMs?: number;
      status?: 'ok' | 'error' | 'blocked';
      errorCode?: string;
      flags?: Record<string, unknown>;
    }>;
  },
) {
  try {
    await fetch(`${API_URL}/ai/penny/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    /* logging must not block Penny */
  }
}

export async function POST(req: Request) {
  const started = Date.now();
  try {
    const cookie = req.headers.get('cookie') ?? '';
    const consumeRes = await fetch(`${API_URL.replace(/\/$/, '')}/ai/penny/consume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: '{}',
    });

    if (consumeRes.status === 401) {
      return NextResponse.json({ error: 'Sign in to use Penny', code: 'auth_required' }, { status: 401 });
    }
    if (consumeRes.status === 402) {
      const body = (await consumeRes.json().catch(() => ({}))) as { error?: string };
      return NextResponse.json(
        { error: body.error ?? 'Penny allowance exhausted', code: 'credits_exhausted' },
        { status: 402 },
      );
    }
    if (!consumeRes.ok) {
      const body = (await consumeRes.json().catch(() => ({}))) as { error?: string };
      return NextResponse.json(
        { error: body.error ?? 'Could not verify Penny credits' },
        { status: consumeRes.status },
      );
    }

    const usage = (await consumeRes.json()) as {
      remaining?: number;
      limit?: number;
      used?: number;
    };

    const body = (await req.json()) as {
      messages?: AiChatMessage[];
      context?: unknown;
      source?: 'text' | 'voice';
      sessionId?: string;
      locale?: string;
    };

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }
    if (!isContext(body.context)) {
      return NextResponse.json({ error: 'context required' }, { status: 400 });
    }

    const source = body.source === 'voice' ? 'voice' : 'text';
    const sessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim().slice(0, 80)
        : undefined;
    const locale = typeof body.locale === 'string' ? body.locale.slice(0, 16) : undefined;

    const messages = body.messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content.slice(0, CONTENT_MAX) }))
      .slice(-12);

    if (messages[messages.length - 1]?.role !== 'user') {
      return NextResponse.json({ error: 'last message must be from user' }, { status: 400 });
    }

    const lastUser = messages[messages.length - 1]!;
    await logPennyTurns(cookie, {
      spaceId: body.context.spaceId,
      sessionId,
      turns: [
        {
          role: 'user',
          content: lastUser.content,
          source,
          locale,
          status: 'ok',
        },
      ],
    });

    try {
      const result = await runAiChat({ messages, context: body.context });
      const latencyMs = Date.now() - started;
      await logPennyTurns(cookie, {
        spaceId: body.context.spaceId,
        sessionId,
        turns: [
          {
            role: 'assistant',
            content: result.reply || '',
            source,
            locale,
            latencyMs,
            status: 'ok',
            flags: {
              actionCount: result.actions?.length ?? 0,
            },
          },
        ],
      });
      return NextResponse.json({
        ...result,
        usage: {
          remaining: usage.remaining ?? null,
          limit: usage.limit ?? null,
          used: usage.used ?? null,
        },
      });
    } catch (inner) {
      const message = inner instanceof Error ? inner.message : 'AI chat failed';
      await logPennyTurns(cookie, {
        spaceId: body.context.spaceId,
        sessionId,
        turns: [
          {
            role: 'assistant',
            content: message.slice(0, CONTENT_MAX),
            source,
            locale,
            latencyMs: Date.now() - started,
            status: 'error',
            errorCode: 'ai_provider',
          },
        ],
      });
      throw inner;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI chat failed';
    const status = message.includes('not configured') ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
