import type { Exemptions } from "@plugins/framework/plugins/tooling/plugins/exempt/core";

export default [
  {
    rule: "react-compiler:no-silent-skips",
    paths: ["web/internal/values.ts"],
    kind: "sanctioned",
    reason:
      "useDraftOptionDefaults calls each registered option's useDraftDefault hook in a loop. The TaskLaunch.Option registry is fixed at build time, so the hook order never changes; the next-line rules-of-hooks disable that says so makes the compiler skip this one small hook.",
  },
] satisfies Exemptions;
