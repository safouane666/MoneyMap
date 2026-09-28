'use client';

export function SetupLocaleCard({
  nativeName,
  englishName,
  selected,
  onSelect,
}: {
  nativeName: string;
  englishName: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-16 w-full items-center justify-between rounded-[var(--cm-radius-feature)] border px-5 text-start transition-[background,border,transform] duration-[var(--cm-motion-fast)] active:scale-[0.99] ${
        selected
          ? 'border-brand bg-brand-tint text-brand'
          : 'border-border bg-surface text-ink hover:bg-canvas'
      }`}
    >
      <span className="text-lg font-semibold tracking-tight">{nativeName}</span>
      <span className={`text-sm ${selected ? 'text-brand/80' : 'text-ink-muted'}`}>{englishName}</span>
    </button>
  );
}
