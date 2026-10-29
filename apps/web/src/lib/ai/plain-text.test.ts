import { describe, expect, it } from 'vitest';
import { toPennyPlainText } from './plain-text';

describe('toPennyPlainText', () => {
  it('strips markdown and transaction ids', () => {
    const raw = [
      "Here's your spending report:",
      '',
      '- **Income:** TND 100',
      '- **Expenses:** TND 50',
      '',
      'Recent: txn_R0405ZFN8FA2A04DGH4DQYRT0E expense TND 30',
    ].join('\n');
    const plain = toPennyPlainText(raw);
    expect(plain).not.toContain('**');
    expect(plain).not.toContain('txn_');
    expect(plain).toContain('Income: TND 100');
    expect(plain).toContain('Expenses: TND 50');
  });

  it('strips leaked think tags and duplicate answers', () => {
    const raw =
      'You spent TND 10. </think> You spent TND 10.';
    const plain = toPennyPlainText(raw);
    expect(plain).not.toMatch(/think/i);
    expect(plain).toBe('You spent TND 10.');
  });

  it('replaces provider failure text with a friendly line', () => {
    const plain = toPennyPlainText(
      'Configured model “Qwen3.5-9B-GGUF” is not loaded. Available: (none).',
    );
    expect(plain).toMatch(/temporarily unavailable/i);
    expect(plain).not.toMatch(/Qwen/i);
  });
});
