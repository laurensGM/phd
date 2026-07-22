import React from 'react';

export type TaskCounts = {
  backlog: number;
  todo: number;
  in_progress: number;
  done: number;
};

const COLUMNS: { key: keyof TaskCounts; label: string; color: string }[] = [
  { key: 'backlog', label: 'Backlog', color: '#7c3aed' },
  { key: 'todo', label: 'To do', color: '#ca8a04' },
  { key: 'in_progress', label: 'In progress', color: '#2563eb' },
  { key: 'done', label: 'Done', color: '#16a34a' },
];

export default function HomeTasksBarChart({ counts }: { counts: TaskCounts }) {
  const rows = COLUMNS.map((col) => ({ ...col, count: counts[col.key] }));
  const maxCount = Math.max(...rows.map((r) => r.count), 1);
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <ul className="home-tasks-bars" role="list" aria-label="Tasks by status">
      {rows.map((row) => (
        <li key={row.key} className="home-tasks-bar-row">
          <span className="home-tasks-bar-label">{row.label}</span>
          <span className="home-tasks-bar-track">
            <span
              className="home-tasks-bar-fill"
              style={{
                width: `${(row.count / maxCount) * 100}%`,
                backgroundColor: row.color,
              }}
            />
          </span>
          <span className="home-tasks-bar-count">{row.count}</span>
        </li>
      ))}
      <li className="home-tasks-bar-total" aria-hidden="true">
        {total} task{total !== 1 ? 's' : ''} on board
      </li>
    </ul>
  );
}
