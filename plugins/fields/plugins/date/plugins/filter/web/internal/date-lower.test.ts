import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
  clause,
  matchesFilter,
  type Filterable,
} from "@plugins/network/plugins/live/plugins/filter/core";
import {
  lowersToMatch,
  testField,
} from "@plugins/primitives/plugins/data-view/web/testing";
import type {
  FieldDef,
  FilterFieldValue,
} from "@plugins/primitives/plugins/data-view/core";
import { withinRange } from "../../core";
import { dateLower } from "./date-lower";

// Use noon timestamps so local start-of-day truncation is unambiguous.
const jan10 = new Date("2026-01-10T12:00:00");
const jan15 = new Date("2026-01-15T12:00:00");
const jan20 = new Date("2026-01-20T12:00:00");
// The pinned clock relative anchors resolve against: 2026-01-15, noon local.
const NOW = jan15.getTime();

const keeps = (
  op: keyof typeof dateLower,
  operand: unknown,
  value: FilterFieldValue,
) => lowersToMatch({ lower: dateLower[op] }, "instant", operand, value, NOW);

/** A local day offset from the pinned `NOW`, at `hour`. */
function daysFromNow(n: number, hour = 12): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

describe("date operators lowered", () => {
  it("is (same day)", () => {
    expect(keeps("is", "2026-01-15", jan15)).toBe(true);
    expect(keeps("is", "2026-01-15", jan10)).toBe(false);
    expect(keeps("is", "", jan15)).toBe(true); // empty operand → keep
  });

  it("is covers the whole local day, both edges", () => {
    const start = new Date("2026-01-15T00:00:00");
    const end = new Date("2026-01-15T23:59:59.999");
    const next = new Date("2026-01-16T00:00:00");
    expect(keeps("is", "2026-01-15", start)).toBe(true);
    expect(keeps("is", "2026-01-15", end)).toBe(true);
    expect(keeps("is", "2026-01-15", next)).toBe(false);
  });

  it("is-before / is-after (day-granular, exclusive)", () => {
    expect(keeps("is-before", "2026-01-15", jan10)).toBe(true);
    expect(keeps("is-before", "2026-01-15", jan15)).toBe(false);
    expect(keeps("is-after", "2026-01-15", jan20)).toBe(true);
    expect(keeps("is-after", "2026-01-15", jan15)).toBe(false);
  });

  it("is-on-or-before / is-on-or-after (inclusive)", () => {
    expect(keeps("is-on-or-before", "2026-01-15", jan15)).toBe(true);
    expect(keeps("is-on-or-before", "2026-01-15", jan20)).toBe(false);
    expect(keeps("is-on-or-after", "2026-01-15", jan15)).toBe(true);
    expect(keeps("is-on-or-after", "2026-01-15", jan10)).toBe(false);
  });

  it("is-between (inclusive, open bounds)", () => {
    const between = (operand: unknown, value: Date) =>
      keeps("is-between", operand, value);
    expect(between({ from: "2026-01-10", to: "2026-01-20" }, jan15)).toBe(true);
    expect(between({ from: "2026-01-10", to: "2026-01-20" }, jan10)).toBe(true);
    expect(between({ from: "2026-01-10", to: "2026-01-20" }, jan20)).toBe(true);
    expect(between({ from: "2026-01-16", to: "2026-01-20" }, jan15)).toBe(
      false,
    );
    expect(between({ from: "2026-01-12" }, jan15)).toBe(true);
    expect(between({ to: "2026-01-12" }, jan15)).toBe(false);
    expect(between({}, jan15)).toBe(true); // no bounds → keep
    expect(
      dateLower["is-between"](
        {},
        { column: "at", field: testField("at"), now: NOW },
      ),
    ).toBeUndefined();
  });

  it("non-date field → drop (when operand present)", () => {
    expect(keeps("is", "2026-01-15", null)).toBe(false);
    expect(keeps("is-before", "2026-01-15", undefined)).toBe(false);
    expect(keeps("is", "2026-01-15", "not a date")).toBe(false);
  });

  it("accepts epoch-ms and ISO-string field values (the adapter)", () => {
    expect(keeps("is", "2026-01-15", jan15.getTime())).toBe(true);
    expect(keeps("is", "2026-01-15", jan15.toISOString())).toBe(true);
  });

  it("is-empty / is-not-empty", () => {
    expect(keeps("is-empty", undefined, null)).toBe(true);
    expect(keeps("is-empty", undefined, jan15)).toBe(false);
    expect(keeps("is-not-empty", undefined, jan15)).toBe(true);
    expect(keeps("is-not-empty", undefined, undefined)).toBe(false);
  });

  it("accepts {kind:'date'} and {kind:'relative'} anchors", () => {
    // Absolute anchor resolves like a bare string.
    expect(keeps("is", { kind: "date", iso: "2026-01-15" }, jan15)).toBe(true);
    expect(keeps("is-before", { kind: "date", iso: "2026-01-15" }, jan10)).toBe(
      true,
    );
    // Relative "Today" resolves against the pinned clock.
    const today = { kind: "relative", unit: "day", amount: 0 };
    expect(keeps("is-before", today, jan10)).toBe(true);
    expect(keeps("is", today, jan15)).toBe(true);
    expect(
      keeps("is", { kind: "relative", unit: "day", amount: -5 }, jan10),
    ).toBe(true);
    // is-between accepts mixed absolute + relative bounds.
    expect(
      keeps(
        "is-between",
        { from: "2026-01-10", to: { kind: "date", iso: "2026-01-20" } },
        jan15,
      ),
    ).toBe(true);
  });

  it("reads the clock only for a relative anchor", () => {
    let reads = 0;
    const ctx = {
      column: "at",
      field: testField("at"),
      get now() {
        reads += 1;
        return NOW;
      },
    };
    dateLower.is("2026-01-15", ctx);
    dateLower["is-between"]({ from: { kind: "date", iso: "2026-01-10" } }, ctx);
    dateLower["is-within-past"]({ unit: "week" }, ctx); // incomplete
    expect(reads).toBe(0);
    dateLower.is({ kind: "relative", unit: "day", amount: 0 }, ctx);
    dateLower["is-within-past"]({ unit: "week", amount: 1 }, ctx);
    expect(reads).toBe(2);
  });
});

describe("withinRange (pinned now)", () => {
  const dayMs = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  it("past window is [today - N, today]", () => {
    expect(withinRange({ unit: "week", amount: 1 }, "past", NOW)).toEqual([
      dayMs("2026-01-08"),
      dayMs("2026-01-15"),
    ]);
    expect(withinRange({ unit: "day", amount: 3 }, "past", NOW)).toEqual([
      dayMs("2026-01-12"),
      dayMs("2026-01-15"),
    ]);
  });

  it("next window is [today, today + N]", () => {
    expect(withinRange({ unit: "week", amount: 2 }, "next", NOW)).toEqual([
      dayMs("2026-01-15"),
      dayMs("2026-01-29"),
    ]);
  });

  it("missing / non-positive operand → null (incomplete)", () => {
    expect(withinRange(undefined, "past", NOW)).toBe(null);
    expect(withinRange({}, "past", NOW)).toBe(null);
    expect(withinRange({ unit: "week", amount: 0 }, "past", NOW)).toBe(null);
  });
});

describe("is-within-past / is-within-next", () => {
  const week = { unit: "week", amount: 1 };

  it("is-within-past keeps fields within the past window", () => {
    expect(keeps("is-within-past", week, daysFromNow(0))).toBe(true);
    expect(keeps("is-within-past", week, daysFromNow(-3))).toBe(true);
    expect(keeps("is-within-past", week, daysFromNow(-7, 0))).toBe(true);
    expect(keeps("is-within-past", week, daysFromNow(-30))).toBe(false);
    expect(keeps("is-within-past", week, daysFromNow(3))).toBe(false);
  });

  it("is-within-next keeps fields within the next window", () => {
    expect(keeps("is-within-next", week, daysFromNow(0))).toBe(true);
    expect(keeps("is-within-next", week, daysFromNow(3))).toBe(true);
    expect(keeps("is-within-next", week, daysFromNow(7, 23))).toBe(true);
    expect(keeps("is-within-next", week, daysFromNow(30))).toBe(false);
    expect(keeps("is-within-next", week, daysFromNow(-3))).toBe(false);
  });

  it("incomplete operand → keep; null field → drop", () => {
    expect(keeps("is-within-past", undefined, daysFromNow(0))).toBe(true);
    expect(keeps("is-within-next", {}, daysFromNow(0))).toBe(true);
    expect(keeps("is-within-past", week, null)).toBe(false);
  });
});

// A date field whose value is a calendar DATE on the rows its all-day flag
// marks (held at that date's UTC midnight), an instant on the others. West of
// UTC the two disagree about which day a stored instant falls on: in New York
// an all-day 4 Dec event (00:00Z) is 19:00 on 3 Dec as an instant.
describe("a date field with an all-day flag (America/New_York)", () => {
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

  // 10:30 on 4 Dec in New York.
  const now = Date.parse("2026-12-04T15:30:00Z");
  const field: FieldDef<unknown> = {
    id: "startsAt",
    label: "When",
    allDayFlag: "allDay",
  };
  const FILTERABLE: Filterable = {
    startsAt: { domain: "instant" },
    allDay: { domain: "boolean" },
  };
  const TODAY = { kind: "relative", unit: "day", amount: 0 };
  interface Row {
    startsAt: string;
    allDay: boolean | null;
  }
  const allDay = (startsAt: string): Row => ({ startsAt, allDay: true });
  const timed = (startsAt: string): Row => ({ startsAt, allDay: false });
  const keeps = (op: keyof typeof dateLower, operand: unknown, row: Row) => {
    const filter = dateLower[op](operand, { column: "startsAt", field, now });
    if (filter === undefined) throw new Error(`${op} lowered no filter`);
    return matchesFilter(
      { startsAt: new Date(row.startsAt), allDay: row.allDay },
      filter,
      FILTERABLE,
    );
  };

  it("keeps today's all-day event on or after Today, all day long", () => {
    expect(keeps("is-on-or-after", TODAY, allDay("2026-12-04T00:00:00Z"))).toBe(
      true,
    );
    expect(keeps("is-on-or-after", TODAY, allDay("2026-12-03T00:00:00Z"))).toBe(
      false,
    );
  });

  it("still reads a timed event's day in the viewer's zone", () => {
    // 23:00 on 3 Dec, then 01:00 on 4 Dec, in New York.
    expect(keeps("is-on-or-after", TODAY, timed("2026-12-04T04:00:00Z"))).toBe(
      false,
    );
    expect(keeps("is-on-or-after", TODAY, timed("2026-12-04T06:00:00Z"))).toBe(
      true,
    );
    // An unset flag is a timed event.
    expect(
      keeps("is-on-or-after", TODAY, {
        startsAt: "2026-12-04T04:00:00Z",
        allDay: null,
      }),
    ).toBe(false);
  });

  it("is Today holds the all-day events of that date and the timed ones of that local day", () => {
    expect(keeps("is", TODAY, allDay("2026-12-04T00:00:00Z"))).toBe(true);
    expect(keeps("is", TODAY, allDay("2026-12-05T00:00:00Z"))).toBe(false);
    // 23:59 on 4 Dec in New York.
    expect(keeps("is", TODAY, timed("2026-12-05T04:59:00Z"))).toBe(true);
  });

  // An exact date is the day the user picked in this zone, not the UTC
  // midnight that `new Date("2026-12-04")` reads, which is 3 Dec here.
  it("an exact date holds that date's events, not the day before's", () => {
    const DEC_4 = { kind: "date", iso: "2026-12-04" };
    expect(keeps("is", DEC_4, allDay("2026-12-04T00:00:00Z"))).toBe(true);
    expect(keeps("is", DEC_4, allDay("2026-12-03T00:00:00Z"))).toBe(false);
    // 10:00 on 4 Dec, then 23:00 on 3 Dec, in New York.
    expect(keeps("is", DEC_4, timed("2026-12-04T15:00:00Z"))).toBe(true);
    expect(keeps("is", DEC_4, timed("2026-12-04T04:00:00Z"))).toBe(false);
    expect(
      keeps(
        "is-between",
        { from: "2026-12-04", to: "2026-12-04" },
        allDay("2026-12-04T00:00:00Z"),
      ),
    ).toBe(true);
    expect(keeps("is-before", DEC_4, allDay("2026-12-03T00:00:00Z"))).toBe(
      true,
    );
  });

  it("compares an all-day event by its date under every day operator", () => {
    const YESTERDAY = { kind: "relative", unit: "day", amount: -1 };
    expect(keeps("is-before", TODAY, allDay("2026-12-04T00:00:00Z"))).toBe(
      false,
    );
    expect(keeps("is-before", TODAY, allDay("2026-12-03T00:00:00Z"))).toBe(
      true,
    );
    expect(keeps("is-after", YESTERDAY, allDay("2026-12-04T00:00:00Z"))).toBe(
      true,
    );
    expect(
      keeps("is-on-or-before", YESTERDAY, allDay("2026-12-04T00:00:00Z")),
    ).toBe(false);
    expect(
      keeps("is-on-or-before", YESTERDAY, allDay("2026-12-03T00:00:00Z")),
    ).toBe(true);
    expect(
      keeps(
        "is-between",
        { from: TODAY, to: TODAY },
        allDay("2026-12-04T00:00:00Z"),
      ),
    ).toBe(true);
    expect(
      keeps(
        "is-within-next",
        { unit: "day", amount: 1 },
        allDay("2026-12-04T00:00:00Z"),
      ),
    ).toBe(true);
    expect(
      keeps(
        "is-within-past",
        { unit: "day", amount: 1 },
        allDay("2026-12-03T00:00:00Z"),
      ),
    ).toBe(true);
  });

  it("lowers emptiness on the column alone", () => {
    const ctx = { column: "startsAt", field, now };
    expect(dateLower["is-empty"](undefined, ctx)).toEqual(
      clause("startsAt", "isEmpty"),
    );
  });
});
