import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HistoryClinicalData from "./HistoryClinicalData";

const labResults = [
  { name: "Glucosa en sangre", unit: "mg/dL", value: "174", reference_range: "70–99 mg/dL" },
  { name: "Hemoglobina glucosilada (HbA1c)", unit: "%", value: "8.2", reference_range: "inferior a 5.7 %" },
  { name: "Creatinina sérica", unit: "mg/dL", value: "0.86", reference_range: "0.6–1.1 mg/dL" },
];

const lab047 = {
  medications: [],
  patient: { age: 46, name: null },
  primary_diagnosis: null,
  requesting_doctor: { license_number: "DEMO-8456", name: "Dra. Sofía Vargas" },
  suggested_icd10: null,
  lab_results: labResults,
  requested_studies: [],
};

function render(data: Record<string, unknown> | null): string {
  return renderToStaticMarkup(<HistoryClinicalData extractedData={data} />);
}

function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function tables(html: string): { caption: string | null; headers: string[]; rows: string[][] }[] {
  return [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map(([, table]) => {
    const caption = /<caption[^>]*>([\s\S]*?)<\/caption>/.exec(table)?.[1] ?? null;
    const head = /<thead>([\s\S]*?)<\/thead>/.exec(table)?.[1] ?? "";
    const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(table)?.[1] ?? "";
    return {
      caption: caption === null ? null : plainText(caption),
      headers: [...head.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(([, cell]) => plainText(cell)),
      rows: [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
        [...row.matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/g)].map(([, cell]) => plainText(cell)),
      ),
    };
  });
}

function labels(html: string): string[] {
  return [...html.matchAll(/<span class="history-page__detail-label">([\s\S]*?)<\/span>/g)].map(([, label]) => plainText(label));
}

describe("HistoryClinicalData — LAB-SYN-047", () => {
  const html = render(lab047);

  it("muestra los tres resultados completos en una tabla de Resultados de laboratorio", () => {
    const [table] = tables(html);

    expect(tables(html)).toHaveLength(1);
    expect(table.caption).toBe("Resultados de laboratorio");
    expect(table.headers).toEqual(["Prueba", "Resultado", "Unidad", "Rango de referencia"]);
    expect(table.rows).toEqual([
      ["Glucosa en sangre", "174", "mg/dL", "70–99 mg/dL"],
      ["Hemoglobina glucosilada (HbA1c)", "8.2", "%", "inferior a 5.7 %"],
      ["Creatinina sérica", "0.86", "mg/dL", "0.6–1.1 mg/dL"],
    ]);
  });

  it("conserva la información que el Historial ya mostraba", () => {
    expect(labels(html)).toEqual([
      "Edad",
      "Médico",
      "N.º de colegiado / matrícula profesional",
      "Resultados de laboratorio",
    ]);
    expect(html).toContain("46 años");
    expect(html).toContain("Dra. Sofía Vargas");
    expect(html).toContain("DEMO-8456");
    expect(html).toContain("Datos clínicos extraídos");
  });

  it("es de solo lectura", () => {
    expect(html).not.toMatch(/<(input|textarea|select|button)\b/);
  });
});

describe("HistoryClinicalData — datos adicionales", () => {
  const data = {
    patient: { name: "Ana López", age: 58 },
    medications: [{ name: "Amoxicilina", dosage: "875 mg" }, { name: null, dosage: null }],
    requested_studies: [{ name: "Hemograma" }, { name: "  " }],
    measurements: { systolic: 128, diastolic: 82, unit: "mmHg" },
    custom_key: "valor desconocido",
    nothing: null,
    blank: "",
    a_flag: true,
    allergies: ["penicilina", "aspirina"],
    procedures: [{ procedure_name: "Biopsia", notes: null }, { site: "Abdomen" }],
    unknown_structure: { anidado: { profundo: [1, "x", { b: null }] } },
    empty_list: [],
    empty_object: {},
  };
  const html = render(data);

  it("conserva paciente, medicamentos y estudios solicitados", () => {
    expect(html).toContain("Ana López");
    expect(html).toContain("58 años");
    expect(html).toContain("Amoxicilina 875 mg");
    expect(html).toContain("Hemograma");
    expect(labels(html)).toContain("Medicamentos");
    expect(labels(html)).toContain("Estudios solicitados");
  });

  it("muestra measurements y otras estructuras con las etiquetas y formatos compartidos", () => {
    expect(labels(html)).toEqual(expect.arrayContaining([
      "Mediciones", "Custom key", "Nothing", "Blank", "A flag", "Allergies", "Procedures", "Unknown structure",
    ]));
    expect([...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>/g)].slice(0, 3).map(([, text]) => plainText(text))).toEqual([
      "Presión sistólica", "Presión diastólica", "Unidad",
    ]);
    expect(html).toContain("valor desconocido");
    expect(html).toContain("<span>Sí</span>");
    expect(html).toContain("penicilina");
    expect(html).toContain("Anidado");
    expect(html).toContain("Profundo");
  });

  it("muestra — para nulos y en blanco, tablas con celdas faltantes y oculta solo colecciones vacías de primer nivel", () => {
    const [procedures] = tables(html);

    expect(procedures.headers).toEqual(["Procedure name", "Notes", "Site"]);
    expect(procedures.rows).toEqual([["Biopsia", "—", "—"], ["—", "—", "Abdomen"]]);
    expect(html.match(/aria-label="Sin dato"/g)!.length).toBeGreaterThanOrEqual(4);
    expect(labels(html)).not.toContain("Empty list");
    expect(labels(html)).not.toContain("Empty object");
  });

  it("no pierde información: todo valor adicional aparece y los datos recibidos no cambian", () => {
    const frozen = structuredClone(data);
    const snapshot = structuredClone(data);
    const deepFreeze = (value: unknown): void => {
      if (value && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value).forEach(deepFreeze);
      }
    };
    deepFreeze(frozen);

    const output = render(frozen);

    expect(frozen).toEqual(snapshot);
    for (const text of ["128", "82", "mmHg", "valor desconocido", "penicilina", "aspirina", "Biopsia", "Abdomen", "x"]) {
      expect(output).toContain(text);
    }
  });

  it("sin datos o sin contenido no renderiza la tarjeta", () => {
    expect(render(null)).toBe("");
    expect(render({})).toBe("");
    expect(render({ patient: { name: null, age: null }, medications: [], requested_studies: [], lab_results: [] })).toBe("");
  });

  it("muestra la tarjeta cuando solo existen campos adicionales", () => {
    const only = render({ measurements: { systolic: 120 } });

    expect(only).toContain("Datos clínicos extraídos");
    expect(labels(only)).toEqual(["Mediciones"]);
  });
});

describe("HistoryPage — pestaña JSON", () => {
  const source = readFileSync(new URL("../../pages/HistoryPage.tsx", import.meta.url), "utf8");

  it("sigue mostrando el snapshot original del evento sin traducciones", () => {
    expect(source).toContain("JSON.stringify(entry.result, null, 2)");
    expect(source).not.toMatch(/JSON\.stringify\([^)]*(additionalFields|buildAdditionalFields|displayLabel)/);
  });
});
