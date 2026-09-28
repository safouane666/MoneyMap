import { AI_TOOLS, buildSystemPrompt, runAiTool } from './tools';
import { applyDeterministicLedgerFallback, looksLikeLedgerIntent } from './ledger-intent';
import type { AiAction, AiChatMessage, AiChatResponse, AiLedgerContext } from './types';

interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: OpenAiToolCall[];
  reasoning_content?: string;
}

interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAiChoice {
  finish_reason?: string;
  message: OpenAiMessage;
}

function getConfig() {
  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = (process.env.AI_BASE_URL ?? 'https://app.phronexus-ai.com/v1').replace(/\/$/, '');
  const model = process.env.AI_MODEL?.trim() || '';
  return { apiKey, baseUrl, model };
}

/** Skip image/audio/embedding ids when picking a chat model. */
function isNonChatModel(id: string): boolean {
  return /^(sd-|stable-?diffusion|flux|dall-?e|whisper|tts|embed|clip|vae)/i.test(id);
}

function scoreChatModel(id: string): number {
  if (/qwen|llama|mistral|gpt|phi|gemma|deepseek|claude|command/i.test(id)) return 0;
  if (isNonChatModel(id)) return 100;
  return 10;
}

/** Prefer configured model if loaded; otherwise first viable chat model. */
export function pickAvailableModel(ids: string[], preferred?: string): string | null {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return null;
  if (preferred && unique.includes(preferred)) return preferred;

  const ranked = [...unique].sort((a, b) => {
    const diff = scoreChatModel(a) - scoreChatModel(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
  const chatFirst = ranked.find((id) => !isNonChatModel(id));
  return chatFirst ?? ranked[0] ?? null;
}

function looksLikeMissingModel(status: number, body: string): boolean {
  if (status === 404) return true;
  const lower = body.toLowerCase();
  return (
    lower.includes('model') &&
    (lower.includes('not found') ||
      lower.includes('does not exist') ||
      lower.includes('unavailable') ||
      lower.includes('not loaded') ||
      lower.includes('unknown model') ||
      lower.includes('invalid model'))
  );
}

let resolvedModelCache: string | null = null;

async function listModelIds(baseUrl: string, apiKey: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Could not list AI models (${res.status}): ${text.slice(0, 160)}`);
  }
  const json = (await res.json()) as { data?: Array<{ id?: string }> };
  return (json.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
}

async function resolveModel(apiKey: string, baseUrl: string, preferred: string): Promise<string> {
  if (resolvedModelCache) return resolvedModelCache;

  try {
    const ids = await listModelIds(baseUrl, apiKey);
    const picked = pickAvailableModel(ids, preferred || undefined);
    if (picked) {
      resolvedModelCache = picked;
      return picked;
    }
  } catch {
    /* fall through — try preferred as-is if set */
  }

  if (preferred) {
    resolvedModelCache = preferred;
    return preferred;
  }

  throw new Error('No AI models are loaded on the provider. Load a chat model in Phronexus, then retry.');
}

async function postChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: OpenAiMessage[],
  withTools: boolean,
  forceTools = false,
): Promise<Response> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.45,
    max_tokens: 1024,
    // Qwen3 on Phronexus defaults to slow chain-of-thought; that blows the Next route budget.
    enable_thinking: false,
    chat_template_kwargs: { enable_thinking: false },
  };
  if (withTools) {
    body.tools = AI_TOOLS;
    // Prefer required tool use for clear ledger intents so the model cannot "chat about"
    // saving money without calling ask_for_category / add_expense / create_category.
    body.tool_choice = forceTools ? 'required' : 'auto';
  }

  return fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
}

async function callChat(
  messages: OpenAiMessage[],
  withTools: boolean,
  forceTools = false,
) {
  const { apiKey, baseUrl, model: preferred } = getConfig();
  if (!apiKey) {
    throw new Error('AI is not configured. Set AI_API_KEY in apps/web/.env.local');
  }

  let model = await resolveModel(apiKey, baseUrl, preferred);
  let res = await postChat(baseUrl, apiKey, model, messages, withTools, forceTools);

  if (!res.ok && forceTools && withTools && (res.status === 400 || res.status === 422)) {
    // Some hosts reject tool_choice=required — retry once with auto.
    res = await postChat(baseUrl, apiKey, model, messages, withTools, false);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (looksLikeMissingModel(res.status, text)) {
      resolvedModelCache = null;
      let ids: string[] = [];
      try {
        ids = await listModelIds(baseUrl, apiKey);
      } catch {
        throw new Error(`AI provider error ${res.status}: ${text.slice(0, 240)}`);
      }
      const fallback = pickAvailableModel(
        ids.filter((id) => id !== model),
        preferred || undefined,
      );
      if (!fallback) {
        throw new Error(
          `Configured model “${model}” is not loaded. Available: ${ids.join(', ') || '(none)'}.`,
        );
      }
      resolvedModelCache = fallback;
      model = fallback;
      res = await postChat(baseUrl, apiKey, model, messages, withTools, forceTools);
      if (!res.ok && forceTools && withTools && (res.status === 400 || res.status === 422)) {
        res = await postChat(baseUrl, apiKey, model, messages, withTools, false);
      }
      if (!res.ok) {
        const retryText = await res.text().catch(() => '');
        throw new Error(`AI provider error ${res.status}: ${retryText.slice(0, 240)}`);
      }
    } else {
      throw new Error(`AI provider error ${res.status}: ${text.slice(0, 240)}`);
    }
  }

  const json = (await res.json()) as { choices?: OpenAiChoice[] };
  const choice = json.choices?.[0];
  if (!choice?.message) throw new Error('AI provider returned an empty response');
  return choice.message;
}

function messageText(message: OpenAiMessage): string {
  if (message.content?.trim()) return message.content.trim();
  // Some hosts still return thinking text if enable_thinking is ignored.
  if (message.reasoning_content?.trim()) {
    const raw = message.reasoning_content.trim();
    const lastLine = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean).at(-1);
    return lastLine || raw.slice(0, 280);
  }
  return '';
}

function hasMoneyEntryAction(actions: AiAction[]): boolean {
  return actions.some((a) => a.type === 'ask_category' || a.type === 'add_transaction');
}

function claimsLedgerSave(reply: string): boolean {
  return /\b(added|logged|saved|recorded|put(?:ting)? it|filed|done|all set)\b/i.test(reply);
}

function fallbackReply(actions: AiAction[], currency: string): string {
  const ask = actions.find((a) => a.type === 'ask_category');
  if (ask && ask.type === 'ask_category') {
    return ask.entryType === 'expense'
      ? `Got it — ${ask.amountMajor} ${currency} out the door. Where should we park this one?`
      : `Nice — ${ask.amountMajor} ${currency} coming in. What kind of income is this?`;
  }
  if (actions.length === 0) {
    return 'I can log spend/receive, create categories, or summarize this space. Try “spent 12 on coffee”.';
  }
  const bits: string[] = [];
  for (const action of actions) {
    if (action.type === 'create_category') {
      bits.push(`category “${action.name}”`);
    } else if (action.type === 'add_transaction') {
      bits.push(
        `${action.entryType === 'expense' ? 'expense' : 'income'} ${action.amountMajor} ${currency}${action.category ? ` · ${action.category}` : ''}`,
      );
    } else if (action.type === 'update_transaction') {
      bits.push('an entry update');
    } else if (action.type === 'report') {
      bits.push('a summary');
    }
  }
  return bits.length ? `Logged — ${bits.join(', ')}.` : 'All set.';
}

/** Ensure spend/income utterances produce real ledger actions even if the model skipped or misfired tools. */
async function ensureLedgerActions(
  lastUser: AiChatMessage | undefined,
  context: AiLedgerContext,
  actions: AiAction[],
): Promise<void> {
  if (!lastUser || !looksLikeLedgerIntent(lastUser.content)) return;
  if (hasMoneyEntryAction(actions)) return;
  // create_category / report intents are handled inside the fallback itself
  await applyDeterministicLedgerFallback(lastUser.content, context, actions);
}

export async function runAiChat(input: {
  messages: AiChatMessage[];
  context: AiLedgerContext;
}): Promise<AiChatResponse> {
  const actions: AiAction[] = [];
  const history: OpenAiMessage[] = [
    { role: 'system', content: buildSystemPrompt(input.context) },
    ...input.messages.slice(-12).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  const lastUser = [...input.messages].reverse().find((m) => m.role === 'user');
  const forceTools = Boolean(lastUser && looksLikeLedgerIntent(lastUser.content));

  for (let round = 0; round < 6; round += 1) {
    const message = await callChat(history, true, forceTools && round === 0);
    const toolCalls = message.tool_calls ?? [];

    if (toolCalls.length > 0) {
      history.push({
        role: 'assistant',
        content: message.content ?? '',
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        const ran = await runAiTool(
          call.function.name,
          call.function.arguments,
          input.context,
          actions,
        );
        let payload: Record<string, unknown>;
        if ('error' in ran) {
          payload = { error: ran.error };
        } else {
          payload = ran.result;
        }
        history.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(payload),
        });
      }
      continue;
    }

    // Model skipped / misfired tools — still apply structured ledger actions for clear intents.
    await ensureLedgerActions(lastUser, input.context, actions);

    let reply = messageText(message);
    if (!reply && actions.length > 0) {
      const confirm = await callChat(
        [
          ...history,
          {
            role: 'assistant',
            content: '',
          },
          {
            role: 'user',
            content: 'Confirm what you just did for the ledger in one short sentence. No tools.',
          },
        ],
        false,
      );
      reply = messageText(confirm);
    }

    const askCategory = actions.find(
      (a): a is Extract<AiAction, { type: 'ask_category' }> => a.type === 'ask_category',
    );

    // Never let the model claim a save when we're still waiting on a category,
    // or when we synthesized actions after a tool-less / wrong-tool reply.
    if (actions.length > 0) {
      const invented =
        claimsLedgerSave(reply) ||
        /\b(groceries|usd|\$)\b/i.test(reply);
      if (!reply || invented || askCategory) {
        // For ask_category always prefer the chip prompt; for other actions replace invented saves.
        if (askCategory || !toolCalls.length || invented) {
          reply = fallbackReply(actions, input.context.currency);
        }
      }
    }

    return {
      reply: reply || fallbackReply(actions, input.context.currency),
      actions,
      suggestions: askCategory?.suggestions,
    };
  }

  await ensureLedgerActions(lastUser, input.context, actions);

  const askCategory = actions.find(
    (a): a is Extract<AiAction, { type: 'ask_category' }> => a.type === 'ask_category',
  );

  return {
    reply: fallbackReply(actions, input.context.currency),
    actions,
    suggestions: askCategory?.suggestions,
  };
}
