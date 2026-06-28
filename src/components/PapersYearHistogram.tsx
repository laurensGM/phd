import React, { useMemo } from 'react';
import { type YearBin, yAxisTicks } from '../lib/paperYearHistogram';

interface PapersYearHistogramProps {
  bins: YearBin[];
  withoutYear: number;
  totalPapers: number;
}

export default function PapersYearHistogram({
  bins,
  withoutYear,
  totalPapers,
}: PapersYearHistogramProps) {
  const maxCount = useMemo(() => Math.max(0, ...bins.map((b) => b.count)), [bins]);
  const ticks = useMemo(() => yAxisTicks(maxCount), [maxCount]);
  const yMax = ticks[ticks.length - 1] ?? maxCount;

  if (bins.length === 0) {
    return (
      <section className="home-papers-histogram-section">
        <h2 className="home-section-title">Papers by publication year</h2>
        <p className="home-papers-histogram-empty">
          No papers with a publication year yet.
          {withoutYear > 0 && ` ${withoutYear} paper${withoutYear !== 1 ? 's' : ''} missing a year.`}
        </p>
      </section>
    );
  }

  return (
    <section className="home-papers-histogram-section">
      <div className="home-papers-histogram-header">
        <h2 className="home-section-title">Papers by publication year</h2>
        <p className="home-papers-histogram-subtitle">
          {totalPapers} paper{totalPapers !== 1 ? 's' : ''} saved
          {withoutYear > 0
            ? ` · ${withoutYear} without year not shown`
            : ''}
        </p>
      </div>
      <div className="home-papers-histogram-wrap">
        <div className="home-papers-histogram-y-label" aria-hidden>
          Papers saved
        </div>
        <div className="home-papers-histogram-chart">
          <div className="home-papers-histogram-y-axis">
            {[...ticks].reverse().map((tick) => (
              <span key={tick} className="home-papers-histogram-y-tick">
                {tick}
              </span>
            ))}
          </div>
          <div className="home-papers-histogram-plot">
            <div className="home-papers-histogram-grid">
              {ticks.map((tick) => (
                <div
                  key={tick}
                  className="home-papers-histogram-gridline"
                  style={{ bottom: `${yMax > 0 ? (tick / yMax) * 100 : 0}%` }}
                />
              ))}
            </div>
            <div className="home-papers-histogram-bars">
              {bins.map((bin) => (
                <div key={bin.year} className="home-papers-histogram-bar-col">
                  <div className="home-papers-histogram-bar-stack">
                    <span
                      className={`home-papers-histogram-bar ${bin.count === 0 ? 'home-papers-histogram-bar-empty' : ''}`}
                      style={{ height: `${yMax > 0 && bin.count > 0 ? (bin.count / yMax) * 100 : 0}%` }}
                      title={`${bin.year}: ${bin.count} paper${bin.count !== 1 ? 's' : ''}`}
                    >
                      {bin.count > 0 && (
                        <span className="home-papers-histogram-bar-value">{bin.count}</span>
                      )}
                    </span>
                  </div>
                  <span className="home-papers-histogram-x-label">{bin.year}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="home-papers-histogram-x-axis-label">Publication year</div>
      </div>
    </section>
  );
}
