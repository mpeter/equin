import type { FilterOperatorSet } from "@plugins/primitives/plugins/data-view/web";
import { dateOperatorSet as operators } from "../operator-set";

// The real date operator set, as the Filter slot receives it (the contribution
// adds the `match` key), for another plugin's test to lower authored filters
// through exactly what the Filter control runs (e.g. the events list's
// Upcoming view).
export const dateOperatorSet: FilterOperatorSet = {
  match: "date",
  ...operators,
};
