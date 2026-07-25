import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { loadRecentActivity } from '../lib/fetchRecentActivity';
import {
  activityTypeLabel,
  relativeActivityTime,
  type ActivityItem,
} from '../lib/recentActivity';

interface RecentActivityFeedProps {
  limit: number;
  seeMoreHref?: string;
  note?: string;
  /** When true, omit outer card chrome (page already provides layout). */
  embedded?: boolean;
}

export default function RecentActivityFeed({
  limit,
  seeMoreHref,
  note = 'Latest adds and updates across the PhD Manager.',
  embedded = false,
}: RecentActivityFeedProps) {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let hasLoaded = false;

    const run = async (quiet?: boolean) => {
      if (cancelled) return;
      if (!quiet) setLoading(true);
      try {
        const next = await loadRecentActivity(base, limit);
        if (!cancelled) setItems(next);
      } finally {
        if (!cancelled) {
          setLoading(false);
          hasLoaded = true;
        }
      }
    };

    void run();

    const onVisible = () => {
      if (document.visibilityState === 'visible' && hasLoaded) void run(true);
    };
    const onFocus = () => {
      if (hasLoaded) void run(true);
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    let unsub: (() => void) | undefined;
    if (isSupabaseConfigured() && supabase) {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        // Re-fetch once session is ready if the first pass ran before JWT was available.
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          void run(hasLoaded);
        }
      });
      unsub = () => data.subscription.unsubscribe();
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      unsub?.();
    };
  }, [base, limit]);

  const body = (
    <>
      {!embedded && (
        <div className="home-activity-header">
          <h2 className="home-section-title">Recent activity</h2>
          {note ? <p className="home-activity-note">{note}</p> : null}
        </div>
      )}
      {loading ? (
        <p className="home-activity-empty">Loading activity…</p>
      ) : items.length === 0 ? (
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
      {seeMoreHref && !loading && items.length > 0 && (
        <div className="home-activity-footer">
          <a href={seeMoreHref} className="home-activity-see-more">
            See more →
          </a>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="home-activity-embedded">{body}</div>;
  }

  return (
    <section className="home-activity-section" aria-label="Recent activity">
      {body}
    </section>
  );
}
