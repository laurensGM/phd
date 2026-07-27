import React from 'react';

const TAG_OPTIONS = [
  'method',
  'theory',
  'conclusion',
  'model',
  'constructs',
  'agritech',
  'SSA',
  'results',
  'seminal',
  'ICT4D',
];

export type PaperEditForm = {
  url: string;
  secondary_url: string;
  title: string;
  authors: string;
  year: string;
  journal: string;
  motivation: string;
  tags: string[];
  citations: string;
  golden: boolean;
};

interface PaperDetailEditFormProps {
  form: PaperEditForm;
  saving: boolean;
  error: string | null;
  onChange: (next: PaperEditForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export default function PaperDetailEditForm({
  form,
  saving,
  error,
  onChange,
  onSubmit,
  onCancel,
}: PaperDetailEditFormProps) {
  const toggleTag = (tag: string) => {
    onChange({
      ...form,
      tags: form.tags.includes(tag) ? form.tags.filter((t) => t !== tag) : [...form.tags, tag],
    });
  };

  return (
    <section className="paper-detail-section paper-detail-details-form-section" aria-label="Edit paper details">
      <h2 className="paper-detail-section-title">Edit paper details</h2>
      {error && <p className="paper-detail-details-error">{error}</p>}
      <form className="paper-detail-details-form" onSubmit={onSubmit}>
        <div className="paper-detail-details-field">
          <label htmlFor="paper-detail-url">Link</label>
          <input
            id="paper-detail-url"
            type="url"
            value={form.url}
            onChange={(e) => onChange({ ...form, url: e.target.value })}
            required
            className="paper-detail-details-input"
          />
        </div>
        <div className="paper-detail-details-field">
          <label htmlFor="paper-detail-secondary-url">Secondary link (optional)</label>
          <input
            id="paper-detail-secondary-url"
            type="url"
            value={form.secondary_url}
            onChange={(e) => onChange({ ...form, secondary_url: e.target.value })}
            className="paper-detail-details-input"
          />
        </div>
        <div className="paper-detail-details-row">
          <div className="paper-detail-details-field">
            <label htmlFor="paper-detail-title">Title</label>
            <input
              id="paper-detail-title"
              type="text"
              value={form.title}
              onChange={(e) => onChange({ ...form, title: e.target.value })}
              className="paper-detail-details-input"
            />
          </div>
          <div className="paper-detail-details-field">
            <label htmlFor="paper-detail-year">Year</label>
            <input
              id="paper-detail-year"
              type="text"
              value={form.year}
              onChange={(e) => onChange({ ...form, year: e.target.value })}
              className="paper-detail-details-input"
            />
          </div>
          <div className="paper-detail-details-field">
            <label htmlFor="paper-detail-citations">Citations</label>
            <input
              id="paper-detail-citations"
              type="number"
              min={0}
              value={form.citations}
              onChange={(e) => onChange({ ...form, citations: e.target.value })}
              placeholder="e.g. 150"
              className="paper-detail-details-input"
            />
          </div>
        </div>
        <div className="paper-detail-details-field">
          <label htmlFor="paper-detail-authors">Authors</label>
          <input
            id="paper-detail-authors"
            type="text"
            value={form.authors}
            onChange={(e) => onChange({ ...form, authors: e.target.value })}
            className="paper-detail-details-input"
          />
        </div>
        <div className="paper-detail-details-field">
          <label htmlFor="paper-detail-journal">Journal</label>
          <input
            id="paper-detail-journal"
            type="text"
            value={form.journal}
            onChange={(e) => onChange({ ...form, journal: e.target.value })}
            className="paper-detail-details-input"
          />
        </div>
        <div className="paper-detail-details-field">
          <label htmlFor="paper-detail-motivation">Why I saved this</label>
          <textarea
            id="paper-detail-motivation"
            rows={3}
            value={form.motivation}
            onChange={(e) => onChange({ ...form, motivation: e.target.value })}
            className="paper-detail-details-input paper-detail-details-textarea"
          />
        </div>
        <fieldset className="paper-detail-details-field paper-detail-details-tags">
          <legend>Tags</legend>
          <div className="paper-detail-details-tag-chips">
            {TAG_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                className={`paper-detail-details-tag-chip${form.tags.includes(t) ? ' paper-detail-details-tag-chip--selected' : ''}`}
                onClick={() => toggleTag(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="paper-detail-details-golden">
          <input
            type="checkbox"
            checked={form.golden}
            onChange={(e) => onChange({ ...form, golden: e.target.checked })}
          />
          Golden paper
        </label>
        <div className="paper-detail-details-actions">
          <button type="submit" className="paper-detail-details-save" disabled={saving}>
            {saving ? 'Saving…' : 'Save details'}
          </button>
          <button type="button" className="paper-detail-details-cancel" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
