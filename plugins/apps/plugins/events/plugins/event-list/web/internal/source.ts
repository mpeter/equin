import {
  defineDataView,
  liveDataSource,
} from "@plugins/primitives/plugins/data-view/web";
import { EVENT_LIST_SEARCHABLE, eventsList } from "../../core";

/**
 * The Events surface id. Config-backed like every DataView: the view instances
 * (`Upcoming`, `All`, `By category`, …) live ONLY in
 * `config/apps/events/event-list/events.list.jsonc` — there is no
 * code-synthesized default, by design. It IS `eventsList`'s column scope
 * (asserted at mount): the surface whose custom columns sort and filter it.
 */
export const EVENTS_LIST_VIEW = defineDataView("events.list");

/**
 * The live source: the `events.list` collection, kept fresh by the routed change
 * feed (an event write, a source's type / config / enabled flip) with no tick
 * and no refetch. The search box matches what an event is and where it is.
 */
export const eventsListSource = liveDataSource(eventsList, {
  surface: EVENTS_LIST_VIEW,
  searchable: EVENT_LIST_SEARCHABLE,
});
