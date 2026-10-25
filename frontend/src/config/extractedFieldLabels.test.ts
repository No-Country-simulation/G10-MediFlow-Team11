import { describe, expect, it } from "vitest";
import {
  EXTRACTED_FIELD_DEFINITIONS,
  fieldLabel,
  humanizeFieldKey,
  normalizeFieldKey,
  resolveFieldLabel,
} from "./extractedFieldLabels";

describe("fieldLabel", () => {
  it.each([
    ["lab_results", "Resultados de laboratorio"],
    ["measurements", "Mediciones"],
    ["name", "Nombre"],
    ["value", "Valor"],
    ["unit", "Unidad"],
    ["reference_range", "Intervalo de referencia"],
    ["systolic", "Presión sistólica"],
    ["diastolic", "Presión diastólica"],
  ])("traduce la clave conocida %s", (key, label) => {
    expect(fieldLabel(key)).toBe(label);
    expect(resolveFieldLabel(key)).toEqual({ label, canonicalKey: key, known: true });
  });

  it.each([
    ["labResults", "lab_results"],
    ["LabResults", "lab_results"],
    ["laboratory_results", "lab_results"],
    ["resultados_de_laboratorio", "lab_results"],
    ["referenceRange", "reference_range"],
    ["Reference-Range", "reference_range"],
    ["reference range", "reference_range"],
    ["ref_range", "reference_range"],
    ["rango de referencia", "reference_range"],
    ["units", "unit"],
    ["unidad", "unit"],
    ["nombre", "name"],
    ["valor", "value"],
    ["sistólica", "systolic"],
    ["systolicBP", "systolic"],
    ["presión_diastólica", "diastolic"],
    ["mediciones", "measurements"],
  ])("resuelve el alias %s hacia %s", (alias, canonicalKey) => {
    const resolved = resolveFieldLabel(alias);
    expect(resolved.known).toBe(true);
    expect(resolved.canonicalKey).toBe(canonicalKey);
    expect(resolved.label).toBe(fieldLabel(canonicalKey));
  });

  it("no define el mismo alias para dos claves canónicas", () => {
    const owners = new Map<string, string>();
    for (const definition of EXTRACTED_FIELD_DEFINITIONS) {
      for (const candidate of [definition.key, ...(definition.aliases ?? [])]) {
        const normalized = normalizeFieldKey(candidate);
        const previous = owners.get(normalized);
        expect(previous === undefined || previous === definition.key).toBe(true);
        owners.set(normalized, definition.key);
      }
    }
  });

  it("no define claves canónicas duplicadas", () => {
    const keys = EXTRACTED_FIELD_DEFINITIONS.map((definition) => definition.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("humaniza las claves desconocidas sin marcarlas como conocidas", () => {
    expect(resolveFieldLabel("custom_field")).toEqual({
      label: "Custom field",
      canonicalKey: null,
      known: false,
    });
  });

  it.each(["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"])(
    "trata %s como una clave desconocida y devuelve texto",
    (key) => {
      const resolved = resolveFieldLabel(key);
      expect(typeof resolved.label).toBe("string");
      expect(resolved.known).toBe(false);
      expect(resolved.canonicalKey).toBeNull();
    },
  );
});

describe("humanizeFieldKey", () => {
  it.each([
    ["custom_field", "Custom field"],
    ["another_number", "Another number"],
    ["a_boolean", "A boolean"],
    ["allergies", "Allergies"],
    ["customField", "Custom field"],
    ["CustomField", "Custom field"],
    ["heartRateBPM", "Heart rate BPM"],
    ["XMLHttpRequest", "XML http request"],
    ["TSH_level", "TSH level"],
    ["TSH", "TSH"],
    ["HEART_RATE", "Heart rate"],
    ["glucose-level", "Glucose level"],
    ["glucose.level", "Glucose level"],
    ["glucose  level", "Glucose level"],
    ["__private_field__", "Private field"],
    ["sf36Score", "Sf36 score"],
    ["presión_arterial_media", "Presión arterial media"],
    ["ÁreaClínica", "Área clínica"],
    ["0", "0"],
  ])("convierte %s en %s", (key, expected) => {
    expect(humanizeFieldKey(key)).toBe(expected);
  });

  it("no oculta claves que no contienen letras ni números", () => {
    expect(humanizeFieldKey("???")).toBe("???");
  });

  it("usa un texto de respaldo para claves vacías", () => {
    expect(humanizeFieldKey("")).toBe("Dato sin nombre");
    expect(humanizeFieldKey("   ")).toBe("Dato sin nombre");
  });
});

describe("normalizeFieldKey", () => {
  it("unifica snake_case, camelCase, kebab-case, espacios y acentos", () => {
    const variants = [
      "reference_range",
      "referenceRange",
      "ReferenceRange",
      "reference-range",
      "reference range",
      "REFERENCE_RANGE",
    ];
    expect(new Set(variants.map(normalizeFieldKey))).toEqual(new Set(["reference_range"]));
    expect(normalizeFieldKey("Presión Sistólica")).toBe("presion_sistolica");
  });
});
