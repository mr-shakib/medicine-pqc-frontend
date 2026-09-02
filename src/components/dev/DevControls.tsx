'use client';

/**
 * Minimal control primitives for the development inspectors.
 *
 * Deliberately hand-rolled rather than pulling in a GUI library: these are the
 * only three widgets needed, a library would ship into the client bundle, and
 * building them here keeps the tooling inside the project's own design system.
 */

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <label className="block select-none">
      <span className="flex items-baseline justify-between gap-3">
        <span className="eyebrow text-n10">{label}</span>
        <span className="readout text-[11px] text-n11">
          {format ? format(value) : value.toFixed(3)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-px w-full cursor-pointer appearance-none bg-n07 accent-[var(--scene-accent)] outline-none
          [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-[var(--scene-accent)]
          [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3
          [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:bg-[var(--scene-accent)]"
      />
    </label>
  );
}

export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className="flex w-full items-center justify-between gap-3 py-1 text-left"
    >
      <span className="eyebrow text-n10">{label}</span>
      <span
        className="relative block h-3.5 w-7 rounded-full transition-colors duration-200"
        style={{
          backgroundColor: value ? 'var(--scene-accent)' : 'var(--color-n07)',
        }}
      >
        <span
          className="absolute top-0.5 block h-2.5 w-2.5 rounded-full bg-n00 transition-all duration-200"
          style={{ left: value ? 16 : 3 }}
        />
      </span>
    </button>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { label: string; value: T }[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <span className="eyebrow text-n10">{label}</span>
      <div className="mt-2 flex gap-1">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={option.value === value}
            className="flex-1 border px-2 py-1.5 text-[11px] transition-colors duration-200"
            style={{
              borderColor:
                option.value === value
                  ? 'var(--scene-accent)'
                  : 'var(--color-n07)',
              color:
                option.value === value
                  ? 'var(--scene-accent)'
                  : 'var(--color-n10)',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-n06/70 pt-4">
      <h2 className="eyebrow mb-3 text-n09">{title}</h2>
      <div className="flex flex-col gap-3.5">{children}</div>
    </section>
  );
}
