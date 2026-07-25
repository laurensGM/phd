import React from 'react';

export interface PipelineStage {
  key: string;
  label: string;
  count: number;
  href: string;
  color: string;
}

interface HomeResearchPipelineProps {
  stages: PipelineStage[];
}

const MIN_BAR_PERCENT = 6;

export default function HomeResearchPipeline({ stages }: HomeResearchPipelineProps) {
  const maxCount = Math.max(...stages.map((s) => s.count), 0);
  if (maxCount === 0) return null;

  const firstCount = stages[0]?.count ?? 0;

  return (
    <section className="home-pipeline-section" aria-label="Research pipeline">
      <div className="home-pipeline-header">
        <h2 className="home-section-title">Research pipeline</h2>
        <p className="home-pipeline-note">
          Raw material narrows into argument: extracted snippets become processed snippets, then claims, then
          contributions.
        </p>
      </div>
      <ol className="home-pipeline-funnel">
        {stages.map((stage, index) => {
          const width = Math.max((stage.count / maxCount) * 100, stage.count > 0 ? MIN_BAR_PERCENT : 2);
          const share = firstCount > 0 ? Math.round((stage.count / firstCount) * 100) : 0;
          return (
            <li key={stage.key} className="home-pipeline-stage">
              <a href={stage.href} className="home-pipeline-link">
                <span className="home-pipeline-label">{stage.label}</span>
                <span className="home-pipeline-track">
                  <span
                    className="home-pipeline-bar"
                    style={{ width: `${width}%`, backgroundColor: stage.color }}
                  >
                    <span className="home-pipeline-count">{stage.count}</span>
                  </span>
                </span>
                <span className="home-pipeline-share">{index === 0 ? '100%' : `${share}%`}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
