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
});
