import React from 'react';
import { type ChartSlice, tagAssignmentTotal } from '../lib/snippetTagDistribution';

interface SnippetDistributionChartProps {
  title: string;
  totalSnippets: number;
  slices: ChartSlice[];
  emptyMessage: string;
  exploredCount?: number;
  exploredLabel?: string;
  exploredHref?: string;
}

function ExploredBadge({
  count,
  label,
  href,
}: {
  count: number;
  label: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className="home-widget-total-value">{count}</span>
      <span className="home-widget-total-label">{label}</span>
    </>
  );
  return href ? (
    <a href={href} className="home-widget-total home-widget-total--sm">
      {inner}
    </a>
  ) : (
    <span className="home-widget-total home-widget-total--sm">{inner}</span>
  );
}

export default function SnippetDistributionChart({
  title,
  totalSnippets,
  slices,
  emptyMessage,
  exploredCount,
  exploredLabel,
  exploredHref,
}: SnippetDistributionChartProps) {
  const tagTotal = tagAssignmentTotal(slices);
  const maxCount = slices.length > 0 ? Math.max(...slices.map((s) => s.count)) : 0;
  const badge =
    exploredCount !== undefined && exploredLabel ? (
      <ExploredBadge count={exploredCount} label={exploredLabel} href={exploredHref} />
    ) : null;

  if (slices.length === 0) {
    return (
      <div className="home-snippet-chart-card">
        <div className="home-snippet-chart-head">
          <h3 className="home-snippet-chart-title">{title}</h3>
          {badge}
        </div>
        <p className="home-snippet-chart-empty">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="home-snippet-chart-card">
      <div className="home-snippet-chart-head">
        <div>
          <h3 className="home-snippet-chart-title">{title}</h3>
          <p className="home-snippet-chart-subtitle">
            {totalSnippets} snippet{totalSnippets !== 1 ? 's' : ''} · {tagTotal} tag
            {tagTotal !== 1 ? 's' : ''}
          </p>
        </div>
        {badge}
      </div>
      <ul className="home-snippet-chart-bars" role="list">
        {slices.map((slice) => (
          <li key={slice.label} className="home-snippet-chart-bar-row">
            <span className="home-snippet-chart-bar-label" title={slice.label}>
              {slice.label}
            </span>
            <span className="home-snippet-chart-bar-track">
              <span
                className="home-snippet-chart-bar-fill"
                style={{
                  width: `${maxCount > 0 ? (slice.count / maxCount) * 100 : 0}%`,
                  backgroundColor: slice.color,
                }}
              />
            </span>
            <span className="home-snippet-chart-bar-count">{slice.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
