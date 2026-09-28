import { describe, expect, it } from 'vitest';
import { pickAvailableModel } from '@/lib/ai/chat';

describe('pickAvailableModel', () => {
  it('uses preferred when it is loaded', () => {
    expect(
      pickAvailableModel(['SD-Turbo-GGUF', 'Qwen3.8-27B-GGUF-UD-IQ3_XXS'], 'Qwen3.8-27B-GGUF-UD-IQ3_XXS'),
    ).toBe('Qwen3.8-27B-GGUF-UD-IQ3_XXS');
  });

  it('falls back to a chat model when preferred is missing', () => {
    expect(
      pickAvailableModel(['SD-Turbo-GGUF', 'Qwen3.8-27B-GGUF-UD-IQ3_XXS'], 'Qwen3.5-27B-UD-IQ3_XXS'),
    ).toBe('Qwen3.8-27B-GGUF-UD-IQ3_XXS');
  });

  it('skips image models when picking a default', () => {
    expect(pickAvailableModel(['SD-Turbo-GGUF', 'llama-3-8b'])).toBe('llama-3-8b');
  });
});
