import React, { useState } from 'react';

const CONSTRUCT_INFO: Record<string, { title: string; text: string }> = {
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

function Box({
  id,
  label,
  name,
  desc,
  variant,
  onClick,
}: {
  id: string;
  label: string;
  name: string;
  desc: string;
  variant: 'prior' | 'confirm' | 'satisfy' | 'intention' | 'behavior';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`ecm-box ecm-box-${variant}`}
      onClick={onClick}
      aria-label={`Show details for ${name}`}
    >
      <div className="ecm-box-label">{label}</div>
      <div className="ecm-box-name">{name}</div>
      <div className="ecm-box-desc">{desc}</div>
    </button>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <div className="ecm-arrow">
      <div className="ecm-arrow-line" />
      {label && <div className="ecm-arrow-label">{label}</div>}
    </div>
  );
}

export default function EcmIsDiagram() {
  const [selected, setSelected] = useState<string | null>(null);
  const info = selected ? CONSTRUCT_INFO[selected] : null;

  return (
    <div className="ecm-is-diagram">
      <div className="ecm-flow">
        <Box
          id="prior"
          label="CONSTRUCT 1"
          name="Prior Expectations"
          desc="What users expected before use"
          variant="prior"
          onClick={() => setSelected('prior')}
        />
        <div className="ecm-arrow-group">
          <Arrow label="shapes" />
          <Arrow label="compared with" />
        </div>
        <div className="ecm-stack">
          <Box
            id="useful"
            label="CONSTRUCT 2a"
            name="Perceived Usefulness"
            desc="Belief that using the system improves performance"
            variant="confirm"
            onClick={() => setSelected('useful')}
          />
          <Box
            id="confirm"
            label="CONSTRUCT 2b"
            name="Confirmation"
            desc="Extent expectations were met by actual experience"
            variant="confirm"
            onClick={() => setSelected('confirm')}
          />
        </div>
        <div className="ecm-arrow-group">
          <Arrow label="influences" />
          <Arrow label="drives" />
        </div>
        <Box
          id="satisfy"
          label="CONSTRUCT 3"
          name="Satisfaction"
          desc="Overall feeling after using the product"
          variant="satisfy"
          onClick={() => setSelected('satisfy')}
        />
        <Arrow label="predicts" />
        <Box
          id="intention"
          label="CONSTRUCT 4"
          name="Continuance Intention"
          desc="Intention to keep using the technology"
          variant="intention"
          onClick={() => setSelected('intention')}
        />
        <Arrow label="leads to" />
        <Box
          id="behavior"
          label="CONSTRUCT 5"
          name="Continued Use"
          desc="Actual sustained usage behaviour"
          variant="behavior"
          onClick={() => setSelected('behavior')}
        />
      </div>

      <p className="ecm-note">
        Note: <strong>Perceived Usefulness</strong> also has a direct path to{' '}
        <strong>Continuance Intention</strong> (bypassing satisfaction).
      </p>

      <div className="ecm-info-panel">
        {info ? (
          <>
            <h3>{info.title}</h3>
            <p>{info.text}</p>
          </>
        ) : (
          <p className="ecm-info-default">
            Click a construct above to see details, measurement examples, and its role in the model.
          </p>
        )}
      </div>

      <div className="ecm-legend">
        <span><span className="ecm-legend-dot prior" /> Pre-use cognitive state</span>
        <span><span className="ecm-legend-dot confirm" /> Post-use cognition</span>
        <span><span className="ecm-legend-dot satisfy" /> Affective response</span>
        <span><span className="ecm-legend-dot intention" /> Behavioural intention</span>
        <span><span className="ecm-legend-dot behavior" /> Actual behaviour</span>
      </div>
    </div>
  );
}
