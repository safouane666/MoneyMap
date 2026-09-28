import { describe, expect, it } from 'vitest';
import { mergeSpeechResults } from '@/lib/voice/useVoiceInput';

function result(transcript: string, isFinal: boolean) {
  const row = [{ transcript }] as { transcript: string }[] & { isFinal?: boolean };
  row.isFinal = isFinal;
  return row;
}

describe('mergeSpeechResults', () => {
  it('accumulates final chunks and shows interim separately', () => {
    const first = mergeSpeechResults('', {
      resultIndex: 0,
      results: [result('bought a', true), result('pizza', false)],
    });
    expect(first.finals).toBe('bought a');
    expect(first.interim).toBe('pizza');
    expect(first.combined).toBe('bought a pizza');

    const second = mergeSpeechResults(first.finals, {
      resultIndex: 1,
      results: [result('bought a', true), result('pizza for 12', true)],
    });
    expect(second.finals).toBe('bought a pizza for 12');
    expect(second.interim).toBe('');
    expect(second.combined).toBe('bought a pizza for 12');
  });

  it('does not hardcode coffee or any fixed phrase', () => {
    const merged = mergeSpeechResults('', {
      resultIndex: 0,
      results: [result('I bought a pizza', true)],
    });
    expect(merged.combined).toBe('I bought a pizza');
    expect(merged.combined.includes('coffee')).toBe(false);
  });

  it('reads transcript via result.item when index access is missing', () => {
    const row = {
      isFinal: true,
      length: 1,
      item(index: number) {
        return index === 0 ? { transcript: 'spent twenty on lunch' } : { transcript: '' };
      },
    } as { isFinal: boolean; length: number; item: (index: number) => { transcript: string } };
    const merged = mergeSpeechResults('', {
      resultIndex: 0,
      results: {
        length: 1,
        0: row as never,
      },
    });
    expect(merged.combined).toBe('spent twenty on lunch');
  });
});
