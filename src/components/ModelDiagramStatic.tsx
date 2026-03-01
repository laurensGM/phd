import React from 'react';

interface Model {
  id: string;
  name: string;
  abbreviation: string;
  year: number;
  authors: string[];
  constructs: string[];
  constructAbbreviations?: Record<string, string>;
  relationships: { from: string; to: string }[];
  diagramType?: string;
}

interface ModelDiagramStaticProps {
  model: Model;
  constructToSlug?: Record<string, string>;
  base?: string;
}

function EcmIsStatic({ base = '', constructToSlug = {} }: { base: string; constructToSlug: Record<string, string> }) {
  const slug = (name: string) => constructToSlug[name];
  return (
    <div className="static-diagram static-diagram-ecm">
      <p className="static-diagram-hint">Constructs and relationships in the model.</p>
      <div className="static-diagram-flow">
        <div className="static-diagram-box static-diagram-box-prior">
          <div className="static-diagram-box-label">CONSTRUCT 1</div>
          <div className="static-diagram-box-name">Prior Expectations</div>
          <div className="static-diagram-box-desc">What users expected before use</div>
        </div>
        <div className="static-diagram-arrows-row">
          <div className="static-diagram-arrow-wrap"><span className="static-diagram-arrow-label">shapes</span><span className="static-diagram-arrow">→</span></div>
          <div className="static-diagram-arrow-wrap"><span className="static-diagram-arrow-label">compared with</span><span className="static-diagram-arrow">→</span></div>
        </div>
        <div className="static-diagram-stack">
          <a href={slug('Perceived Usefulness') ? `${base}constructs/${slug('Perceived Usefulness')}/` : '#'} className="static-diagram-box static-diagram-box-postuse">
            <div className="static-diagram-box-label">CONSTRUCT 2a</div>
            <div className="static-diagram-box-name">Perceived Usefulness</div>
            <div className="static-diagram-box-desc">Belief that using the system improves performance</div>
          </a>
          <a href={slug('Confirmation') ? `${base}constructs/${slug('Confirmation')}/` : '#'} className="static-diagram-box static-diagram-box-postuse">
            <div className="static-diagram-box-label">CONSTRUCT 2b</div>
            <div className="static-diagram-box-name">Confirmation</div>
            <div className="static-diagram-box-desc">Extent expectations were met by actual experience</div>
          </a>
        </div>
        <div className="static-diagram-arrows-row">
          <div className="static-diagram-arrow-wrap"><span className="static-diagram-arrow-label">influences</span><span className="static-diagram-arrow">→</span></div>
          <div className="static-diagram-arrow-wrap"><span className="static-diagram-arrow-label">drives</span><span className="static-diagram-arrow">→</span></div>
        </div>
        <a href={slug('Satisfaction') ? `${base}constructs/${slug('Satisfaction')}/` : '#'} className="static-diagram-box static-diagram-box-affective">
          <div className="static-diagram-box-label">CONSTRUCT 3</div>
          <div className="static-diagram-box-name">Satisfaction</div>
          <div className="static-diagram-box-desc">Overall feeling after using the product</div>
        </a>
        <div className="static-diagram-arrow-wrap"><span className="static-diagram-arrow-label">predicts</span><span className="static-diagram-arrow">→</span></div>
        <a href={slug('Continuance Intention') ? `${base}constructs/${slug('Continuance Intention')}/` : '#'} className="static-diagram-box static-diagram-box-intention">
          <div className="static-diagram-box-label">CONSTRUCT 4</div>
          <div className="static-diagram-box-name">Continuance Intention</div>
          <div className="static-diagram-box-desc">Intention to keep using the technology</div>
        </a>
        <div className="static-diagram-arrow-wrap"><span className="static-diagram-arrow-label">leads to</span><span className="static-diagram-arrow">→</span></div>
        <a href={slug('Continued Use') ? `${base}constructs/${slug('Continued Use')}/` : '#'} className="static-diagram-box static-diagram-box-behavior">
          <div className="static-diagram-box-label">CONSTRUCT 5</div>
          <div className="static-diagram-box-name">Continued Use</div>
          <div className="static-diagram-box-desc">Actual sustained usage behaviour</div>
        </a>
      </div>
      <p className="static-diagram-note">
        <strong>Note:</strong> Perceived Usefulness also has a direct path to Continuance Intention (bypassing satisfaction).
      </p>
      <div className="static-diagram-legend">
        <span><span className="static-diagram-legend-dot prior" /> Pre-use cognitive state</span>
        <span><span className="static-diagram-legend-dot postuse" /> Post-use cognition</span>
        <span><span className="static-diagram-legend-dot affective" /> Affective response</span>
        <span><span className="static-diagram-legend-dot intention" /> Behavioural intention</span>
        <span><span className="static-diagram-legend-dot behavior" /> Actual behaviour</span>
      </div>
    </div>
  );
}

function GenericStatic({ model, base = '', constructToSlug = {} }: ModelDiagramStaticProps) {
  const abbrevMap = model.constructAbbreviations || {};
  const { constructs, relationships } = model;
  return (
    <div className="static-diagram static-diagram-generic">
      <p className="static-diagram-hint">Constructs and relationships in the model.</p>
      <div className="static-diagram-generic-grid">
        {constructs.map((name) => {
          const abbrev = abbrevMap[name] || name.slice(0, 12);
          const slug = constructToSlug[name];
          const href = slug ? `${base}constructs/${slug}/` : '#';
          return (
            <a key={name} href={href} className="static-diagram-box static-diagram-box-generic">
              <div className="static-diagram-box-abbrev">{abbrev}</div>
              <div className="static-diagram-box-name">{name}</div>
            </a>
          );
        })}
      </div>
      {relationships.length > 0 && (
        <div className="static-diagram-relationships">
          <h4>Relationships</h4>
          <ul>
            {relationships.map((r, i) => (
              <li key={i}><code>{r.from}</code> → <code>{r.to}</code></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ModelDiagramStatic({ model, constructToSlug = {}, base = '' }: ModelDiagramStaticProps) {
  if (model.diagramType === 'ecm-is') {
    return <EcmIsStatic base={base} constructToSlug={constructToSlug} />;
  }
  return <GenericStatic model={model} base={base} constructToSlug={constructToSlug} />;
}
