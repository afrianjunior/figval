import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '../cx';
import { Swatch } from './Swatch';

export interface ColorRowProps {
  readonly value: string;
  readonly onChange: (hex: string) => void;
  /** Page colors shown on top of the picker. */
  readonly swatches?: readonly string[];
  readonly swatchButtonLabel: string;
  readonly hexLabel: string;
  readonly pickerLabel: string;
  readonly swatchesLabel: string;
  readonly className?: string;
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const normalizeHex = (text: string): string | null => {
  const match = HEX.exec(text.trim());
  if (!match) return null;
  const digits = (match[1] ?? '').toUpperCase();
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  return `#${full}`;
};

export function ColorRow({
  value,
  onChange,
  swatches = [],
  swatchButtonLabel,
  hexLabel,
  pickerLabel,
  swatchesLabel,
  className,
}: ColorRowProps) {
  const popId = useId();
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const node = root.current;
    const scope = node?.getRootNode() as Document | ShadowRoot | undefined;
    const onDown = (e: Event) => {
      if (node && !e.composedPath().includes(node)) setOpen(false);
    };
    scope?.addEventListener('pointerdown', onDown, true);
    return () => scope?.removeEventListener('pointerdown', onDown, true);
  }, [open]);

  const commit = () => {
    const hex = draft === null ? null : normalizeHex(draft);
    if (hex && hex !== value) onChange(hex);
    setDraft(null);
  };

  const pick = (hex: string) => {
    const normalized = normalizeHex(hex);
    if (normalized) onChange(normalized);
  };

  return (
    <div
      ref={root}
      className={cx('fv-color', className)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
          opener.current?.focus();
        }
      }}
    >
      <Swatch
        ref={opener}
        color={value}
        label={swatchButtonLabel}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={() => setOpen((o) => !o)}
        selected={undefined}
      />
      <input
        type="text"
        aria-label={hexLabel}
        spellCheck={false}
        className="fv-input fv-input--mono fv-color__hex"
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setDraft(null);
        }}
      />
      {open ? (
        <div id={popId} role="group" aria-label={pickerLabel} className="fv-color__pop">
          {swatches.length > 0 ? (
            <div role="group" aria-label={swatchesLabel} className="fv-color__swatches">
              {swatches.map((hex) => (
                <Swatch
                  key={hex}
                  color={hex}
                  label={hex}
                  size="sm"
                  selected={normalizeHex(hex) === normalizeHex(value)}
                  onClick={() => pick(hex)}
                />
              ))}
            </div>
          ) : null}
          <input
            type="color"
            aria-label={pickerLabel}
            className="fv-color__native"
            value={(normalizeHex(value) ?? '#000000').toLowerCase()}
            onChange={(e) => pick(e.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}
