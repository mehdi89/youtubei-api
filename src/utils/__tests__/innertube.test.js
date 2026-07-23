// youtubei.js is ESM-only (import.meta); stub it so jest can load the util module.
jest.mock('youtubei.js', () => ({
  Innertube: { create: jest.fn() },
  Log: { setLevel: jest.fn(), Level: { NONE: 0 } },
}));

import { normalizeLockup, isRecentlyPublished } from '../innertube';

const lockup = ({ rows, badgeText = '3:51:47', badgeStyle = 'THUMBNAIL_OVERLAY_BADGE_STYLE_DEFAULT' }) => ({
  type: 'LockupView',
  content_id: 'pv1TUJSEM2k',
  content_type: 'VIDEO',
  content_image: {
    overlays: [{ badges: [{ type: 'ThumbnailBadgeView', text: badgeText, badge_style: badgeStyle }] }],
  },
  metadata: {
    title: { text: 'Some Video Title' },
    metadata: {
      metadata_rows: rows.map(parts => ({ metadata_parts: parts.map(text => ({ text: { text } })) })),
    },
  },
});

describe('normalizeLockup', () => {
  it('passes non-LockupView items through untouched', () => {
    const legacy = { type: 'Video', id: 'abc', title: { text: 'x' } };
    expect(normalizeLockup(legacy)).toBe(legacy);
    expect(normalizeLockup(undefined)).toBe(undefined);
  });

  it('maps a channel lockup (views + date, no author row)', () => {
    const out = normalizeLockup(lockup({ rows: [['789K views', '3 weeks ago']] }));

    expect(out.id).toBe('pv1TUJSEM2k');
    expect(out.title.text).toBe('Some Video Title');
    expect(out.duration).toBe('3:51:47');
    expect(out.view_count).toBe('789K views');
    expect(out.published.text).toBe('3 weeks ago');
    expect(out.is_live).toBe(false);
    expect(out.author).toBeNull();
  });

  it('maps a playlist lockup (author row + views + date)', () => {
    const out = normalizeLockup(lockup({ rows: [['Lex Fridman'], ['789K views', '3 weeks ago']] }));

    expect(out.author).toEqual({ name: 'Lex Fridman', id: null });
    expect(out.view_count).toBe('789K views');
    expect(out.published.text).toBe('3 weeks ago');
  });

  it('flags live items, reads concurrent viewers, leaves duration empty', () => {
    const out = normalizeLockup(
      lockup({ rows: [['14K watching']], badgeText: 'LIVE', badgeStyle: 'THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE' })
    );

    expect(out.is_live).toBe(true);
    expect(out.duration).toBeNull();
    expect(out.view_count).toBe('14K watching');
    expect(out.author).toBeNull(); // must not mistake the viewer count for a channel name
  });

  it('maps upcoming streams (waiting count + scheduled date)', () => {
    const out = normalizeLockup(
      lockup({ rows: [['1 waiting', 'Scheduled for 7/24/26, 3:00 AM']], badgeText: 'Upcoming' })
    );

    expect(out.is_live).toBe(false);
    expect(out.view_count).toBe('1 waiting');
    expect(out.published.text).toBe('Scheduled for 7/24/26, 3:00 AM');
    expect(out.author).toBeNull();
  });

  it('maps past streams ("Streamed N ago")', () => {
    const out = normalizeLockup(lockup({ rows: [['433K views', 'Streamed 2 years ago']], badgeText: '32:58' }));

    expect(out.duration).toBe('32:58');
    expect(out.view_count).toBe('433K views');
    expect(out.published.text).toBe('Streamed 2 years ago');
    expect(out.author).toBeNull();
  });

  it('does not mistake "No views" on a brand-new upload for a channel name', () => {
    const out = normalizeLockup(lockup({ rows: [['Lex Fridman'], ['No views', '2 minutes ago']] }));

    expect(out.view_count).toBe('No views');
    expect(out.author).toEqual({ name: 'Lex Fridman', id: null });
  });

  it('survives a lockup with no metadata rows or badges', () => {
    const out = normalizeLockup({ type: 'LockupView', content_id: 'xyz' });

    expect(out.id).toBe('xyz');
    expect(out.title.text).toBeNull();
    expect(out.duration).toBeNull();
    expect(out.view_count).toBeNull();
    expect(out.published.text).toBeNull();
    expect(out.author).toBeNull();
  });
});

describe('isRecentlyPublished', () => {
  const hoursAgoIso = h => new Date(Date.now() - h * 3.6e6).toISOString();
  const vod = publishedText => ({ basic_info: {}, primary_info: { published: { text: publishedText } } });

  it('returns false for missing info', () => {
    expect(isRecentlyPublished(null)).toBe(false);
    expect(isRecentlyPublished(undefined)).toBe(false);
  });

  it('always retries a live or upcoming stream', () => {
    expect(isRecentlyPublished({ basic_info: { is_live: true } })).toBe(true);
    expect(isRecentlyPublished({ basic_info: { is_upcoming: true } })).toBe(true);
  });

  it('retries a just-ended live stream, not one ended over the window', () => {
    expect(isRecentlyPublished({ basic_info: { end_timestamp: hoursAgoIso(4) } })).toBe(true);
    expect(isRecentlyPublished({ basic_info: { end_timestamp: hoursAgoIso(40) } })).toBe(false);
  });

  it('retries VOD with a recent relative publish string', () => {
    expect(isRecentlyPublished(vod('3 hours ago'))).toBe(true);
    expect(isRecentlyPublished(vod('42 minutes ago'))).toBe(true);
    expect(isRecentlyPublished(vod('1 day ago'))).toBe(true);
    expect(isRecentlyPublished(vod('5 days ago'))).toBe(false);
  });

  it('retries VOD published today/yesterday by absolute date, not a week ago', () => {
    const day = ms => new Date(Date.now() - ms).toDateString(); // "Fri Jul 24 2026" — date only
    expect(isRecentlyPublished(vod(day(0)))).toBe(true);              // today
    expect(isRecentlyPublished(vod(day(24 * 3.6e6)))).toBe(true);      // ~1 day ago
    expect(isRecentlyPublished(vod(day(7 * 24 * 3.6e6)))).toBe(false); // a week ago
  });

  it('does not treat an unparseable publish string as recent', () => {
    expect(isRecentlyPublished(vod(''))).toBe(false);
    expect(isRecentlyPublished(vod('sometime'))).toBe(false);
  });
});
