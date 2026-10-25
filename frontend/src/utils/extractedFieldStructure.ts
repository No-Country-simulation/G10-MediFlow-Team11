import { resolveFieldLabel } from "../config/extractedFieldLabels";
import type { ExtractedData } from "../types/processing";

export type FieldPath = readonly (string | number)[];
export type ScalarValueType = "string" | "number" | "boolean" | "other";
export type ListKind = "text" | "scalar" | "object" | "mixed";

export interface FieldKeyInfo {
  readonly key: string;
  readonly label: string;
  readonly displayLabel: string;
  readonly canonicalKey: string | null;
  readonly known: boolean;
  readonly collides: boolean;
}

export type FieldColumn = FieldKeyInfo;

export interface LabelCollision {
  readonly label: string;
  readonly keys: readonly string[];
}

export interface NullNode {
  readonly kind: "null";
  readonly path: FieldPath;
  readonly raw: null | undefined;
  readonly absent: boolean;
}

export interface ScalarNode {
  readonly kind: "scalar";
  readonly path: FieldPath;
  readonly raw: unknown;
  readonly valueType: ScalarValueType;
  readonly text: string;
  readonly blank: boolean;
}

export interface EmptyNode {
  readonly kind: "empty";
  readonly path: FieldPath;
  readonly raw: unknown;
  readonly shape: "object" | "list";
}

export interface FieldEntry extends FieldKeyInfo {
  readonly path: FieldPath;
  readonly node: FieldNode;
}

export interface ObjectNode {
  readonly kind: "object";
  readonly path: FieldPath;
  readonly raw: Readonly<Record<string, unknown>>;
  readonly entries: readonly FieldEntry[];
  readonly collisions: readonly LabelCollision[];
}

export interface ListNode {
  readonly kind: "list";
  readonly path: FieldPath;
  readonly raw: readonly unknown[];
  readonly listKind: ListKind;
  readonly items: readonly FieldNode[];
  readonly columns: readonly FieldColumn[];
  readonly collisions: readonly LabelCollision[];
}

export type FieldNode = NullNode | ScalarNode | EmptyNode | ObjectNode | ListNode;

export interface AdditionalFields {
  readonly entries: readonly FieldEntry[];
  readonly collisions: readonly LabelCollision[];
}

export const CORE_EXTRACTED_KEYS: ReadonlySet<string> = new Set([
  "patient",
  "requesting_doctor",
  "primary_diagnosis",
  "suggested_icd10",
  "medications",
  "requested_studies",
]);

const MAX_FIELD_DEPTH = 32;
const DEPTH_EXCEEDED_TEXT = "[estructura demasiado profunda]";
const CIRCULAR_TEXT = "[referencia circular]";
const UNREPRESENTABLE_TEXT = "[valor no representable]";

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function safeString(value: unknown): string {
  try {
    return String(value);
  } catch {
    return UNREPRESENTABLE_TEXT;
  }
}

export function formatScalarText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return safeString(value);
}

function scalarNode(value: unknown, path: FieldPath, text?: string): ScalarNode {
  const valueType: ScalarValueType = isPrimitive(value) ? (typeof value as ScalarValueType) : "other";
  return {
    kind: "scalar",
    path,
    raw: value,
    valueType,
    text: text ?? formatScalarText(value),
    blank: typeof value === "string" && value.trim().length === 0,
  };
}

function describeKeys(keys: readonly string[]): {
  infos: FieldKeyInfo[];
  collisions: LabelCollision[];
} {
  const resolved = keys.map((key) => ({ key, ...resolveFieldLabel(key) }));
  const groups = new Map<string, { label: string; keys: string[] }>();

  for (const { key, label } of resolved) {
    const groupId = label.toLocaleLowerCase("es");
    const group = groups.get(groupId);
    if (group) group.keys.push(key);
    else groups.set(groupId, { label, keys: [key] });
  }

  const infos = resolved.map(({ key, label, canonicalKey, known }) => {
    const collides = (groups.get(label.toLocaleLowerCase("es"))?.keys.length ?? 0) > 1;
    return {
      key,
      label,
      displayLabel: collides ? `${label} (${key})` : label,
      canonicalKey,
      known,
      collides,
    };
  });

  const collisions = [...groups.values()].filter((group) => group.keys.length > 1);
  return { infos, collisions };
}

function buildEntries(
  source: PlainObject,
  keys: readonly string[],
  path: FieldPath,
  depth: number,
  ancestors: readonly object[],
): { entries: FieldEntry[]; collisions: LabelCollision[] } {
  const { infos, collisions } = describeKeys(keys);
  const entries = infos.map((info) => {
    const entryPath = [...path, info.key];
    return {
      ...info,
      path: entryPath,
      node: buildNode(source[info.key], entryPath, depth + 1, ancestors),
    };
  });
  return { entries, collisions };
}

function classifyList(elements: readonly unknown[]): ListKind {
  if (elements.every((item) => typeof item === "string")) return "text";
  if (elements.every(isPrimitive)) return "scalar";
  if (elements.every(isPlainObject)) return "object";
  return "mixed";
}

function buildColumns(rows: readonly PlainObject[]): {
  columns: FieldColumn[];
  collisions: LabelCollision[];
} {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) keys.add(key);
  }
  const { infos, collisions } = describeKeys([...keys]);
  return { columns: infos, collisions };
}

function buildList(
  value: readonly unknown[],
  path: FieldPath,
  depth: number,
  ancestors: readonly object[],
): FieldNode {
  if (value.length === 0) {
    return { kind: "empty", path, raw: value, shape: "list" };
  }

  const elements = Array.from(value);
  const listKind = classifyList(elements);
  const items = elements.map((item, index) =>
    buildNode(item, [...path, index], depth + 1, ancestors),
  );
  const { columns, collisions } =
    listKind === "object"
      ? buildColumns(elements as PlainObject[])
      : { columns: [], collisions: [] };

  return { kind: "list", path, raw: value, listKind, items, columns, collisions };
}

function buildObject(
  value: PlainObject,
  path: FieldPath,
  depth: number,
  ancestors: readonly object[],
): FieldNode {
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return { kind: "empty", path, raw: value, shape: "object" };
  }

  const { entries, collisions } = buildEntries(value, keys, path, depth, ancestors);
  return { kind: "object", path, raw: value, entries, collisions };
}

function buildNode(
  value: unknown,
  path: FieldPath,
  depth: number,
  ancestors: readonly object[],
): FieldNode {
  if (value === null || value === undefined) {
    return { kind: "null", path, raw: value, absent: value === undefined };
  }

  if (isPrimitive(value)) return scalarNode(value, path);

  if (Array.isArray(value) || isPlainObject(value)) {
    if (depth >= MAX_FIELD_DEPTH) return scalarNode(value, path, DEPTH_EXCEEDED_TEXT);
    if (ancestors.includes(value)) return scalarNode(value, path, CIRCULAR_TEXT);

    const nextAncestors = [...ancestors, value];
    return Array.isArray(value)
      ? buildList(value, path, depth, nextAncestors)
      : buildObject(value, path, depth, nextAncestors);
  }

  return scalarNode(value, path);
}

export function buildFieldNode(value: unknown, path: FieldPath = []): FieldNode {
  return buildNode(value, path, 0, []);
}

export interface AdditionalFieldsOptions {
  readonly omitEmptyCollections?: boolean;
}

function isEmptyCollection(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return isPlainObject(value) && Object.keys(value).length === 0;
}

export function buildAdditionalFields(
  data: ExtractedData | null | undefined,
  options: AdditionalFieldsOptions = {},
): AdditionalFields {
  if (!isPlainObject(data)) return { entries: [], collisions: [] };

  const keys = Object.keys(data).filter(
    (key) =>
      !CORE_EXTRACTED_KEYS.has(key) &&
      !(options.omitEmptyCollections && isEmptyCollection(data[key])),
  );
  if (keys.length === 0) return { entries: [], collisions: [] };

  return buildEntries(data, keys, [], 0, [data]);
}

export function findEntry(node: FieldNode, key: string): FieldEntry | undefined {
  return node.kind === "object"
    ? node.entries.find((entry) => entry.key === key)
    : undefined;
}

export function cellOf(row: FieldNode, key: string): FieldNode {
  return (
    findEntry(row, key)?.node ?? {
      kind: "null",
      path: [...row.path, key],
      raw: undefined,
      absent: true,
    }
  );
}

export function isDisplayableNode(node: FieldNode): boolean {
  switch (node.kind) {
    case "null":
    case "empty":
      return false;
    case "scalar":
      return !node.blank;
    case "object":
      return node.entries.some((entry) => isDisplayableNode(entry.node));
    case "list":
      return node.items.some(isDisplayableNode);
  }
}
