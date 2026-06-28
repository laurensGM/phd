import React from 'react';
import {
  type ChartSlice,
  conicGradientFromSlices,
  tagAssignmentTotal,
} from '../lib/snippetTagDistribution';

interface SnippetDistributionChartProps {
  title: string;
  totalSnippets: number;
  slices: ChartSlice[];
  emptyMessage: string;
}

export default function SnippetDistributionChart({
  title,
  totalSnippets,
  slices,
  emptyMessage,
}: SnippetDistributionChartProps) {
  const tagTotal = tagAssignmentTotal(slices);

  if (slices.length === 0) {
    return (
      <div className="home-snippet-chart-card">
        <h3 className="home-snippet-chart-title">{title}</h3>
        <p className="home-snippet-chart-empty">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="home-snippet-chart-card">
      <h3 className="home-snippet-chart-title">{title}</h3>
      <p className="home-snippet-chart-subtitle">
        {tagTotal} tag{tagTotal !== 1 ? 's' : ''} across {totalSnippets} snippet
        {totalSnippets !== 1 ? 's' : ''}
      </p>
      <div className="home-snippet-chart-body">
        <div
          className="home-snippet-donut"
          style={{ background: conicGradientFromSlices(slices) }}
          role="img"
          aria-label={`${title}: ${slices.map((s) => `${s.label} ${s.count}`).join(', ')}`}
        >
          <div className="home-snippet-donut-hole">
            <span className="home-snippet-donut-value">{totalSnippets}</span>
            <span className="home-snippet-donut-label">snippets</span>
          </div>
        </div>
        <ul className="home-snippet-chart-legend">
          {slices.map((slice) => (
            <li key={slice.label} className="home-snippet-chart-legend-item">
              <span
                className="home-snippet-chart-legend-swatch"
                style={{ backgroundColor: slice.color }}
              />
              <span className="home-snippet-chart-legend-label">{slice.label}</span>
              <span className="home-snippet-chart-legend-count">{slice.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
