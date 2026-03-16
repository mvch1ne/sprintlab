// ── Ground contact table ───────────────────────────────────────────────────────
import { useState } from 'react';
import { SectionHead } from './SectionHead';
import type { GroundContactEvent } from '../useSprintMetrics';

export function ContactsTab({
  contacts,
  calibrated,
  onDelete,
  onEdit,
}: {
  contacts: GroundContactEvent[];
  calibrated: boolean;
  onDelete?: ((id: string) => void) | null;
  onEdit?:
    | ((id: string, contactFrame: number, liftFrame: number) => void)
    | null;
}) {
  const [editing, setEditing] = useState<{
    id: string;
    field: 'start' | 'end';
    value: string;
  } | null>(null);

  if (!contacts.length)
    return (
      <p className="px-3 py-4 text-xs font-mono text-zinc-500 italic">
        No contacts detected.
      </p>
    );

  const unit = calibrated ? 'm' : 'px';
  const L = '#4ade80',
    R = '#fb923c';

  // Symmetry summary
  const lContacts = contacts.filter((c) => c.foot === 'left');
  const rContacts = contacts.filter((c) => c.foot === 'right');
  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b) / arr.length : 0;
  const lGCT = avg(lContacts.map((c) => c.contactTime)) * 1000;
  const rGCT = avg(rContacts.map((c) => c.contactTime)) * 1000;
  const lFT =
    avg(lContacts.map((c) => c.flightTimeBefore).filter((t) => t > 0)) * 1000;
  const rFT =
    avg(rContacts.map((c) => c.flightTimeBefore).filter((t) => t > 0)) * 1000;

  return (
    <div>
      {/* Symmetry summary */}
      <SectionHead label="Symmetry" color="#38bdf8" />
      <div className="grid grid-cols-3 text-xs font-mono">
        <div className="px-3 py-1.5 border-b border-r border-zinc-100 dark:border-zinc-800/60 text-zinc-500 uppercase tracking-wide" />
        <div
          className="px-3 py-1.5 border-b border-r border-zinc-100 dark:border-zinc-800/60 font-bold"
          style={{ color: L }}
        >
          Left
        </div>
        <div
          className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800/60 font-bold"
          style={{ color: R }}
        >
          Right
        </div>
        {[
          ['GCT avg', `${lGCT.toFixed(0)}ms`, `${rGCT.toFixed(0)}ms`],
          ['Flight avg', `${lFT.toFixed(0)}ms`, `${rFT.toFixed(0)}ms`],
          ['Steps', String(lContacts.length), String(rContacts.length)],
        ].map(([k, l, r]) => (
          <>
            <div
              key={k + '-k'}
              className="px-3 py-1 border-b border-r border-zinc-100 dark:border-zinc-800/60 text-zinc-500"
            >
              {k}
            </div>
            <div
              key={k + '-l'}
              className="px-3 py-1 border-b border-r border-zinc-100 dark:border-zinc-800/60 tabular-nums"
            >
              {l}
            </div>
            <div
              key={k + '-r'}
              className="px-3 py-1 border-b border-zinc-100 dark:border-zinc-800/60 tabular-nums"
            >
              {r}
            </div>
          </>
        ))}
      </div>

      {/* Step-by-step table */}
      <SectionHead label="Per-step detail" color="#38bdf8" />
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              {[
                '#',
                'Ft',
                'In',
                'Out',
                'GCT',
                'Flight',
                'Step',
                'Freq',
                'COM -> Foot',
              ].map((h) => (
                <th
                  key={h}
                  className="px-1.5 py-1 text-left text-zinc-400 uppercase tracking-wide font-normal whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
              {onDelete && <th className="px-1 py-1" />}
            </tr>
          </thead>
          <tbody>
            {contacts.map((c, i) => {
              const color = c.foot === 'left' ? L : R;
              return (
                <tr
                  key={i}
                  className="border-b border-zinc-100 dark:border-zinc-800/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-1.5 py-0.5 text-zinc-400 tabular-nums">
                    {i + 1}
                  </td>
                  <td
                    className="px-1.5 py-0.5 font-bold tabular-nums"
                    style={{ color }}
                  >
                    {c.foot === 'left' ? 'L' : 'R'}
                  </td>
                  {/* Inline-editable contact frame (In) */}
                  <td className="px-1 py-0.5 tabular-nums text-zinc-500">
                    {onEdit &&
                    c.id &&
                    editing?.id === c.id &&
                    editing.field === 'start' ? (
                      <input
                        autoFocus
                        type="number"
                        className="w-12 bg-zinc-800 text-zinc-200 text-xs font-mono px-1 rounded outline-none border border-violet-500/60"
                        value={editing.value}
                        onChange={(e) =>
                          setEditing({ ...editing, value: e.target.value })
                        }
                        onBlur={() => {
                          const n = parseInt(editing.value, 10);
                          if (!isNaN(n) && n >= 0)
                            onEdit(c.id!, n, c.liftFrame);
                          setEditing(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')
                            (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditing(null);
                        }}
                      />
                    ) : (
                      <span
                        className={
                          onEdit && c.id
                            ? 'cursor-pointer hover:text-violet-400 transition-colors'
                            : ''
                        }
                        onClick={() =>
                          onEdit &&
                          c.id &&
                          setEditing({
                            id: c.id,
                            field: 'start',
                            value: String(c.contactFrame),
                          })
                        }
                        title={
                          onEdit ? 'Click to edit contact frame' : undefined
                        }
                      >
                        {c.contactFrame}
                      </span>
                    )}
                  </td>
                  {/* Inline-editable lift frame (Out) */}
                  <td className="px-1 py-0.5 tabular-nums text-zinc-500">
                    {onEdit &&
                    c.id &&
                    editing?.id === c.id &&
                    editing.field === 'end' ? (
                      <input
                        autoFocus
                        type="number"
                        className="w-12 bg-zinc-800 text-zinc-200 text-xs font-mono px-1 rounded outline-none border border-violet-500/60"
                        value={editing.value}
                        onChange={(e) =>
                          setEditing({ ...editing, value: e.target.value })
                        }
                        onBlur={() => {
                          const n = parseInt(editing.value, 10);
                          if (!isNaN(n) && n > c.contactFrame)
                            onEdit(c.id!, c.contactFrame, n);
                          setEditing(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')
                            (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditing(null);
                        }}
                      />
                    ) : (
                      <span
                        className={
                          onEdit && c.id
                            ? 'cursor-pointer hover:text-violet-400 transition-colors'
                            : ''
                        }
                        onClick={() =>
                          onEdit &&
                          c.id &&
                          setEditing({
                            id: c.id,
                            field: 'end',
                            value: String(c.liftFrame),
                          })
                        }
                        title={onEdit ? 'Click to edit lift frame' : undefined}
                      >
                        {c.liftFrame}
                      </span>
                    )}
                  </td>
                  <td className="px-1.5 py-0.5 tabular-nums text-sky-500">
                    {(c.contactTime * 1000).toFixed(0)}ms
                  </td>
                  <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">
                    {c.flightTimeBefore > 0.01
                      ? `${(c.flightTimeBefore * 1000).toFixed(0)}ms`
                      : '—'}
                  </td>
                  <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">
                    {c.stepLength !== null
                      ? `${c.stepLength.toFixed(calibrated ? 2 : 0)}${unit}`
                      : '—'}
                  </td>
                  <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">
                    {c.stepFrequency !== null
                      ? `${c.stepFrequency.toFixed(2)}Hz`
                      : '—'}
                  </td>
                  <td className="px-1.5 py-0.5 tabular-nums text-zinc-500">
                    {c.comDistance !== 0
                      ? `${c.comDistance > 0 ? '+' : ''}${c.comDistance.toFixed(calibrated ? 2 : 0)}${unit}`
                      : '—'}
                  </td>
                  {onDelete && (
                    <td className="px-1 py-0.5">
                      {c.id && (
                        <button
                          onClick={() => onDelete(c.id!)}
                          className="text-xs text-red-500/60 hover:text-red-400 transition-colors cursor-pointer leading-none"
                          title="Delete contact"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
