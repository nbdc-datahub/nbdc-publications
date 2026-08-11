'use client';

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import type { PubRow } from '../lib/data';
import type { Selection } from '../lib/selection';

const PAGE_SIZES = [10, 25, 50, 100];

/**
 * `rows` is already filtered AND searched by the caller (see lib/filter.ts), so the table and
 * the "search results" export can never disagree about which rows are in play. The table only
 * sorts and paginates.
 */
export function PubTable({
  rows,
  search,
  onSearchChange,
  selection,
  onToggle,
  onViewAbstract,
}: {
  rows: readonly PubRow[];
  search: string;
  onSearchChange: (value: string) => void;
  selection: Selection;
  onToggle: (url: string) => void;
  onViewAbstract: (row: PubRow) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const columns = useMemo<ColumnDef<PubRow>[]>(
    () => [
      {
        id: 'select',
        header: () => <span className="sr-only">Select</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="focus-ring accent-[var(--accent)]"
            checked={selection.has(row.original.url)}
            onChange={() => onToggle(row.original.url)}
            aria-label={`Select ${row.original.title}`}
          />
        ),
      },
      { accessorKey: 'year', header: 'Year' },
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => (
          <a
            href={row.original.url}
            target="_blank"
            rel="noreferrer"
            className="focus-ring text-accent underline underline-offset-2"
          >
            {row.original.title}
          </a>
        ),
      },
      {
        id: 'abstract',
        header: 'Abstract',
        enableSorting: false,
        cell: ({ row }) => (
          <button
            type="button"
            className="focus-ring btn-ghost rounded-md px-2 py-1 text-xs"
            onClick={() => onViewAbstract(row.original)}
            aria-label={`View abstract for ${row.original.title}`}
          >
            View
          </button>
        ),
      },
      {
        accessorKey: 'authors',
        header: 'Authors',
        cell: ({ getValue }) => {
          const authors = getValue<string>();
          return (
            <span className="block max-w-[16rem] truncate" title={authors}>
              {authors}
            </span>
          );
        },
      },
      { accessorKey: 'journal', header: 'Journal' },
    ],
    [selection, onToggle, onViewAbstract],
  );

  const table = useReactTable({
    data: rows as PubRow[],
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getRowId: (row) => row.url,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const first = rows.length === 0 ? 0 : pageIndex * pageSize + 1;
  const last = Math.min((pageIndex + 1) * pageSize, rows.length);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Search publications</span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search title, authors, journal…"
            className="focus-ring w-64 rounded-md border border-border bg-card px-3 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          className="focus-ring btn-ghost rounded-md px-2 py-1.5 text-xs"
          onClick={() => onSearchChange('')}
          disabled={search === ''}
        >
          Clear Search
        </button>
        <span className="ml-auto text-sm text-muted" aria-live="polite">
          {rows.length === 0
            ? 'No matching records found.'
            : `Showing ${first}–${last} of ${rows.length.toLocaleString()}`}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[54rem] border-collapse text-sm">
          <thead className="bg-card">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : sortable
                              ? 'none'
                              : undefined
                      }
                      className="border-b border-border px-3 py-2 text-left font-semibold"
                    >
                      {sortable ? (
                        <button
                          type="button"
                          className="focus-ring inline-flex items-center gap-1"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span aria-hidden className="text-muted">
                            {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '↕'}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-border last:border-0 ${
                  selection.has(row.original.url)
                    ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]'
                    : ''
                }`}
                // Row click is a convenience shortcut; links, buttons and the checkbox keep
                // their own behaviour (spec §4.3).
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a, button, input')) return;
                  onToggle(row.original.url);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          className="focus-ring btn-ghost rounded-md px-2 py-1"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          ← Previous
        </button>
        <span>
          Page {pageIndex + 1} of {Math.max(1, table.getPageCount())}
        </span>
        <button
          type="button"
          className="focus-ring btn-ghost rounded-md px-2 py-1"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next →
        </button>
        <label className="ml-auto flex items-center gap-2">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="focus-ring rounded-md border border-border bg-card px-2 py-1"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
