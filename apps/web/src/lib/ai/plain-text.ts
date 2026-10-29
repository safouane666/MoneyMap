/** Strip model junk so Penny bubbles stay human-readable. */
export function toPennyPlainText(input: string): string {
  let text = input ?? '';
  const hadThink = /<\/?think>|<\/?thinking>/i.test(text);

  // Qwen / thinking models sometimes leak chain-of-thought markers into the reply.
  text = text.replace(/<\/?think>/gi, '\n');
  text = text.replace(/<\/?thinking>/gi, '\n');

  if (hadThink) {
    // Prefer the segment after the last think marker (usually the final spoken answer).
    const chunks = text
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (chunks.length >= 2) {
      const last = chunks[chunks.length - 1]!;
      const prev = chunks[chunks.length - 2]!;
      if (normalizeCompare(last) === normalizeCompare(prev)) {
        text = last;
      } else {
        // Keep the last non-empty chunk as the spoken answer.
        text = last;
      }
    }
  }

  text = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\b(?:txn|goal|cat|rec|spc)_[A-Za-z0-9]+\b/g, '')
    .replace(/(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\u{FE0F}?){2,}/gu, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Provider / host failures that sometimes arrive as "successful" model content.
  if (
    /configured model|is not loaded|available:\s*\(none\)|502 bad gateway|ai provider error/i.test(
      text,
    )
  ) {
    return 'Penny is temporarily unavailable — try again in a moment.';
  }

  return text;
}

function normalizeCompare(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}
