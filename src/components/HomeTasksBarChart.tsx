import React from 'react';

export type TaskCounts = {
  backlog: number;
  todo: number;
  in_progress: number;
  done: number;
};

const COLUMNS: { key: keyof TaskCounts; label: string; color: string }[] = [
  { key: 'backlog', label: 'Backlog', color: '#9C416B' },
  { key: 'todo', label: 'To do', color: '#8B704C' },
  { key: 'in_progress', label: 'In progress', color: '#712038' },
  { key: 'done', label: 'Done', color: '#4A1925' },
];

export default function HomeTasksBarChart({ counts }: { counts: TaskCounts }) {
  const rows = COLUMNS.map((col) => ({ ...col, count: counts[col.key] }));
  const maxCount = Math.max(...rows.map((r) => r.count), 1);
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="home-tasks-chart">
      <ul className="home-tasks-bars" role="list" aria-label="Tasks by status">
        {rows.map((row) => (
          <li key={row.key} className="home-tasks-bar-col">
            <div className="home-tasks-bar-stack">
              {row.count > 0 && <span className="home-tasks-bar-count">{row.count}</span>}
              <span
                className={`home-tasks-bar-fill${row.count === 0 ? ' home-tasks-bar-fill-empty' : ''}`}
                style={{
                  height: `${(row.count / maxCount) * 100}%`,
                  backgroundColor: row.color,
                }}
              />
            </div>
            <span className="home-tasks-bar-label">{row.label}</span>
          </li>
        ))}
      </ul>
      <p className="home-tasks-bar-total">
        {total} task{total !== 1 ? 's' : ''} on board
      </p>
    </div>
  );
}
