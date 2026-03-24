import type { SessionListItem } from '../types/session';

export interface SessionSection {
  title: string;
  data: SessionListItem[];
}

export function groupSessionsByDate(sessions: SessionListItem[]): SessionSection[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const today: SessionListItem[] = [];
  const thisWeek: SessionListItem[] = [];
  const earlier: SessionListItem[] = [];

  for (const s of sessions) {
    const created = new Date(s.createdAt);
    if (created >= todayStart) {
      today.push(s);
    } else if (created >= weekStart) {
      thisWeek.push(s);
    } else {
      earlier.push(s);
    }
  }

  const sections: SessionSection[] = [];
  if (today.length > 0) sections.push({ title: 'Today', data: today });
  if (thisWeek.length > 0) sections.push({ title: 'This Week', data: thisWeek });
  if (earlier.length > 0) sections.push({ title: 'Earlier', data: earlier });
  return sections;
}
