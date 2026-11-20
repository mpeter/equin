import {
  and,
  clause,
  or,
  type Filter,
} from "@plugins/network/plugins/live/plugins/filter/core";
import type { FilterLowerContext } from "@plugins/primitives/plugins/data-view/core";
import {
  addUnits,
  resolveAnchorDay,
  withinRange,
  type DateRange,
} from "../../core";

type Lower = (operand: unknown, ctx: FilterLowerContext) => Filter | undefined;

/**
 * One bound of a day comparison: the value is `op` the START of a (local)
 * day — `["gte", day]` is "on or after that day", `["lt", day]` "before it".
 */
type DayBound = readonly ["gte" | "lt", number];

/** An epoch-ms instant as the language's instant operand (ISO-Z, ms). */
function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * The same day as a CALENDAR DATE: UTC midnight of the local day `day` starts.
 * A row on the calendar axis (`FieldDef.allDayFlag`) holds its date there —
 * the convention `event-date`'s `eventCalendarDay` reads back.
 */
function calendarDate(day: number): string {
  const d = new Date(day);
  return iso(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** The start of the (local) day after `day` — calendar-safe across DST. */
function nextDay(day: number): number {
  return addUnits(day, "day", 1);
}

/**
 * An anchor's (local) day start, reading the clock ONLY for a relative anchor
 * (`ctx.now` is read lazily, so an absolute date records no clock read).
 */
function anchorDay(operand: unknown, ctx: FilterLowerContext): number | null {
  return resolveAnchorDay(operand, () => ctx.now);
}

/** `bounds` over `column`, each day written by `stamp`. */
function bounded(
  column: string,
  bounds: readonly DayBound[],
  stamp: (day: number) => string,
): Filter[] {
  return bounds.map(([op, day]) => clause(column, op, stamp(day)));
}

/**
 * A day comparison's bounds, lowered. A field whose rows are all instants
 * compares each against the bound's local day start. A field with an all-day
 * flag holds its flagged rows at UTC midnight of their date (`calendarDate`):
 * those compare against the bound's date, the rest against its local day
 * start, so an all-day event is "today" for the whole of its date wherever the
 * reader is. `ne` holds for a NULL flag: an unflagged row is an instant.
 */
function days(
  bounds: (
    operand: unknown,
    ctx: FilterLowerContext,
  ) => readonly DayBound[] | null,
): Lower {
  return (operand, ctx) => {
    const found = bounds(operand, ctx);
    if (found === null || found.length === 0) return undefined;
    const instants = bounded(ctx.column, found, iso);
    const flag = ctx.field.allDayFlag;
    if (flag === undefined) {
      return instants.length === 1 ? instants[0] : and(...instants);
    }
    return or(
      and(
        clause(flag, "eq", true),
        ...bounded(ctx.column, found, calendarDate),
      ),
      and(clause(flag, "ne", true), ...instants),
    );
  };
}

/** A comparison against one anchor's day, its bounds `toBounds(dayStart)`. */
function onDay(toBounds: (day: number) => readonly DayBound[]): Lower {
  return days((operand, ctx) => {
    const day = anchorDay(operand, ctx);
    return day === null ? null : toBounds(day);
  });
}

function within(direction: "past" | "next"): Lower {
  return days((operand, ctx) => {
    const window = withinRange(operand, direction, () => ctx.now);
    if (window === null) return null;
    const [lo, hi] = window;
    // The upper day is inclusive, mirroring `is-between`.
    return [
      ["gte", lo],
      ["lt", nextDay(hi)],
    ];
  });
}

/**
 * The date operators lowered into the filter language's `instant` domain.
 * Day-granular: an anchor resolves (through the shared anchor math) to the start
 * of its local day, and each comparison becomes a half-open instant range —
 * `is` → [day, next day), `is before` → < day, `is after` → ≥ next day,
 * `on or before` → < next day, `on or after` → ≥ day. A relative anchor
 * ("Today", "within the past week") is resolved against `ctx.now` here, on the
 * client: the language itself has no clock. A field declaring an all-day flag
 * lowers each comparison on both of its axes (`days`).
 */
export const dateLower = {
  is: onDay((day) => [
    ["gte", day],
    ["lt", nextDay(day)],
  ]),
  "is-before": onDay((day) => [["lt", day]]),
  "is-after": onDay((day) => [["gte", nextDay(day)]]),
  "is-on-or-before": onDay((day) => [["lt", nextDay(day)]]),
  "is-on-or-after": onDay((day) => [["gte", day]]),
  "is-between": days((operand, ctx) => {
    const range = (operand ?? {}) as DateRange;
    const from = anchorDay(range.from, ctx);
    const to = anchorDay(range.to, ctx);
    const bounds: DayBound[] = [];
    if (from !== null) bounds.push(["gte", from]);
    // `to` is inclusive of the whole day.
    if (to !== null) bounds.push(["lt", nextDay(to)]);
    return bounds;
  }),
  "is-within-past": within("past"),
  "is-within-next": within("next"),
  "is-empty": (_operand, { column }) => clause(column, "isEmpty"),
  "is-not-empty": (_operand, { column }) => clause(column, "isNotEmpty"),
} satisfies Record<string, Lower>;
