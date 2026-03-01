import React, { useState } from 'react';

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
  keyCitations?: { authors: string; title: string; doi?: string }[];
}

interface ModelDiagramStaticProps {
  model: Model;
  constructToSlug?: Record<string, string>;
  base?: string;
}

const ECM_CONSTRUCT_INFO: Record<string, { title: string; text: string }> = {
  prior: {
    title: 'Prior Expectations',
    text: "What users believed the technology would do for them before they started using it. This is a cognitive pre-use state. In agritech, a farmer might expect a weather app to help them decide when to plant. These expectations become the benchmark against which actual experience is judged. Measured via survey items like: 'Before using this product, I expected it to improve my farming decisions.'",
  },
  confirm: {
    title: 'Confirmation',
    text: "The degree to which a user's initial expectations were met after actual use. This is the critical comparison step — the gap between what was expected and what was experienced. High confirmation = expectations were met or exceeded. Low confirmation = disappointment. Example item: 'My experience with this agritech product was better than I expected.' This construct is borrowed directly from Oliver's (1980) Expectation-Confirmation Theory in consumer behavior.",
  },
  useful: {
    title: 'Perceived Usefulness',
    text: "After using the product, how useful does the user now believe it to be? Note this is a POST-adoption assessment, unlike in TAM where it's a pre-adoption belief. In agritech, this might be: 'Using this app helps me get better yields.' Importantly, Confirmation positively influences Perceived Usefulness — when expectations are met, users revise their usefulness perception upward. Perceived Usefulness also has a direct effect on Continuance Intention.",
  },
  satisfy: {
    title: 'Satisfaction',
    text: "The overall affective (emotional) response to the experience of using the technology. It is shaped by both Confirmation (cognitive) and Perceived Usefulness (functional benefit). Satisfaction is the emotional bridge between cognitive assessment and behavioural intention. A farmer who feels the app genuinely helped them and confirmed their expectations will feel satisfied, making them more likely to continue. Measured via: 'Overall, I am satisfied with my experience using this product.'",
  },
  intention: {
    title: 'Continuance Intention',
    text: "The user's stated intention to keep using the technology going forward. This is the primary dependent variable in most ECM-IS studies. It is driven by Satisfaction and directly by Perceived Usefulness. In your agritech research, this is where product discovery could have an upstream influence — if discovery shapes expectations or perceived usefulness, it flows through to continuance intention. Measured via: 'I intend to continue using this agritech product in the future.'",
  },
  behavior: {
    title: 'Continued Use (Actual Behaviour)',
    text: "The actual sustained usage of the technology over time. In many studies, this is proxied by Continuance Intention because measuring actual behaviour requires longitudinal data. However, in agritech contexts with access to usage logs or follow-up surveys, actual behaviour can sometimes be measured directly. The gap between intention and behaviour is also an interesting research space — someone might intend to continue but face infrastructural barriers (connectivity, cost, literacy) common in Sub-Saharan Africa.",
  },
};

function EcmIsDiagram({ base = '', constructToSlug = {} }: { base: string; constructToSlug: Record<string, string> }) {
  const [infoKey, setInfoKey] = useState<string | null>(null);
  const info = infoKey ? ECM_CONSTRUCT_INFO[infoKey] : null;
  const slug = (name: string) => constructToSlug[name];

  return (
    <div className="ecm-diagram-wrap">
      <h2 className="ecm-diagram-title">ECM-IS: Expectation-Confirmation Model of IS Continuance</h2>
      <p className="ecm-diagram-subtitle">Bhattacherjee (2001) · Click any construct to learn more</p>

      <div className="ecm-diagram">
        <div className="ecm-box prior" onClick={() => setInfoKey('prior')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setInfoKey('prior')}>
          <div className="ecm-box-label">CONSTRUCT 1</div>
          <div className="ecm-box-name">Prior Expectations</div>
          <div className="ecm-box-desc">What users expected before use</div>
        </div>

        <div className="ecm-arrow-group">
          <div className="ecm-multi-arrow">
            <div className="ecm-arrow">
              <div className="ecm-arrow-line" />
              <div className="ecm-arrow-label">shapes</div>
            </div>
            <div className="ecm-arrow">
              <div className="ecm-arrow-line" />
              <div className="ecm-arrow-label">compared with</div>
            </div>
          </div>
        </div>

        <div className="ecm-box-stack">
          <a href={slug('Perceived Usefulness') ? `${base}constructs/${slug('Perceived Usefulness')}/` : '#'} className="ecm-box confirm" onClick={(e) => { e.preventDefault(); setInfoKey('useful'); }}>
            <div className="ecm-box-label">CONSTRUCT 2a</div>
            <div className="ecm-box-name">Perceived Usefulness</div>
            <div className="ecm-box-desc">Belief that using the system improves performance</div>
          </a>
          <a href={slug('Confirmation') ? `${base}constructs/${slug('Confirmation')}/` : '#'} className="ecm-box confirm" onClick={(e) => { e.preventDefault(); setInfoKey('confirm'); }}>
            <div className="ecm-box-label">CONSTRUCT 2b</div>
            <div className="ecm-box-name">Confirmation</div>
            <div className="ecm-box-desc">Extent expectations were met by actual experience</div>
          </a>
        </div>

        <div className="ecm-arrow-group">
          <div className="ecm-multi-arrow">
            <div className="ecm-arrow">
              <div className="ecm-arrow-line" />
              <div className="ecm-arrow-label">influences</div>
            </div>
            <div className="ecm-arrow">
              <div className="ecm-arrow-line" />
              <div className="ecm-arrow-label">drives</div>
            </div>
          </div>
        </div>

        <a href={slug('Satisfaction') ? `${base}constructs/${slug('Satisfaction')}/` : '#'} className="ecm-box satisfy" onClick={(e) => { e.preventDefault(); setInfoKey('satisfy'); }}>
          <div className="ecm-box-label">CONSTRUCT 3</div>
          <div className="ecm-box-name">Satisfaction</div>
          <div className="ecm-box-desc">Overall feeling after using the product</div>
        </a>

        <div className="ecm-arrow-group">
          <div className="ecm-arrow">
            <div className="ecm-arrow-line" />
            <div className="ecm-arrow-label">predicts</div>
          </div>
        </div>

        <a href={slug('Continuance Intention') ? `${base}constructs/${slug('Continuance Intention')}/` : '#'} className="ecm-box intention" onClick={(e) => { e.preventDefault(); setInfoKey('intention'); }}>
          <div className="ecm-box-label">CONSTRUCT 4</div>
          <div className="ecm-box-name">Continuance Intention</div>
          <div className="ecm-box-desc">Intention to keep using the technology</div>
        </a>

        <div className="ecm-arrow-group">
          <div className="ecm-arrow">
            <div className="ecm-arrow-line" />
            <div className="ecm-arrow-label">leads to</div>
          </div>
        </div>

        <a href={slug('Continued Use') ? `${base}constructs/${slug('Continued Use')}/` : '#'} className="ecm-box behavior" onClick={(e) => { e.preventDefault(); setInfoKey('behavior'); }}>
          <div className="ecm-box-label">CONSTRUCT 5</div>
          <div className="ecm-box-name">Continued Use</div>
          <div className="ecm-box-desc">Actual sustained usage behaviour</div>
        </a>
      </div>

      <div className="ecm-note-line">
        ↳ Note: <strong>Perceived Usefulness</strong> also has a direct path to <strong>Continuance Intention</strong> (bypassing satisfaction)
      </div>

      <div className="ecm-tooltip-area" id="ecm-infoBox">
        {info ? (
          <>
            <h3>{info.title}</h3>
            <p>{info.text}</p>
          </>
        ) : (
          <p className="ecm-tooltip-default">👆 Click a construct above to see details, measurement examples, and its role in the model.</p>
        )}
      </div>

      <div className="ecm-legend">
        <div className="ecm-legend-item"><span className="ecm-legend-dot prior" /> Pre-use cognitive state</div>
        <div className="ecm-legend-item"><span className="ecm-legend-dot confirm" /> Post-use cognition</div>
        <div className="ecm-legend-item"><span className="ecm-legend-dot satisfy" /> Affective response</div>
        <div className="ecm-legend-item"><span className="ecm-legend-dot intention" /> Behavioural intention</div>
        <div className="ecm-legend-item"><span className="ecm-legend-dot behavior" /> Actual behaviour</div>
      </div>

      <p className="ecm-source-note">
        Source: Bhattacherjee, A. (2001). Understanding information systems continuance: An expectation-confirmation model. <em>MIS Quarterly, 25</em>(3), 351–370.
      </p>
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
    return <EcmIsDiagram base={base} constructToSlug={constructToSlug} />;
  }
  return <GenericStatic model={model} base={base} constructToSlug={constructToSlug} />;
}
