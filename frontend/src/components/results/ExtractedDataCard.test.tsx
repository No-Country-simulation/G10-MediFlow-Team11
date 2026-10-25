import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ExtractedDataCard from "./ExtractedDataCard";
import type { ExtractedData } from "../../types/processing";

const processedDocument = {
  medications: [],
  patient: { age: 46, name: null },
  primary_diagnosis: null,
  requesting_doctor: { license_number: "DEMO-8456", name: "Dra. Sofía Vargas" },
  suggested_icd10: null,
  lab_results: [
    { name: "Glucosa en sangre", unit: "mg/dL", value: "174", reference_range: "70–99 mg/dL" },
    { name: "Hemoglobina glucosilada (HbA1c)", unit: "%", value: "8.2", reference_range: "inferior a 5.7 %" },
    { name: "Creatinina sérica", unit: "mg/dL", value: "0.86", reference_range: "0.6–1.1 mg/dL" },
  ],
  requested_studies: [],
} as ExtractedData;

function render(data: ExtractedData, missingFields?: string[]): string {
  return renderToStaticMarkup(<ExtractedDataCard data={data} missingFields={missingFields} />);
}

function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

interface ParsedTable {
  caption: string | null;
  headers: string[];
  rows: string[][];
  firstCellTags: string[];
}

function parseTables(html: string): ParsedTable[] {
  return [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map(([, table]) => {
    const caption = /<caption[^>]*>([\s\S]*?)<\/caption>/.exec(table)?.[1] ?? null;
    const head = /<thead>([\s\S]*?)<\/thead>/.exec(table)?.[1] ?? "";
    const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(table)?.[1] ?? "";
    const rows = [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(([, row]) => row);

    return {
      caption: caption === null ? null : plainText(caption),
      headers: [...head.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(([, cell]) => plainText(cell)),
      rows: rows.map((row) =>
        [...row.matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/g)].map(([, cell]) => plainText(cell)),
      ),
      firstCellTags: rows.map((row) => /^<(td|th)/.exec(row)?.[1] ?? ""),
    };
  });
}

function labels(html: string): string[] {
  return [...html.matchAll(/<span class="result-data__label">([\s\S]*?)<\/span>/g)].map(([, label]) =>
    plainText(label),
  );
}

describe("ExtractedDataCard — documento procesado con resultados de laboratorio", () => {
  const html = render(processedDocument, ["patient.name"]);

  it("muestra una tabla clínica con las columnas y los valores recibidos", () => {
    const tables = parseTables(html);

    expect(tables).toHaveLength(1);
    expect(tables[0].caption).toBe("Resultados de laboratorio");
    expect(tables[0].headers).toEqual(["Prueba", "Resultado", "Unidad", "Rango de referencia"]);
    expect(tables[0].rows).toEqual([
      ["Glucosa en sangre", "174", "mg/dL", "70–99 mg/dL"],
      ["Hemoglobina glucosilada (HbA1c)", "8.2", "%", "inferior a 5.7 %"],
      ["Creatinina sérica", "0.86", "mg/dL", "0.6–1.1 mg/dL"],
    ]);
  });

  it("usa la prueba como encabezado de fila y el resto como celdas", () => {
    expect(parseTables(html)[0].firstCellTags).toEqual(["th", "th", "th"]);
    expect(html).toContain('<th scope="row" data-label="Prueba">');
    expect(html).toContain('<td data-label="Resultado">');
    expect(html).toContain('<td data-label="Rango de referencia">');
  });

  it("mantiene las filas centrales y no inventa campos que no fueron informados", () => {
    expect(labels(html)).toEqual([
      "Paciente",
      "Edad",
      "Médico responsable",
      "N.º de colegiado / matrícula profesional",
      "Resultados de laboratorio",
    ]);
    expect(html).toContain("No identificado");
    expect(html).toContain("46 años");
    expect(html).toContain("Dra. Sofía Vargas");
    expect(html).toContain("DEMO-8456");
    expect(html).not.toContain("Diagnóstico principal");
    expect(html).not.toContain("Medicamentos");
    expect(html).not.toContain("Estudios solicitados");
    expect(html).not.toContain("result-data__empty");
  });

  it("no concatena los resultados en texto ni interpreta rangos", () => {
    expect(html).not.toContain("Test:");
    expect(html).not.toContain(" · ");
    expect(html).not.toMatch(/fuera de rango|alto|bajo|normal/i);
    expect(html.match(/174/g)).toHaveLength(1);
    expect(html).toContain(">8.2<");
    expect(html).toContain(">0.86<");
  });
});

describe("ExtractedDataCard — campos adicionales", () => {
  it("muestra measurements como etiquetas y valores", () => {
    const html = render({
      patient: { name: "Ana López" },
      measurements: { systolic: 120, diastolic: 80, unit: "mmHg" },
    } as ExtractedData);

    expect(labels(html)).toEqual(["Paciente", "Mediciones"]);
    expect(html).toContain('<dl class="result-fields">');
    expect([...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>/g)].map(([, text]) => plainText(text))).toEqual([
      "Presión sistólica",
      "Presión diastólica",
      "Unidad",
    ]);
    expect([...html.matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/g)].map(([, text]) => plainText(text))).toEqual([
      "120",
      "80",
      "mmHg",
    ]);
    expect(html).not.toContain("Presión sistólica: 120");
  });

  it("muestra los arrays de textos como lista", () => {
    const html = render({ allergies: ["penicilina", "aspirina"] } as ExtractedData);

    expect(labels(html)).toEqual(["Allergies"]);
    expect([...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(([, text]) => plainText(text.replace("•", "")))).toEqual([
      "penicilina",
      "aspirina",
    ]);
    expect(html).not.toContain("<table");
  });

  it("muestra otros arrays de objetos como tabla genérica con todas sus propiedades", () => {
    const html = render({
      procedures: [
        { procedure_name: "Biopsia", done: true, notes: null },
        { procedure_name: "Ecografía", site: "Abdomen", done: false },
      ],
    } as ExtractedData);
    const [table] = parseTables(html);

    expect(labels(html)).toEqual(["Procedures"]);
    expect(table.caption).toBe("Procedures");
    expect(table.headers).toEqual(["Procedure name", "Done", "Notes", "Site"]);
    expect(table.rows).toEqual([
      ["Biopsia", "Sí", "—", "—"],
      ["Ecografía", "No", "—", "Abdomen"],
    ]);
    expect(table.firstCellTags).toEqual(["td", "td"]);
    expect(html).not.toContain('scope="row"');
  });

  it("muestra tablas anidadas dentro de objetos sin perder propiedades", () => {
    const html = render({
      measurements: { unit: "mmHg", readings: [{ systolic: 128, diastolic: 82, taken_at: "08:00" }] },
    } as ExtractedData);
    const [table] = parseTables(html);

    expect(table.caption).toBe("Readings");
    expect(table.headers).toEqual(["Presión sistólica", "Presión diastólica", "Taken at"]);
    expect(table.rows).toEqual([["128", "82", "08:00"]]);
    expect(html).toContain("mmHg");
  });

  it("muestra escalares con el diseño de filas existente y los booleanos en español", () => {
    const html = render({
      custom_field: "valor corto",
      long_note: "x".repeat(60),
      a_flag: true,
      other_flag: false,
      count: 0,
    } as ExtractedData);

    expect(labels(html)).toEqual(["Custom field", "Long note", "A flag", "Other flag", "Count"]);
    expect(html.match(/result-data__row--inline/g)).toHaveLength(4);
    expect(html.match(/result-data__row--block/g)).toHaveLength(1);
    expect(html).toContain("<span>Sí</span>");
    expect(html).toContain("<span>No</span>");
    expect(html).toContain("<span>0</span>");
  });

  it("muestra — para valores nulos, ausentes o en blanco sin ocultar el campo", () => {
    const html = render({
      note: null,
      missing: undefined,
      blank: "   ",
      measurements: { systolic: 120, diastolic: null },
    } as ExtractedData);

    expect(labels(html)).toEqual(["Note", "Missing", "Blank", "Mediciones"]);
    expect(html.match(/<span class="result-data__empty" role="img" aria-label="Sin dato">—<\/span>/g)).toHaveLength(4);
  });

  it("oculta las colecciones adicionales vacías de primer nivel", () => {
    const html = render({
      patient: { name: "Ana López" },
      lab_results: [],
      measurements: {},
      empty_list: [],
      empty_object: {},
    } as ExtractedData);

    expect(labels(html)).toEqual(["Paciente"]);
    expect(html).not.toContain("Resultados de laboratorio");
    expect(html).not.toContain("Mediciones");
    expect(html).not.toContain("Sin elementos");
    expect(html).not.toContain("Sin datos");
    expect(html).not.toContain("<table");
  });

  it("no oculta campos con información, propiedades desconocidas ni valores nulos", () => {
    const html = render({
      lab_results: [],
      measurements: {},
      notes: null,
      blank: "  ",
      custom_flag: false,
      zero: 0,
      unknown_structure: { anidado: [] },
      allergies: ["penicilina"],
    } as ExtractedData);

    expect(labels(html)).toEqual([
      "Notes",
      "Blank",
      "Custom flag",
      "Zero",
      "Unknown structure",
      "Allergies",
    ]);
    expect(html.match(/aria-label="Sin dato"/g)).toHaveLength(2);
    expect(html).toContain("<span>No</span>");
    expect(html).toContain("<span>0</span>");
    expect(html).toContain("penicilina");
  });

  it("muestra de forma explícita las colecciones vacías anidadas", () => {
    const html = render({
      measurements: { unit: "mmHg", readings: [], extra: {} },
      lab_results: [{ name: "Glucosa", value: "174", notes: [] }],
    } as ExtractedData);

    expect(labels(html)).toEqual(["Mediciones", "Resultados de laboratorio"]);
    expect(html.match(/<span class="result-data__note">Sin elementos<\/span>/g)).toHaveLength(2);
    expect(html.match(/<span class="result-data__note">Sin datos<\/span>/g)).toHaveLength(1);
    expect(parseTables(html)[0].rows).toEqual([["Glucosa", "174", "—", "—", "Sin elementos"]]);
  });

  it("completa con — las celdas faltantes de las tablas", () => {
    const html = render({
      lab_results: [{ name: "Glucosa", value: "174" }, { name: "TSH" }],
      procedures: [{ procedure_name: "Biopsia" }, { site: "Abdomen" }],
    } as ExtractedData);
    const [clinical, generic] = parseTables(html);

    expect(clinical.rows).toEqual([
      ["Glucosa", "174", "—", "—"],
      ["TSH", "—", "—", "—"],
    ]);
    expect(generic.headers).toEqual(["Procedure name", "Site"]);
    expect(generic.rows).toEqual([
      ["Biopsia", "—"],
      ["—", "Abdomen"],
    ]);
  });

  it("usa alias para claves conocidas y el fallback para claves desconocidas", () => {
    const html = render({
      labResults: [{ nombre: "TSH", valor: "2.4", unidad: "mUI/L", referenceRange: "0.4–4.0 mUI/L" }],
      customKey: "dato",
      "Otra-Clave": { anidado: { profundo: ["a", { b: null }] } },
    } as ExtractedData);

    expect(labels(html)).toEqual(["Resultados de laboratorio", "Custom key", "Otra clave"]);
    expect(parseTables(html)[0].rows).toEqual([["TSH", "2.4", "mUI/L", "0.4–4.0 mUI/L"]]);
    expect(html).toContain("Anidado");
    expect(html).toContain("Profundo");
    expect(html).toContain("dato");
  });

  it("diferencia las colisiones de alias sin perder ninguna propiedad", () => {
    const html = render({
      measurements: { unit: "mmHg", unidad: "kPa" },
      lab_results: [{ name: "Glucosa", value: "174", unit: "mg/dL", unidad: "mmol/L" }],
    } as ExtractedData);
    const [table] = parseTables(html);

    expect([...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>/g)].map(([, text]) => plainText(text))).toEqual([
      "Unidad (unit)",
      "Unidad (unidad)",
    ]);
    expect(table.headers).toEqual([
      "Prueba",
      "Resultado",
      "Unidad (unit)",
      "Rango de referencia",
      "Unidad (unidad)",
    ]);
    expect(table.rows).toEqual([["Glucosa", "174", "mg/dL", "—", "mmol/L"]]);
    expect(html).toContain("mmHg");
    expect(html).toContain("kPa");
  });

  it("muestra los datos nulos de una tabla clínica como — en la celda correspondiente", () => {
    const html = render({
      lab_results: [{ name: "Glucosa", value: "174", unit: null }],
    } as ExtractedData);

    expect(parseTables(html)[0].rows).toEqual([["Glucosa", "174", "—", "—"]]);
  });

  it("escapa el contenido recibido", () => {
    const html = render({
      lab_results: [{ name: "<img src=x onerror=alert(1)>", value: "1 & 2" }],
      custom: "<b>negrita</b>",
    } as ExtractedData);

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("1 &amp; 2");
  });
});

describe("ExtractedDataCard — tarjeta vacía", () => {
  it("no renderiza nada cuando no hay filas centrales ni campos adicionales", () => {
    expect(render({})).toBe("");
    expect(
      render({
        patient: { name: null, age: null },
        primary_diagnosis: null,
        medications: [],
        requested_studies: [],
      }),
    ).toBe("");
  });

  it("renderiza la tarjeta cuando solo existen campos adicionales", () => {
    const html = render({ measurements: { systolic: 120 } } as ExtractedData);

    expect(html).toContain("Datos clínicos extraídos");
    expect(labels(html)).toEqual(["Mediciones"]);
  });
});
