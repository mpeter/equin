// The calendar day an event is ON — the one place that decides how to read it.
//
// An all-day event has a calendar date and no instant. It is persisted as UTC
// midnight of that date (`"2026-12-04"` → 2026-12-04T00:00:00Z), so its date
// lives in the UTC fields: read it with local getters and every viewer west of
// UTC sees the day before. A timed event is a real instant and is read in the
// viewer's zone. Every reader that shows or compares an event's day goes
// through here, so the two readings cannot be mixed up at a call site.

export interface CalendarDay {
  year: number;
  /** 0-based, as `Date#getMonth`. */
  month: number;
  day: number;
  /** 0 = Sunday, as `Date#getDay`. */
  weekday: number;
}

/** The calendar day of an event's `startsAt`: UTC fields when all-day, local otherwise. */
export function eventCalendarDay(startsAt: Date, allDay: boolean): CalendarDay {
  return allDay
    ? {
        year: startsAt.getUTCFullYear(),
        month: startsAt.getUTCMonth(),
        day: startsAt.getUTCDate(),
        weekday: startsAt.getUTCDay(),
      }
    : {
        year: startsAt.getFullYear(),
        month: startsAt.getMonth(),
        day: startsAt.getDate(),
        weekday: startsAt.getDay(),
      };
}

/**
 * The start of `now`'s local day, expressed on the same axis as an event's
 * `startsAt`: local midnight for a timed event, UTC midnight of the same
 * calendar date for an all-day one. "Is this event today or later" compares
 * `startsAt` against this.
 */
export function eventDayFloor(now: Date, allDay: boolean): Date {
  if (allDay) {
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}
