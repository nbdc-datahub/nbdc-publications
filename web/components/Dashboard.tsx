'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AbstractStore } from '../lib/abstracts';
import { decodeRows, type PubIndex, type PubRow } from '../lib/data';
import {
  defaultFilter,
  type FilterState,
  filterRows,
  isDefaultFilter,
  searchRows,
} from '../lib/filter';
import { loadIndex } from '../lib/load';
import { type Selection, toggleSelection } from '../lib/selection';
import { fromQuery, toQuery } from '../lib/url-state';
import { AbstractModal, type AbstractView } from './AbstractModal';
import { DomainChart } from './DomainChart';
import { DownloadPanel } from './DownloadPanel';
import { FilterRail } from './FilterRail';
import { PubTable } from './PubTable';
import { YearChart } from './YearChart';

interface Loaded {
  index: PubIndex;
  rows: PubRow[];
  abstracts: AbstractStore;
}

export function Dashboard() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterState | null>(null);
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<Selection>(new Set());
  const [view, setView] = useState<AbstractView | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadIndex()
      .then((index) => {
        if (cancelled) return;
        const bounds = { yearMin: index.yearMin, yearMax: index.yearMax };
        // Restore a shared permalink before the first paint of the table (Plans 6.1).
        const restored = fromQuery(window.location.search.replace(/^\?/, ''), bounds);
        setLoaded({
          index,
          rows: decodeRows(index),
          abstracts: new AbstractStore(index.rowCount, index.shardSize),
        });
        setFilter(restored.filter);
        setSearch(restored.search);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bounds = useMemo(
    () => ({ yearMin: loaded?.index.yearMin ?? 0, yearMax: loaded?.index.yearMax ?? 0 }),
    [loaded],
  );

  const filtered = useMemo(
    () => (loaded && filter ? filterRows(loaded.rows, filter) : []),
    [loaded, filter],
  );
  const searched = useMemo(() => searchRows(filtered, search), [filtered, search]);

  // Keep the address bar in step so the current view is always shareable.
  useEffect(() => {
    if (!filter) return;
    const query = toQuery({ filter, search }, bounds);
    const url = query ? `?${query}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [filter, search, bounds]);

  const openAbstract = useCallback(
    (row: PubRow) => {
      if (!loaded) return;
      setView({ title: row.title, url: row.url, status: 'loading', text: '' });
      loaded.abstracts
        .get(row.i)
        .then((text) => setView({ title: row.title, url: row.url, status: 'ready', text }))
        .catch(() => setView({ title: row.title, url: row.url, status: 'error', text: '' }));
    },
    [loaded],
  );

  const toggle = useCallback((url: string) => {
    setSelection((current) => toggleSelection(current, url));
  }, []);

  if (loadError) {
    return (
      <div role="alert" className="glass-card rounded-xl p-6">
        <h2 className="text-base font-semibold">The publication data could not be loaded</h2>
        <p className="mt-2 text-sm text-muted">{loadError}</p>
      </div>
    );
  }

  if (!loaded || !filter) {
    return (
      <div className="glass-card rounded-xl p-6 text-sm text-muted" aria-busy="true">
        Loading publications
        <span className="dot-pulse" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </div>
    );
  }

  const { index, abstracts } = loaded;
  const clean = isDefaultFilter(filter, bounds) && search === '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted">
          Last updated {index.lastUpdated} · {index.rowCount.toLocaleString()} publications total
        </p>
        <p className="text-lg font-semibold" aria-live="polite">
          {filtered.length === 0
            ? 'No matching records found.'
            : `Showing ${filtered.length.toLocaleString()} publications`}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[18rem_1fr]">
        <FilterRail
          filter={filter}
          bounds={bounds}
          canClear={!clean}
          onChange={setFilter}
          onClearAll={() => {
            setFilter(defaultFilter(bounds));
            setSearch('');
          }}
        />

        <div className="min-w-0 space-y-6">
          <div className="chart-grid grid gap-6 min-[1450px]:grid-cols-[7fr_5fr]">
            <DomainChart rows={filtered} selectedMask={filter.domains} />
            <YearChart rows={filtered} />
          </div>

          <section className="glass-card space-y-4 rounded-xl p-5">
            <DownloadPanel
              index={index}
              abstracts={abstracts}
              filtered={filtered}
              searched={searched}
              selection={selection}
              onClearSelection={() => setSelection(new Set())}
            />
            <PubTable
              rows={searched}
              search={search}
              onSearchChange={setSearch}
              selection={selection}
              onToggle={toggle}
              onViewAbstract={openAbstract}
            />
          </section>
        </div>
      </div>

      <AbstractModal view={view} onClose={() => setView(null)} />
    </div>
  );
}
