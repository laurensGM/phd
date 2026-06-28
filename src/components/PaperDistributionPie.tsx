import React from 'react';
import { type ChartSlice } from '../lib/snippetTagDistribution';
import { conicGradientFromSlices, sliceTotal } from '../lib/paperDistribution';

interface PaperDistributionPieProps {
  title: string;
  totalPapers: number;
  slices: ChartSlice[];
  emptyMessage: string;
  subtitle?: string;
}

export default function PaperDistributionPie({
  title,
  totalPapers,
  slices,
  emptyMessage,
  subtitle,
}: PaperDistributionPieProps) {
  const chartTotal = sliceTotal(slices);

  if (slices.length === 0) {
    return (
      <div className="home-paper-pie-card">
        <h3 className="home-paper-pie-title">{title}</h3>
        <p className="home-paper-pie-empty">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="home-paper-pie-card">
      <h3 className="home-paper-pie-title">{title}</h3>
      {subtitle && <p className="home-paper-pie-subtitle">{subtitle}</p>}
      <div className="home-paper-pie-body">
        <div
          className="home-paper-pie-chart"
          style={{ background: conicGradientFromSlices(slices) }}
          role="img"
          aria-label={`${title}: ${slices.map((s) => `${s.label} ${s.count}`).join(', ')}`}
        >
          <div className="home-paper-pie-hole">
            <span className="home-paper-pie-value">{totalPapers}</span>
            <span className="home-paper-pie-label">papers</span>
          </div>
        </div>
        <ul className="home-paper-pie-legend">
          {slices.map((slice) => (
            <li key={slice.label} className="home-paper-pie-legend-item">
              <span
                className="home-paper-pie-legend-swatch"
                style={{ backgroundColor: slice.color }}
              />
              <span className="home-paper-pie-legend-label" title={slice.label}>
                {slice.label}
              </span>
              <span className="home-paper-pie-legend-count">
                {slice.count}
                <span className="home-paper-pie-legend-pct">
                  {chartTotal > 0 ? Math.round((slice.count / chartTotal) * 100) : 0}%
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
