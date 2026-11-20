import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eventCalendarDay, eventDayFloor } from "./calendar-day";

describe("event calendar day", () => {
  // Restored to the zone in force, never by deleting `TZ`: bun re-resolves an
  // unset `TZ` to the host's zone, not to the one the process started in, and
  // every later suite in this process would inherit it.
  let zone = "";
  beforeAll(() => {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    process.env.TZ = "America/New_York";
  });
  afterAll(() => {
    process.env.TZ = zone;
  });

  test("an all-day event is read in UTC", () => {
    expect(eventCalendarDay(new Date("2026-12-04T00:00:00Z"), true)).toEqual({
      year: 2026,
      month: 11,
      day: 4,
      weekday: 5,
    });
  });

  test("a timed event is read in the viewer's zone", () => {
    expect(eventCalendarDay(new Date("2026-12-04T00:00:00Z"), false)).toEqual({
      year: 2026,
      month: 11,
      day: 3,
      weekday: 4,
    });
  });

  test("the day floor is local midnight for timed, UTC midnight of the local date for all-day", () => {
    const now = new Date("2026-12-04T15:30:00Z"); // 10:30 on 4 Dec in New York
    expect(eventDayFloor(now, false).toISOString()).toBe(
      "2026-12-04T05:00:00.000Z",
    );
    expect(eventDayFloor(now, true).toISOString()).toBe(
      "2026-12-04T00:00:00.000Z",
    );
  });
});
