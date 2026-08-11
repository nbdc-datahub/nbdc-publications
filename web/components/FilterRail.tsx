'use client';

import { useId, useState } from 'react';
import { DOMAINS } from '../lib/data';
import { type FilterState, namesOf, type YearBounds } from '../lib/filter';

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{legend}</legend>
      {children}
    </fieldset>
  );
}

export function FilterRail({
  filter,
  bounds,
  canClear,
  onChange,
  onClearAll,
}: {
  filter: FilterState;
  bounds: YearBounds;
  /** False when the view is already at its defaults (including an empty table search). */
  canClear: boolean;
  onChange: (next: FilterState) => void;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const selected = new Set(namesOf(filter.domains));

  const set = (patch: Partial<FilterState>) => onChange({ ...filter, ...patch });

  const toggleDomain = (bit: number) => set({ domains: filter.domains ^ (1 << bit) });

  const span = Math.max(1, bounds.yearMax - bounds.yearMin);
  const pct = (year: number) => ((year - bounds.yearMin) / span) * 100;

  return (
    <div className="no-print">
      <button
        type="button"
        className="focus-ring btn-ghost mb-3 w-full rounded-lg px-3 py-2 text-sm md:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide filters' : 'Show filters'}
      </button>

      <div
        id={panelId}
        className={`${open ? 'block' : 'hidden'} glass-card space-y-6 rounded-xl p-5 md:block`}
      >
        <Fieldset legend="Research Domain(s)">
          <ul className="space-y-1">
            {DOMAINS.map((domain, bit) => (
              <li key={domain}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="focus-ring accent-[var(--accent)]"
                    checked={selected.has(domain)}
                    onChange={() => toggleDomain(bit)}
                  />
                  <span>{domain}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="focus-ring btn-ghost rounded-md px-2 py-1 text-xs"
            onClick={() => set({ domains: 0 })}
            disabled={filter.domains === 0}
          >
            Clear domain selections
          </button>
        </Fieldset>

        <Fieldset legend="Filter Type">
          {(
            [
              ['any', 'Match ANY selected domain'],
              ['all', 'Match ALL selected domains'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="matchtype"
                className="focus-ring accent-[var(--accent)]"
                checked={filter.matchType === value}
                onChange={() => set({ matchType: value })}
              />
              <span>{label}</span>
            </label>
          ))}
        </Fieldset>

        <Fieldset legend="Authors include ABCD member(s)?">
          {(['yes', 'no'] as const).map((key) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="focus-ring accent-[var(--accent)]"
                checked={filter.members[key]}
                onChange={() =>
                  set({ members: { ...filter.members, [key]: !filter.members[key] } })
                }
              />
              <span>{key}</span>
            </label>
          ))}
          {!filter.members.yes && !filter.members.no ? (
            <p className="text-xs text-muted">
              Neither value is selected, so nothing can match. Check one to see results.
            </p>
          ) : null}
        </Fieldset>

        <Fieldset legend="Publication Year">
          <div className="flex items-center justify-between text-sm">
            <span aria-hidden>
              {filter.yearMin} – {filter.yearMax}
            </span>
            <button
              type="button"
              className="focus-ring btn-ghost rounded-md px-2 py-1 text-xs"
              onClick={() => set({ yearMin: bounds.yearMin, yearMax: bounds.yearMax })}
              disabled={filter.yearMin === bounds.yearMin && filter.yearMax === bounds.yearMax}
            >
              Reset
            </button>
          </div>
          <div className="range-dual">
            <span className="range-track" aria-hidden />
            <span
              className="range-fill"
              aria-hidden
              style={{ left: `${pct(filter.yearMin)}%`, right: `${100 - pct(filter.yearMax)}%` }}
            />
            <input
              type="range"
              min={bounds.yearMin}
              max={bounds.yearMax}
              step={1}
              value={filter.yearMin}
              aria-label="Earliest publication year"
              onChange={(e) => set({ yearMin: Math.min(Number(e.target.value), filter.yearMax) })}
            />
            <input
              type="range"
              min={bounds.yearMin}
              max={bounds.yearMax}
              step={1}
              value={filter.yearMax}
              aria-label="Latest publication year"
              onChange={(e) => set({ yearMax: Math.max(Number(e.target.value), filter.yearMin) })}
            />
          </div>
        </Fieldset>

        <button
          type="button"
          className="focus-ring btn-primary w-full rounded-lg px-3 py-2 text-sm font-medium"
          onClick={onClearAll}
          disabled={!canClear}
        >
          ✖ Clear All Filters
        </button>
      </div>
    </div>
  );
}
