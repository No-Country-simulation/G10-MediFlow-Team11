import { describe, expect, it } from "vitest";
import type { ExtractedData } from "../types/processing";
import {
  buildAdditionalFields,
  buildFieldNode,
  cellOf,
  findEntry,
  formatScalarText,
  isDisplayableNode,
  type FieldNode,
  type ListNode,
  type ObjectNode,
  type ScalarNode,
} from "./extractedFieldStructure";

function asObject(node: FieldNode): ObjectNode {
  expect(node.kind).toBe("object");
  return node as ObjectNode;
}

function asList(node: FieldNode): ListNode {
  expect(node.kind).toBe("list");
  return node as ListNode;
}

function asScalar(node: FieldNode): ScalarNode {
  expect(node.kind).toBe("scalar");
  return node as ScalarNode;
}

const textLabResults = [
  { name: "Glucosa en sangre", value: "174", unit: "mg/dL", reference_range: "70–99 mg/dL" },
  { name: "HbA1c", value: "8.2", unit: "%", reference_range: "Inferior a 5.7 %" },
  { name: "Creatinina sérica", value: "0.86", unit: "mg/dL", reference_range: "0.6–1.1 mg/dL" },
];

describe("formatScalarText", () => {
  it("conserva textos y números sin alterar el formato", () => {
    expect(formatScalarText("174")).toBe("174");
    expect(formatScalarText(174)).toBe("174");
    expect(formatScalarText(8.2)).toBe("8.2");
    expect(formatScalarText(0.86)).toBe("0.86");
    expect(formatScalarText("  0.86 ")).toBe("  0.86 ");
    expect(formatScalarText("")).toBe("");
    expect(formatScalarText(0)).toBe("0");
  });

  it("presenta los booleanos en español", () => {
    expect(formatScalarText(true)).toBe("Sí");
    expect(formatScalarText(false)).toBe("No");
  });
});

describe("buildFieldNode — clasificación", () => {
  it.each([
    ["texto", "valor personalizado", "string"],
    ["número", 42, "number"],
    ["booleano", true, "boolean"],
  ] as const)("distingue el escalar %s", (_name, value, valueType) => {
    const node = asScalar(buildFieldNode(value));
    expect(node.valueType).toBe(valueType);
    expect(node.raw).toBe(value);
    expect(node.blank).toBe(false);
  });

  it("marca como vacío el texto en blanco sin descartarlo", () => {
    const node = asScalar(buildFieldNode("   "));
    expect(node.blank).toBe(true);
    expect(node.raw).toBe("   ");
    expect(node.text).toBe("   ");
  });

  it("distingue valores nulos y ausentes", () => {
    expect(buildFieldNode(null)).toEqual({ kind: "null", path: [], raw: null, absent: false });
    expect(buildFieldNode(undefined)).toEqual({
      kind: "null",
      path: [],
      raw: undefined,
      absent: true,
    });
  });

  it("distingue colecciones vacías", () => {
    expect(buildFieldNode([])).toMatchObject({ kind: "empty", shape: "list" });
    expect(buildFieldNode({})).toMatchObject({ kind: "empty", shape: "object" });
  });

  it("clasifica los arrays de textos", () => {
    const node = asList(buildFieldNode(["penicilina", "aspirina"]));
    expect(node.listKind).toBe("text");
    expect(node.items.map((item) => asScalar(item).text)).toEqual(["penicilina", "aspirina"]);
    expect(node.columns).toEqual([]);
  });

  it("clasifica los arrays de escalares que no son todos textos", () => {
    const node = asList(buildFieldNode([174, "8.2", true]));
    expect(node.listKind).toBe("scalar");
    expect(node.items.map((item) => asScalar(item).valueType)).toEqual([
      "number",
      "string",
      "boolean",
    ]);
  });

  it("clasifica los arrays de objetos", () => {
    const node = asList(buildFieldNode(textLabResults));
    expect(node.listKind).toBe("object");
    expect(node.items).toHaveLength(3);
    expect(node.items.every((item) => item.kind === "object")).toBe(true);
  });

  it("clasifica como mixtos los arrays con nulos, listas anidadas o tipos combinados", () => {
    expect(asList(buildFieldNode(["a", { b: 1 }])).listKind).toBe("mixed");
    expect(asList(buildFieldNode([{ a: 1 }, null])).listKind).toBe("mixed");
    expect(asList(buildFieldNode([[1, 2], [3]])).listKind).toBe("mixed");
    expect(asList(buildFieldNode([undefined, "a"])).listKind).toBe("mixed");
  });

  it("trata un array disperso como mixto conservando los huecos", () => {
    const sparse: unknown[] = ["a"];
    sparse[2] = "c";
    const node = asList(buildFieldNode(sparse));
    expect(node.listKind).toBe("mixed");
    expect(node.items.map((item) => item.kind)).toEqual(["scalar", "null", "scalar"]);
  });

  it("clasifica los objetos anidados y conserva las rutas", () => {
    const node = asObject(
      buildFieldNode({ vitals: { pressure: { systolic: 120, diastolic: 80 }, unit: "mmHg" } }),
    );
    const vitals = asObject(findEntry(node, "vitals")!.node);
    const pressure = asObject(findEntry(vitals, "pressure")!.node);
    const systolic = asScalar(findEntry(pressure, "systolic")!.node);

    expect(systolic.path).toEqual(["vitals", "pressure", "systolic"]);
    expect(systolic.raw).toBe(120);
    expect(findEntry(pressure, "diastolic")!.label).toBe("Presión diastólica");
    expect(findEntry(vitals, "unit")!.label).toBe("Unidad");
  });

  it("clasifica un objeto con listas y objetos mezclados", () => {
    const node = asObject(
      buildFieldNode({ a: "x", b: ["y", "z"], c: { d: null }, e: [], f: {} }),
    );
    expect(node.entries.map((entry) => [entry.key, entry.node.kind])).toEqual([
      ["a", "scalar"],
      ["b", "list"],
      ["c", "object"],
      ["e", "empty"],
      ["f", "empty"],
    ]);
  });

  it("usa la ruta base recibida", () => {
    const node = asObject(buildFieldNode({ a: [1] }, ["extracted_data", "x"]));
    expect(node.path).toEqual(["extracted_data", "x"]);
    expect(node.entries[0].path).toEqual(["extracted_data", "x", "a"]);
    expect(asList(node.entries[0].node).items[0].path).toEqual(["extracted_data", "x", "a", 0]);
  });
});

describe("buildFieldNode — valores de laboratorio", () => {
  it("conserva 174, 8.2 y 0.86 como textos y no los convierte", () => {
    const node = asList(buildFieldNode(textLabResults, ["lab_results"]));
    const values = node.items.map((row) => asScalar(cellOf(row, "value")));

    expect(values.map((value) => value.raw)).toEqual(["174", "8.2", "0.86"]);
    expect(values.map((value) => value.text)).toEqual(["174", "8.2", "0.86"]);
    expect(values.every((value) => value.valueType === "string")).toBe(true);
    expect(values[1].path).toEqual(["lab_results", 1, "value"]);
  });

  it("conserva 174, 8.2 y 0.86 como números sin cambiar su forma", () => {
    const numeric = textLabResults.map((row) => ({ ...row, value: Number(row.value) }));
    const node = asList(buildFieldNode(numeric));
    const values = node.items.map((row) => asScalar(cellOf(row, "value")));

    expect(values.map((value) => value.raw)).toEqual([174, 8.2, 0.86]);
    expect(values.map((value) => value.text)).toEqual(["174", "8.2", "0.86"]);
    expect(values.every((value) => value.valueType === "number")).toBe(true);
  });

  it("expone columnas, etiquetas en español y todas las celdas de lab_results", () => {
    const node = asList(buildFieldNode(textLabResults));

    expect(node.columns.map((column) => column.key)).toEqual([
      "name",
      "value",
      "unit",
      "reference_range",
    ]);
    expect(node.columns.map((column) => column.label)).toEqual([
      "Nombre",
      "Valor",
      "Unidad",
      "Intervalo de referencia",
    ]);
    expect(node.columns.every((column) => column.known && !column.collides)).toBe(true);

    const rows = node.items.map((row) =>
      node.columns.map((column) => asScalar(cellOf(row, column.key)).text),
    );
    expect(rows).toEqual([
      ["Glucosa en sangre", "174", "mg/dL", "70–99 mg/dL"],
      ["HbA1c", "8.2", "%", "Inferior a 5.7 %"],
      ["Creatinina sérica", "0.86", "mg/dL", "0.6–1.1 mg/dL"],
    ]);
  });

  it("conserva celdas nulas y ausentes en filas desiguales", () => {
    const node = asList(
      buildFieldNode([
        { name: "Glucosa", value: "174", unit: null },
        { name: "TSH", value: "2.4", reference_range: "0.4–4.0" },
      ]),
    );

    expect(node.columns.map((column) => column.key)).toEqual([
      "name",
      "value",
      "unit",
      "reference_range",
    ]);
    expect(cellOf(node.items[0], "unit")).toMatchObject({ kind: "null", absent: false, raw: null });
    expect(cellOf(node.items[0], "reference_range")).toMatchObject({
      kind: "null",
      absent: true,
      path: [0, "reference_range"],
    });
    expect(cellOf(node.items[1], "unit")).toMatchObject({ kind: "null", absent: true });
    expect(asScalar(cellOf(node.items[1], "reference_range")).text).toBe("0.4–4.0");
  });

  it("incluye filas de objeto vacío en la tabla", () => {
    const node = asList(buildFieldNode([{ name: "Glucosa" }, {}]));
    expect(node.listKind).toBe("object");
    expect(node.items[1]).toMatchObject({ kind: "empty", shape: "object" });
    expect(cellOf(node.items[1], "name")).toMatchObject({ kind: "null", absent: true });
  });
});

describe("buildFieldNode — estructuras desconocidas", () => {
  it("no oculta propiedades desconocidas y conserva su orden y su clave original", () => {
    const node = asObject(
      buildFieldNode({ zeta_value: 1, alphaValue: 2, "Mixed-Key": 3, unknown123: 4 }),
    );

    expect(node.entries.map((entry) => entry.key)).toEqual([
      "zeta_value",
      "alphaValue",
      "Mixed-Key",
      "unknown123",
    ]);
    expect(node.entries.map((entry) => entry.label)).toEqual([
      "Zeta value",
      "Alpha value",
      "Mixed key",
      "Unknown123",
    ]);
    expect(node.entries.every((entry) => !entry.known && entry.canonicalKey === null)).toBe(true);
  });

  it("conserva claves como __proto__ y constructor como propiedades", () => {
    const parsed = JSON.parse('{"__proto__": {"x": 1}, "constructor": "a", "toString": null}');
    const node = asObject(buildFieldNode(parsed));

    expect(node.entries.map((entry) => entry.key)).toEqual(["__proto__", "constructor", "toString"]);
    expect(node.entries.map((entry) => typeof entry.label)).toEqual(["string", "string", "string"]);
    expect(asObject(node.entries[0].node).entries[0]).toMatchObject({ key: "x" });
    expect(asScalar(node.entries[1].node).raw).toBe("a");
    expect(node.entries[2].node.kind).toBe("null");
  });

  it("procesa una estructura profunda y heterogénea sin perder valores", () => {
    const value = {
      study: {
        sections: [
          { title: "A", values: [1, 2, 3], notes: null },
          { title: "B", values: [], nested: { deep: [{ k: "v" }, ["x"]] } },
        ],
      },
    };
    const root = asObject(buildFieldNode(value));
    const sections = asList(asObject(findEntry(root, "study")!.node).entries[0].node);

    expect(sections.listKind).toBe("object");
    expect(sections.columns.map((column) => column.key)).toEqual(["title", "values", "notes", "nested"]);
    const second = asObject(sections.items[1]);
    const deep = asList(asObject(findEntry(second, "nested")!.node).entries[0].node);
    expect(deep.listKind).toBe("mixed");
    expect(asScalar(asObject(deep.items[0]).entries[0].node).path).toEqual([
      "study",
      "sections",
      1,
      "nested",
      "deep",
      0,
      "k",
    ]);
    expect(findEntry(second, "values")!.node).toMatchObject({ kind: "empty", shape: "list" });
  });

  it("conserva la referencia al valor original en cada nodo", () => {
    const lab = { name: "Glucosa", value: "174" };
    const list = [lab];
    const data = { lab_results: list };
    const root = asObject(buildFieldNode(data));
    const labList = asList(root.entries[0].node);

    expect(root.raw).toBe(data);
    expect(labList.raw).toBe(list);
    expect(labList.items[0].raw).toBe(lab);
  });

  it("no modifica los datos de entrada", () => {
    const data = { lab_results: structuredClone(textLabResults), flags: ["a"], nested: { a: null } };
    const snapshot = structuredClone(data);
    const frozen = Object.freeze(data);

    expect(() => buildFieldNode(frozen)).not.toThrow();
    expect(data).toEqual(snapshot);
  });

  it("representa valores no JSON como escalares sin lanzar errores", () => {
    const date = new Date(0);
    const node = asObject(
      buildFieldNode({ when: date, big: 10n, fn: () => 1, sym: Symbol("s"), nan: Number.NaN }),
    );
    const byKey = (key: string) => asScalar(findEntry(node, key)!.node);

    expect(byKey("when").valueType).toBe("other");
    expect(byKey("when").raw).toBe(date);
    expect(byKey("big")).toMatchObject({ valueType: "other", text: "10" });
    expect(byKey("fn").valueType).toBe("other");
    expect(byKey("sym").text).toBe("Symbol(s)");
    expect(byKey("nan")).toMatchObject({ valueType: "number", text: "NaN" });
  });

  it("evita recursión infinita ante referencias circulares", () => {
    const circular: Record<string, unknown> = { name: "a" };
    circular.self = circular;
    const node = asObject(buildFieldNode(circular));

    expect(asScalar(findEntry(node, "self")!.node)).toMatchObject({
      valueType: "other",
      text: "[referencia circular]",
      raw: circular,
    });
  });

  it("limita la profundidad sin perder el valor original", () => {
    let nested: unknown = "fin";
    for (let index = 0; index < 60; index++) nested = { child: nested };
    const root = buildFieldNode(nested);

    let current: FieldNode = root;
    let depth = 0;
    while (current.kind === "object") {
      current = current.entries[0].node;
      depth++;
    }
    expect(depth).toBeLessThan(60);
    expect(asScalar(current)).toMatchObject({ valueType: "other", text: "[estructura demasiado profunda]" });
    expect(current.raw).toBeTypeOf("object");
  });
});

describe("buildFieldNode — alias y colisiones", () => {
  it("usa etiquetas con alias para claves conocidas sin importar el formato", () => {
    const node = asObject(
      buildFieldNode({ referenceRange: "70–99", Unidad: "mg/dL", NOMBRE: "Glucosa" }),
    );

    expect(node.entries.map((entry) => entry.label)).toEqual([
      "Intervalo de referencia",
      "Unidad",
      "Nombre",
    ]);
    expect(node.entries.map((entry) => entry.canonicalKey)).toEqual([
      "reference_range",
      "unit",
      "name",
    ]);
    expect(node.collisions).toEqual([]);
  });

  it("conserva ambas propiedades cuando dos claves comparten alias y las califica", () => {
    const node = asObject(
      buildFieldNode({ reference_range: "70–99", referenceRange: "65–95", unit: "mg/dL" }),
    );

    expect(node.entries.map((entry) => entry.key)).toEqual(["reference_range", "referenceRange", "unit"]);
    expect(node.entries.map((entry) => asScalar(entry.node).raw)).toEqual(["70–99", "65–95", "mg/dL"]);
    expect(node.entries.map((entry) => entry.collides)).toEqual([true, true, false]);
    expect(node.entries.map((entry) => entry.label)).toEqual([
      "Intervalo de referencia",
      "Intervalo de referencia",
      "Unidad",
    ]);
    expect(node.entries.map((entry) => entry.displayLabel)).toEqual([
      "Intervalo de referencia (reference_range)",
      "Intervalo de referencia (referenceRange)",
      "Unidad",
    ]);
    expect(node.collisions).toEqual([
      { label: "Intervalo de referencia", keys: ["reference_range", "referenceRange"] },
    ]);
  });

  it("detecta colisiones entre un alias en español y la clave canónica", () => {
    const node = asObject(buildFieldNode({ unit: "mg/dL", unidad: "mmol/L" }));
    expect(node.collisions).toEqual([{ label: "Unidad", keys: ["unit", "unidad"] }]);
    expect(node.entries.map((entry) => entry.displayLabel)).toEqual([
      "Unidad (unit)",
      "Unidad (unidad)",
    ]);
  });

  it("detecta colisiones entre claves desconocidas con la misma humanización", () => {
    const node = asObject(buildFieldNode({ custom_field: 1, customField: 2 }));
    expect(node.collisions).toEqual([{ label: "Custom field", keys: ["custom_field", "customField"] }]);
    expect(node.entries.every((entry) => entry.collides && !entry.known)).toBe(true);
  });

  it("detecta colisiones entre columnas de filas distintas", () => {
    const node = asList(buildFieldNode([{ unit: "mg/dL" }, { unidad: "mmol/L" }]));

    expect(node.columns.map((column) => column.key)).toEqual(["unit", "unidad"]);
    expect(node.columns.map((column) => column.displayLabel)).toEqual([
      "Unidad (unit)",
      "Unidad (unidad)",
    ]);
    expect(node.collisions).toEqual([{ label: "Unidad", keys: ["unit", "unidad"] }]);
    expect(asObject(node.items[0]).entries[0].collides).toBe(false);
  });
});

describe("buildAdditionalFields", () => {
  it("excluye los campos centrales y conserva todos los adicionales", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      primary_diagnosis: "Diabetes",
      medications: [{ name: "Metformina" }],
      requested_studies: [],
      lab_results: textLabResults,
      measurements: { systolic: 120, diastolic: 80, unit: "mmHg" },
      allergies: ["penicilina"],
      notes: null,
      custom_flag: false,
    };

    const { entries, collisions } = buildAdditionalFields(data);

    expect(entries.map((entry) => entry.key)).toEqual([
      "lab_results",
      "measurements",
      "allergies",
      "notes",
      "custom_flag",
    ]);
    expect(entries.map((entry) => entry.label)).toEqual([
      "Resultados de laboratorio",
      "Mediciones",
      "Allergies",
      "Notes",
      "Custom flag",
    ]);
    expect(entries.map((entry) => entry.path)).toEqual([
      ["lab_results"],
      ["measurements"],
      ["allergies"],
      ["notes"],
      ["custom_flag"],
    ]);
    expect(collisions).toEqual([]);
    expect(entries.map((entry) => entry.node.kind)).toEqual(["list", "object", "list", "null", "scalar"]);
    expect(entries[0].node.raw).toBe(data.lab_results);
    expect(asScalar(entries[4].node).text).toBe("No");
  });

  it("representa mediciones con alias y valores originales", () => {
    const { entries } = buildAdditionalFields({
      measurements: { systolic: 120, diastolic: 80, unit: "mmHg" },
    } as ExtractedData);
    const measurements = asObject(entries[0].node);

    expect(measurements.entries.map((entry) => entry.label)).toEqual([
      "Presión sistólica",
      "Presión diastólica",
      "Unidad",
    ]);
    expect(measurements.entries.map((entry) => asScalar(entry.node).raw)).toEqual([120, 80, "mmHg"]);
  });

  it("devuelve vacío cuando no hay datos o solo campos centrales", () => {
    expect(buildAdditionalFields(null)).toEqual({ entries: [], collisions: [] });
    expect(buildAdditionalFields(undefined)).toEqual({ entries: [], collisions: [] });
    expect(buildAdditionalFields({})).toEqual({ entries: [], collisions: [] });
    expect(buildAdditionalFields({ patient: { name: "Ana" } })).toEqual({
      entries: [],
      collisions: [],
    });
  });

  it("señala colisiones entre campos adicionales de primer nivel", () => {
    const { entries, collisions } = buildAdditionalFields({
      lab_results: [],
      labResults: [{ name: "Glucosa" }],
    } as ExtractedData);

    expect(entries.map((entry) => entry.key)).toEqual(["lab_results", "labResults"]);
    expect(collisions).toEqual([
      { label: "Resultados de laboratorio", keys: ["lab_results", "labResults"] },
    ]);
    expect(entries.map((entry) => entry.node.kind)).toEqual(["empty", "list"]);
  });

  it("conserva por defecto las colecciones vacías de primer nivel", () => {
    const { entries } = buildAdditionalFields({
      lab_results: [],
      measurements: {},
    } as ExtractedData);

    expect(entries.map((entry) => [entry.key, entry.node.kind])).toEqual([
      ["lab_results", "empty"],
      ["measurements", "empty"],
    ]);
  });

  it("omite solo las colecciones vacías de primer nivel cuando se solicita", () => {
    const data = {
      lab_results: [],
      measurements: {},
      notes: null,
      blank: "  ",
      custom_flag: false,
      unknown: { nested_empty: [], other: {} },
      allergies: ["penicilina"],
      readings: [{ value: "1" }],
    } as ExtractedData;

    const { entries } = buildAdditionalFields(data, { omitEmptyCollections: true });

    expect(entries.map((entry) => [entry.key, entry.node.kind])).toEqual([
      ["notes", "null"],
      ["blank", "scalar"],
      ["custom_flag", "scalar"],
      ["unknown", "object"],
      ["allergies", "list"],
      ["readings", "list"],
    ]);
    const unknown = entries.find((entry) => entry.key === "unknown")!.node as ObjectNode;
    expect(unknown.entries.map((entry) => [entry.key, entry.node.kind])).toEqual([
      ["nested_empty", "empty"],
      ["other", "empty"],
    ]);
  });

  it("no considera vacíos los arrays dispersos ni los textos vacíos", () => {
    const sparse: unknown[] = [];
    sparse.length = 1;

    const { entries } = buildAdditionalFields(
      { sparse, text: "", zero: 0 } as unknown as ExtractedData,
      { omitEmptyCollections: true },
    );

    expect(entries.map((entry) => entry.key)).toEqual(["sparse", "text", "zero"]);
  });

  it("recalcula las colisiones sin las colecciones vacías omitidas", () => {
    const data = { lab_results: [], labResults: [{ name: "Glucosa" }] } as ExtractedData;

    const omitted = buildAdditionalFields(data, { omitEmptyCollections: true });
    expect(omitted.entries.map((entry) => [entry.key, entry.displayLabel, entry.collides])).toEqual([
      ["labResults", "Resultados de laboratorio", false],
    ]);
    expect(omitted.collisions).toEqual([]);

    const kept = buildAdditionalFields(data);
    expect(kept.collisions).toHaveLength(1);
  });

  it("devuelve vacío cuando todos los campos adicionales son colecciones vacías", () => {
    expect(
      buildAdditionalFields({ lab_results: [], measurements: {} } as ExtractedData, {
        omitEmptyCollections: true,
      }),
    ).toEqual({ entries: [], collisions: [] });
  });

  it("no modifica ni referencia datos ajenos al objeto original", () => {
    const data = { lab_results: structuredClone(textLabResults) } as ExtractedData;
    const snapshot = structuredClone(data);
    buildAdditionalFields(Object.freeze(data));
    expect(data).toEqual(snapshot);
  });
});

describe("findEntry y cellOf", () => {
  it("buscan por clave original y no por etiqueta", () => {
    const node = buildFieldNode({ reference_range: "70–99" });
    expect(findEntry(node, "reference_range")?.label).toBe("Intervalo de referencia");
    expect(findEntry(node, "Intervalo de referencia")).toBeUndefined();
    expect(findEntry(buildFieldNode("x"), "a")).toBeUndefined();
  });

  it("cellOf devuelve una celda ausente para nodos que no son objetos", () => {
    expect(cellOf(buildFieldNode(null, ["a"]), "k")).toEqual({
      kind: "null",
      path: ["a", "k"],
      raw: undefined,
      absent: true,
    });
  });
});

describe("isDisplayableNode", () => {
  it("descarta nulos, ausentes, colecciones vacías y textos en blanco", () => {
    expect(isDisplayableNode(buildFieldNode(null))).toBe(false);
    expect(isDisplayableNode(buildFieldNode(undefined))).toBe(false);
    expect(isDisplayableNode(buildFieldNode([]))).toBe(false);
    expect(isDisplayableNode(buildFieldNode({}))).toBe(false);
    expect(isDisplayableNode(buildFieldNode("  "))).toBe(false);
  });

  it("acepta escalares con contenido, incluidos cero y falso", () => {
    expect(isDisplayableNode(buildFieldNode("174"))).toBe(true);
    expect(isDisplayableNode(buildFieldNode(0))).toBe(true);
    expect(isDisplayableNode(buildFieldNode(false))).toBe(true);
  });

  it("evalúa de forma recursiva objetos y listas", () => {
    expect(isDisplayableNode(buildFieldNode({ a: null, b: { c: [] } }))).toBe(false);
    expect(isDisplayableNode(buildFieldNode({ a: null, b: { c: ["x"] } }))).toBe(true);
    expect(isDisplayableNode(buildFieldNode([null, {}, ""]))).toBe(false);
    expect(isDisplayableNode(buildFieldNode(textLabResults))).toBe(true);
  });
});
