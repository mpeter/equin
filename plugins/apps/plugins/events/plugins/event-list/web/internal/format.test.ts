import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  EventDateSchema,
  eventDateProjection,
} from "@plugins/apps/plugins/events/plugins/event-date/core";
import { formatEventWhen, formatPlace, urlHost } from "./format";

/** Local-calendar construction (never UTC) — the formatter reads local getters. */
const at = (iso: string): Date => new Date(iso);
const NOW = at("2026-08-03T12:00:00");

describe("formatEventWhen", () => {
  test("timed event in the current year", () => {
    expect(formatEventWhen(at("2026-08-13T21:00:00"), false, NOW)).toBe(
      "Thu 13 Aug · 21:00",
    );
  });

  test("all-day event drops the time", () => {
    expect(formatEventWhen(at("2026-08-13T00:00:00"), true, NOW)).toBe(
      "Thu 13 Aug",
    );
  });

  test("another year is spelled out", () => {
    expect(formatEventWhen(at("2027-01-02T09:05:00"), false, NOW)).toBe(
      "Sat 2 Jan 2027 · 09:05",
    );
  });

  test("an invalid date formats to the empty string, never 'NaN'", () => {
    expect(formatEventWhen(new Date("nope"), false, NOW)).toBe("");
  });
});

describe("formatPlace", () => {
  test("both, one, or neither", () => {
    expect(formatPlace("Fitzroy", "Paris")).toBe("Fitzroy · Paris");
    expect(formatPlace("Fitzroy", null)).toBe("Fitzroy");
    expect(formatPlace(null, "Paris")).toBe("Paris");
    expect(formatPlace(null, null)).toBe(null);
    expect(formatPlace("  ", null)).toBe(null);
  });
});

describe("urlHost", () => {
  test("strips the scheme, path and a leading www.", () => {
    expect(urlHost("https://www.fitzroy-paris.com/soirees")).toBe(
      "fitzroy-paris.com",
    );
    expect(urlHost("https://shotgun.live/events/1")).toBe("shotgun.live");
  });

  test("a non-URL is not a host", () => {
    expect(urlHost("not a url")).toBe(null);
    expect(urlHost("")).toBe(null);
  });
});

describe("formatEventWhen west of UTC", () => {
  const zone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "America/New_York";
  });
  afterAll(() => {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  });

  const NOW_NY = new Date("2026-11-19T17:00:00Z");
  const shown = (input: object): string => {
    const p = eventDateProjection(EventDateSchema.parse(input));
    return formatEventWhen(p.startsAt, p.allDay, NOW_NY);
  };

  test("a date-only all-day import shows its source date, not the day before", () => {
    expect(shown({ kind: "once", startsAt: "2026-12-04", allDay: true })).toBe(
      "Fri 4 Dec",
    );
  });

  test("a stored all-day row read back from jsonb keeps its date", () => {
    expect(
      shown({
        kind: "once",
        startsAt: "2026-12-04T00:00:00.000Z",
        allDay: true,
      }),
    ).toBe("Fri 4 Dec");
  });

  test("a recurring all-day anchor keeps its date", () => {
    expect(
      shown({
        kind: "recurring",
        startsAt: "2026-12-04",
        allDay: true,
        rule: { freq: "weekly" },
      }),
    ).toBe("Fri 4 Dec");
  });

  test("an all-day event in another year spells the source year", () => {
    expect(shown({ kind: "once", startsAt: "2027-01-01", allDay: true })).toBe(
      "Fri 1 Jan 2027",
    );
  });

  test("a timed event still shows local time", () => {
    // 2026-12-04T00:00Z is 19:00 on 3 Dec in New York.
    expect(
      shown({ kind: "once", startsAt: "2026-12-04T00:00:00Z", allDay: false }),
    ).toBe("Thu 3 Dec · 19:00");
  });
});
