import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const COLUMNS: { id: string; title: string }[] = [
  { id: 'todo', title: 'To do' },
  { id: 'in_progress', title: 'In progress' },
  { id: 'done', title: 'Done' },
];

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function mapRow(row: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addStatus, setAddStatus] = useState<string>('todo');
  const [addTitle, setAddTitle] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [justDraggedId, setJustDraggedId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
      setTasks([]);
    } else {
      setTasks((data ?? []).map(mapRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    fetchTasks();
  }, [fetchTasks]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedId(taskId);
    setJustDraggedId(null);
    e.dataTransfer.setData('application/json', JSON.stringify({ taskId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const prevId = draggedId;
    setDraggedId(null);
    if (prevId) setJustDraggedId(prevId);
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const { taskId } = JSON.parse(raw);
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === newStatus) return;
      if (!supabase) return;
      setError(null);
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', taskId);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t))
      );
    } catch {
      setDraggedId(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !addTitle.trim()) return;
    setSaving(true);
    setError(null);
    const maxOrder = Math.max(0, ...tasks.filter((t) => t.status === addStatus).map((t) => t.sort_order));
    const { data, error: insertError } = await supabase
      .from('tasks')
      .insert({
        title: addTitle.trim(),
        description: addDescription.trim() || null,
        status: addStatus,
        sort_order: maxOrder + 1,
      })
      .select('*')
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) {
      setTasks((prev) => [mapRow(data), ...prev]);
      setAddTitle('');
      setAddDescription('');
      setShowAdd(false);
    }
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description ?? '');
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !editingId || !editTitle.trim()) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === editingId
          ? { ...t, title: editTitle.trim(), description: editDescription.trim() || null, updated_at: new Date().toISOString() }
          : t
      )
    );
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this task?')) return;
    if (!supabase) return;
    setError(null);
    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
    if (detailTaskId === id) setDetailTaskId(null);
  };

  const detailTask = detailTaskId ? tasks.find((t) => t.id === detailTaskId) : null;
  const openEditFromModal = (task: Task) => {
    setDetailTaskId(null);
    startEdit(task);
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="kanban-setup">
        <p>Add your Supabase credentials to use the task board. See the README for setup.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="kanban-loading">Loading tasks…</div>;
  }

  return (
    <div className="kanban-board">
      {error && <p className="kanban-error">{error}</p>}
      <div className="kanban-actions">
        <button type="button" className="kanban-add-btn" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? '− Cancel' : '+ Add task'}
        </button>
        {showAdd && (
          <form className="kanban-add-form" onSubmit={handleAdd}>
            <div className="kanban-form-row">
              <label htmlFor="task-title">Title</label>
              <input
                id="task-title"
                type="text"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="Task title"
                className="kanban-input"
                required
                autoFocus
              />
            </div>
            <div className="kanban-form-row">
              <label htmlFor="task-desc">Description (optional)</label>
              <textarea
                id="task-desc"
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                placeholder="Description"
                className="kanban-textarea"
                rows={2}
              />
            </div>
            <div className="kanban-form-row">
              <label>Column</label>
              <select
                value={addStatus}
                onChange={(e) => setAddStatus(e.target.value)}
                className="kanban-select"
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="kanban-submit" disabled={saving}>
              {saving ? 'Adding…' : 'Add task'}
            </button>
          </form>
        )}
      </div>

      <div className="kanban-columns">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            className={`kanban-column ${draggedId ? 'kanban-column-droppable' : ''}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <h3 className="kanban-column-title">{col.title}</h3>
            <div className="kanban-cards">
              {tasks
                .filter((t) => t.status === col.id)
                .map((task) =>
                  editingId === task.id ? (
                    <form key={task.id} className="kanban-card kanban-card-edit" onSubmit={handleSaveEdit}>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="kanban-input"
                        required
                        placeholder="Title"
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="kanban-textarea"
                        rows={2}
                        placeholder="Description"
                      />
                      <div className="kanban-card-actions">
                        <button type="submit" className="kanban-btn kanban-btn-primary" disabled={saving}>
                          Save
                        </button>
                        <button type="button" className="kanban-btn kanban-btn-secondary" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      key={task.id}
                      className={`kanban-card ${draggedId === task.id ? 'kanban-card-dragging' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                    >
                      <div
                        className="kanban-card-content"
                        onClick={() => {
                          if (justDraggedId !== task.id) setDetailTaskId(task.id);
                          setJustDraggedId(null);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setDetailTaskId(task.id)}
                        aria-label={`View task: ${task.title}`}
                      >
                        <h4 className="kanban-card-title">{task.title}</h4>
                        {task.description ? (
                          <p className="kanban-card-desc">{task.description}</p>
                        ) : (
                          <p className="kanban-card-desc kanban-card-desc-empty">No description</p>
                        )}
                      </div>
                      <div className="kanban-card-actions">
                        <button type="button" className="kanban-card-action" onClick={(e) => { e.stopPropagation(); startEdit(task); }}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="kanban-card-action kanban-card-delete"
                          onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                )}
            </div>
          </div>
        ))}
      </div>

      {detailTask && (
        <div
          className="kanban-detail-overlay"
          onClick={() => setDetailTaskId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="kanban-detail-title"
        >
          <div
            className="kanban-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="kanban-detail-title" className="kanban-detail-title">{detailTask.title}</h2>
            <div className="kanban-detail-meta">
              <span className="kanban-detail-status">
                {COLUMNS.find((c) => c.id === detailTask.status)?.title ?? detailTask.status}
              </span>
              <span className="kanban-detail-dates">
                Created {new Date(detailTask.created_at).toLocaleDateString()}
                {detailTask.updated_at !== detailTask.created_at &&
                  ` · Updated ${new Date(detailTask.updated_at).toLocaleDateString()}`}
              </span>
            </div>
            <div className="kanban-detail-description">
              {detailTask.description ? (
                <p className="kanban-detail-description-text">{detailTask.description}</p>
              ) : (
                <p className="kanban-detail-description-empty">No description.</p>
              )}
            </div>
            <div className="kanban-detail-actions">
              <button
                type="button"
                className="kanban-btn kanban-btn-primary"
                onClick={() => openEditFromModal(detailTask)}
              >
                Edit
              </button>
              <button
                type="button"
                className="kanban-btn kanban-card-delete"
                onClick={() => handleDelete(detailTask.id)}
              >
                Delete
              </button>
              <button
                type="button"
                className="kanban-btn kanban-btn-secondary"
                onClick={() => setDetailTaskId(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
