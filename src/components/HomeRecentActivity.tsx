import React from 'react';
import {
  activityTypeLabel,
  relativeActivityTime,
  type ActivityItem,
} from '../lib/recentActivity';

interface HomeRecentActivityProps {
  items: ActivityItem[];
}

export default function HomeRecentActivity({ items }: HomeRecentActivityProps) {
  return (
    <section className="home-activity-section" aria-label="Recent activity">
      <div className="home-activity-header">
        <h2 className="home-section-title">Recent activity</h2>
        <p className="home-activity-note">Latest adds and updates across the PhD Manager.</p>
      </div>
      {items.length === 0 ? (
        <p className="home-activity-empty">No recent activity yet.</p>
      ) : (
        <ul className="home-activity-list">
          {items.map((item) => (
            <li key={item.id} className="home-activity-item">
              <a href={item.href} className="home-activity-link">
                <span className={`home-activity-type home-activity-type--${item.type}`}>
                  {activityTypeLabel(item.type)}
                </span>
                <span className="home-activity-body">
                  <span className="home-activity-title">{item.title}</span>
                  {item.detail && <span className="home-activity-detail">{item.detail}</span>}
                </span>
                <time className="home-activity-time" dateTime={item.at}>
                  {relativeActivityTime(item.at)}
                </time>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
