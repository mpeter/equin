import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { EventDate } from "@plugins/apps/plugins/events/plugins/event-date/core";
import { eventDayFloor } from "@plugins/apps/plugins/events/plugins/event-date/core";
import { planReanchor } from "./plan-reanchor";

// The re-anchor decision is pure, so "what does this weekly series say next
// Wednesday" is a test rather than a database. `from` is a parameter for exactly
// that reason — the bug this closes is entirely about the answer changing while
// nothing writes.
//
// Every `from` here is a day START, because that is what the sweep passes (see
// `planReanchor`'s contract). Written as explicit instants rather than derived
// from a local midnight, so the suite asserts the decision and not the machine's
// timezone.

/** "Tous les mercredis", anchored on Wed 2026-08-12 at 18:00Z — a real row. */
const weekly: EventDate = {
  kind: "recurring",
  startsAt: new Date("2026-08-12T18:00:00Z"),
  rule: { freq: "weekly", interval: 1, byWeekday: ["we"] },
  label: "Tous les mercredis",
};

const at = (iso: string): Date => new Date(iso);

describe("planReanchor", () => {
  test("moves a series whose stored occurrence has passed", () => {
    // Four weeks on, the stored anchor is four occurrences behind. This is the
    // whole bug: without the move the row claims to start in August and every
    // `starts_at >= today` filter drops it.
    const plan = planReanchor(
      weekly,
      at("2026-08-12T18:00:00Z"),
      at("2026-09-08T00:00:00Z"),
    );
    expect(plan.kind).toBe("move");
    if (plan.kind !== "move") throw new Error("expected a move");
    expect(plan.occurrence.startsAt.toISOString()).toBe(
      "2026-09-09T18:00:00.000Z",
    );
  });

  test("lands on TODAY's occurrence, not the one after it", () => {
    // The regression that made this a `from`-of-day-start rather than a
    // `from`-of-now: resolving at the wall clock skips an occurrence that
    // already started earlier today, hiding a weekly event from the very day it
    // is running on. An all-day series is the worst case — it "starts" at
    // midnight, so ANY sweep during the day would push it a week out.
    const allDay: EventDate = {
      kind: "recurring",
      startsAt: at("2026-09-01T00:00:00Z"),
      allDay: true,
      rule: { freq: "weekly", interval: 1, byWeekday: ["tu"] },
    };
    const plan = planReanchor(
      allDay,
      at("2026-09-01T00:00:00Z"),
      at("2026-09-08T00:00:00Z"),
    );
    expect(plan.kind).toBe("move");
    if (plan.kind !== "move") throw new Error("expected a move");
    expect(plan.occurrence.startsAt.toISOString()).toBe(
      "2026-09-08T00:00:00.000Z",
    );
  });

  test("keeps a series whose stored occurrence is still ahead", () => {
    // The idempotence that lets the sweep run hourly for free: a second pass on
    // the same day writes nothing, so it cannot tick the live revision.
    const plan = planReanchor(
      weekly,
      at("2026-09-09T18:00:00Z"),
      at("2026-09-08T00:00:00Z"),
    );
    expect(plan.kind).toBe("keep");
  });

  test("keeps an occurrence that started earlier today", () => {
    const plan = planReanchor(
      weekly,
      at("2026-09-09T18:00:00Z"),
      at("2026-09-09T00:00:00Z"),
    );
    expect(plan.kind).toBe("keep");
  });

  test("reports a series that has run out rather than inventing a date", () => {
    const ended: EventDate = {
      ...weekly,
      rule: { ...weekly.rule, until: at("2026-08-20T00:00:00Z") },
    };
    expect(
      planReanchor(
        ended,
        at("2026-08-19T18:00:00Z"),
        at("2026-09-08T00:00:00Z"),
      ).kind,
    ).toBe("over");
  });

  test("a one-off is never moved, past or not", () => {
    // `resolveAnchor` resolves a `once` date whether or not it has passed —
    // last week's concert still happened — so a sweep cannot rewrite it.
    const once: EventDate = {
      kind: "once",
      startsAt: at("2026-08-01T20:00:00Z"),
    };
    expect(
      planReanchor(once, at("2026-08-01T20:00:00Z"), at("2026-09-08T00:00:00Z"))
        .kind,
    ).toBe("keep");
  });
});

describe("planReanchor for an all-day series, west of UTC", () => {
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

  const tuesdays: EventDate = {
    kind: "recurring",
    startsAt: at("2026-09-01T00:00:00Z"),
    allDay: true,
    rule: { freq: "weekly", interval: 1, byWeekday: ["tu"] },
  };

  test("keeps today's occurrence on the day it runs", () => {
    // 10:30 on Tue 1 Sep in New York. Resolving from local midnight (04:00Z)
    // would sit after the stored 00:00Z occurrence and push it a week out.
    const now = at("2026-09-01T14:30:00Z");
    const plan = planReanchor(
      tuesdays,
      at("2026-09-01T00:00:00Z"),
      eventDayFloor(now, true),
    );
    expect(plan.kind).toBe("keep");
  });

  test("moves to the next Tuesday the day after", () => {
    const now = at("2026-09-02T14:30:00Z");
    const plan = planReanchor(
      tuesdays,
      at("2026-09-01T00:00:00Z"),
      eventDayFloor(now, true),
    );
    expect(plan.kind).toBe("move");
    if (plan.kind !== "move") throw new Error("expected a move");
    expect(plan.occurrence.startsAt.toISOString()).toBe(
      "2026-09-08T00:00:00.000Z",
    );
  });
});
