import { REPO_ROOT } from "@plugins/infra/plugins/paths/plugins/repo-root/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import {
  canonicalizeFilter,
  matchesFilter,
  type Filter,
} from "@plugins/network/plugins/live/plugins/filter/core";
import type {
  FieldDef,
  FilterGroup,
  FilterOperatorSet,
} from "@plugins/primitives/plugins/data-view/core";
import {
  deriveFields,
  lowerFilterGroup,
  renameColumns,
  resolveLiveFields,
} from "@plugins/primitives/plugins/data-view/web/testing";
import { dateOperatorSet } from "@plugins/fields/plugins/date/plugins/filter/web/testing";
import { boolOperatorSet } from "@plugins/fields/plugins/bool/plugins/filter/web/testing";
import { eventsList, type EventListRow } from "../../core";
import { eventsListSource } from "../internal/source";

/**
 * The forward views (`Upcoming`, `Gallery`) are AUTHORED CONFIG: "starts on or
 * after Today". An all-day event is stored at UTC midnight of its calendar
 * date, a timed one at its instant — so west of UTC, local midnight of today
 * is AFTER today's all-day events, and a bare instant bound drops them from
 * the forward window on the very day they happen.
 *
 * This suite reads the real config, lowers each forward view's filter through
 * the real date and bool operator sets over the fields the list derives from
 * `eventsList`, renames by the live source's own field plan, and evaluates the
 * result against rows on both axes, in New York.
 */
const CONFIG_PATH = join(
  REPO_ROOT,
  "config/apps/events/event-list/events.list.jsonc",
);

interface AuthoredRow {
  id: string;
  view: { filter?: FilterGroup };
}

function authoredViews(): AuthoredRow[] {
  const errors: { error: number; offset: number; length: number }[] = [];
  const doc = parseJsonc(readFileSync(CONFIG_PATH, "utf8"), errors) as {
    views?: AuthoredRow[];
  };
  if (errors.length > 0) {
    throw new Error(
      `${CONFIG_PATH} is not parseable JSONC: ${JSON.stringify(errors)}`,
    );
  }
  return doc.views ?? [];
}

const SETS: FilterOperatorSet[] = [dateOperatorSet, boolOperatorSet];
const resolve = (typeId: string): FilterOperatorSet | undefined =>
  SETS.find((s) => s.match === typeId);

// 10:30 on Friday 4 Dec 2026 in New York.
const NOW = Date.parse("2026-12-04T15:30:00Z");

const FORWARD_VIEWS = ["upcoming", "gallery"];

let zone = "";
let lowered: Map<string, Filter>;

beforeAll(() => {
  // Restored to the zone in force (vitest pins `UTC`), never by deleting `TZ`,
  // which would re-resolve to the host's zone.
  zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  process.env.TZ = "America/New_York";

  const fields = deriveFields(eventsList, true, [])
    .fields as FieldDef<EventListRow>[];
  const plan = resolveLiveFields(
    fields,
    eventsListSource,
    resolve,
    "upcoming-view test",
  );
  lowered = new Map();
  for (const row of authoredViews()) {
    if (!FORWARD_VIEWS.includes(row.id)) continue;
    const { filter, unavailable } = lowerFilterGroup(
      row.view.filter ?? null,
      plan.filterFields,
      resolve,
      NOW,
    );
    expect(unavailable).toEqual([]);
    if (filter === undefined) throw new Error(`"${row.id}" lowered no filter`);
    const renamed = renameColumns(filter, (id) => {
      const column = plan.columnOf.get(id);
      if (column === undefined) throw new Error(`"${id}" lowers to no column`);
      return column;
    });
    const canonical = canonicalizeFilter(renamed, eventsList.filterable);
    if (canonical === undefined) {
      throw new Error(`"${row.id}" canonicalizes to no filter`);
    }
    lowered.set(row.id, canonical);
  }
});

afterAll(() => {
  process.env.TZ = zone;
});

const allDay = (iso: string) => ({ startsAt: new Date(iso), allDay: true });
const timed = (iso: string) => ({ startsAt: new Date(iso), allDay: false });

describe("the forward views in America/New_York", () => {
  it("are both authored", () => {
    expect([...lowered.keys()].sort()).toEqual([...FORWARD_VIEWS].sort());
  });

  for (const id of FORWARD_VIEWS) {
    const keeps = (row: { startsAt: Date; allDay: boolean }): boolean => {
      const filter = lowered.get(id);
      if (filter === undefined) throw new Error(`"${id}" is not authored`);
      return matchesFilter(row, filter, eventsList.filterable);
    };

    it(`"${id}" keeps today's all-day event all day`, () => {
      expect(keeps(allDay("2026-12-04T00:00:00Z"))).toBe(true);
    });

    it(`"${id}" drops yesterday's all-day event`, () => {
      expect(keeps(allDay("2026-12-03T00:00:00Z"))).toBe(false);
    });

    it(`"${id}" still bounds timed events by local midnight`, () => {
      // 23:00 on 3 Dec in New York, then 01:00 on 4 Dec.
      expect(keeps(timed("2026-12-04T04:00:00Z"))).toBe(false);
      expect(keeps(timed("2026-12-04T06:00:00Z"))).toBe(true);
    });
  }
});
