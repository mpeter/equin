import { z } from "zod";
import {
  declaredDefault,
  type FieldDef,
  type ExactOptions,
  type FieldMarks,
  type FieldMeta,
  pickMeta,
} from "@plugins/fields/core";
import { dateFieldType } from "@plugins/fields/plugins/date/core";

export interface DateFieldDef extends FieldDef<Date> {
  readonly type: typeof dateFieldType;
}

// The options mark the field (`FieldMarks`: a declared `default`, a `label`,
// `filterable: false`). `allDayFlag` names the boolean field beside it that
// flags the rows holding a calendar date at UTC midnight (`FieldMeta.allDayFlag`).
export function dateField<
  const O extends FieldMeta & { default?: Date } = Record<never, never>,
>(
  opts?: ExactOptions<O, FieldMeta & { default?: Date }>,
): DateFieldDef & FieldMarks<O> {
  return Object.freeze({
    type: dateFieldType,
    schema: z.coerce.date(),
    defaultValue: opts?.default ?? new Date(0),
    ...declaredDefault(opts),
    meta: {
      ...pickMeta(opts),
      ...(opts?.allDayFlag !== undefined
        ? { allDayFlag: opts.allDayFlag }
        : {}),
    },
  }) as DateFieldDef & FieldMarks<O>;
}
