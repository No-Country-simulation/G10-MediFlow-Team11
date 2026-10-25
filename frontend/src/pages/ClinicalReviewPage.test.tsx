import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import ExtractedDataCard from "../components/results/ExtractedDataCard";
import type { ExtractedData, ProcessingResponse } from "../types/processing";
import { ReviewWorkspace } from "./ClinicalReviewPage";
import { changedFields, createReviewPatch } from "./clinicalReviewModel";

const DOCUMENT_ID = "DOC-781aa513-1e1c-41fc-a29c-95f17af0f067";

const labResults = [
  { name: "Glucosa en sangre", unit: "mg/dL", value: "174", reference_range: "70–99 mg/dL" },
  { name: "Hemoglobina glucosilada (HbA1c)", unit: "%", value: "8.2", reference_range: "inferior a 5.7 %" },
  { name: "Creatinina sérica", unit: "mg/dL", value: "0.86", reference_range: "0.6–1.1 mg/dL" },
];

function buildResult(extracted: ExtractedData, documentType: "STUDY_REPORT" | "PRESCRIPTION" = "STUDY_REPORT"): ProcessingResponse {
  return {
    document_id: DOCUMENT_ID,
    status: "NEEDS_AUDIT",
    classification: { document_type: documentType, specialty: "Laboratorio Clínico", priority_level: "ROUTINE" },
    confidence: { classification: 0.98, extraction: 0.95, global: 0.96 },
    extracted_data: extracted,
    validation: { inconsistencies: [], missing_fields: ["patient.name"], warnings: [] },
    routing_decision: {
      audit_reasons: ["MISSING_CRITICAL_FIELDS"],
      justification: "El informe carece del nombre del paciente.",
      primary_destination: "MEDICAL_RECORD",
      requires_human_review: true,
    },
    notification: { generated: false },
    storage: { provider: "OCI_OBJECT_STORAGE", state: "SUCCESS" },
  };
}

const storedExtraction = {
  medications: [],
  patient: { age: 46, name: null },
  primary_diagnosis: null,
  requesting_doctor: { license_number: "DEMO-8456", name: "Dra. Sofía Vargas" },
  suggested_icd10: null,
  lab_results: labResults,
  requested_studies: [],
} as ExtractedData;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function renderReview(result: ProcessingResponse): string {
  const router = createMemoryRouter(
    [
      {
        path: "/audit/:documentId/review",
        element: (
          <ReviewWorkspace
            result={result}
            viewer={{ status: "text", documentKey: result.document_id, text: "Texto original" }}
          />
        ),
      },
    ],
    { initialEntries: [`/audit/${DOCUMENT_ID}/review`] },
  );
  return renderToStaticMarkup(<RouterProvider router={router} />);
}

function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function decode(value: string): string {
  return value.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&");
}

function cellContent(cell: string): string {
  const input = /<input[^>]*\svalue="([^"]*)"/.exec(cell);
  return input ? decode(input[1]) : plainText(cell);
}

function parseTables(html: string): { headers: string[]; rows: string[][] }[] {
  return [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map(([, table]) => {
    const head = /<thead>([\s\S]*?)<\/thead>/.exec(table)?.[1] ?? "";
    const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(table)?.[1] ?? "";
    return {
      headers: [...head.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(([, cell]) => plainText(cell)),
      rows: [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
        [...row.matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/g)].map(([, cell]) => cellContent(cell)),
      ),
    };
  });
}

function structuredHtml(html: string): string {
  const start = html.indexOf('<div class="clinical-review__structured">');
  if (start < 0) return "";
  const end = html.indexOf('<section id="review-validation"', start);
  return html.slice(start, end < 0 ? undefined : end);
}

function structuredLabels(html: string): string[] {
  return [...structuredHtml(html).matchAll(/<h5 class="clinical-review__structured-label">([\s\S]*?)<\/h5>/g)].map(
    ([, label]) => plainText(label),
  );
}

function controlLabels(html: string): string[] {
  return [...structuredHtml(html).matchAll(/<(?:input|select|textarea)[^>]*aria-label="([^"]*)"/g)].map(([, label]) => decode(label));
}

describe("Revisión clínica — resultados de laboratorio", () => {
  const html = renderReview(buildResult(storedExtraction));

  it("muestra los tres resultados de LAB-SYN-047 en una tabla clínica editable", () => {
    const tables = parseTables(structuredHtml(html));

    expect(structuredLabels(html)).toEqual(["Resultados de laboratorio"]);
    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(["Prueba", "Resultado", "Unidad", "Rango de referencia", "Acciones"]);
    expect(tables[0].rows).toEqual([
      ["Glucosa en sangre", "174", "mg/dL", "70–99 mg/dL", "Eliminar fila"],
      ["Hemoglobina glucosilada (HbA1c)", "8.2", "%", "inferior a 5.7 %", "Eliminar fila"],
      ["Creatinina sérica", "0.86", "mg/dL", "0.6–1.1 mg/dL", "Eliminar fila"],
    ]);
  });

  it("ofrece un control accesible por celda, eliminar fila y agregar resultado", () => {
    const block = structuredHtml(html);

    expect(controlLabels(html)).toHaveLength(12);
    expect(controlLabels(html).slice(0, 4)).toEqual(["Prueba, fila 1", "Resultado, fila 1", "Unidad, fila 1", "Rango de referencia, fila 1"]);
    expect(block).toContain('aria-label="Eliminar fila 3 de resultados de laboratorio"');
    expect(block).toContain("Agregar resultado");
    expect(block).not.toContain("incompletas antes de aprobar");
    expect(block).not.toMatch(/<textarea\b/);
  });

  it("no expone JSON, nombres técnicos de propiedades ni una segunda forma de editar", () => {
    expect(html).not.toContain("Edición técnica avanzada");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("Otros datos");
    expect(html).not.toContain("formato JSON");
    expect(html).not.toContain("lab_results");
    expect(html).not.toContain("&quot;name&quot;");
  });

  it("usa las mismas etiquetas, columnas y valores que Resultado", () => {
    const card = renderToStaticMarkup(<ExtractedDataCard data={storedExtraction} missingFields={["patient.name"]} />);
    const [editable] = parseTables(structuredHtml(html));
    const [readOnly] = parseTables(card);

    expect(editable.headers.slice(0, 4)).toEqual(readOnly.headers);
    expect(editable.rows.map((row) => row.slice(0, 4))).toEqual(readOnly.rows);
  });

  it("conserva los campos editables estándar con sus valores actuales", () => {
    expect(html).toContain('value="Dra. Sofía Vargas"');
    expect(html).toContain('value="DEMO-8456"');
    expect(html).toContain('value="46"');
    expect(html).toContain("Agregar medicamento");
    expect(html).toContain("Agregar estudio");
  });

  it("usa la clave original del alias y conserva las propiedades desconocidas de cada fila", () => {
    const aliased = renderReview(buildResult({
      patient: { name: "Ana" },
      labResults: [{ nombre: "Glucosa", valor: "174", unidad: "mg/dL", referenceRange: "70–99", flag: "alto" }],
    } as ExtractedData));
    const [table] = parseTables(structuredHtml(aliased));

    expect(table.headers).toEqual(["Prueba", "Resultado", "Unidad", "Rango de referencia", "Flag", "Acciones"]);
    expect(table.rows).toEqual([["Glucosa", "174", "mg/dL", "70–99", "alto", "Eliminar fila"]]);
    expect(structuredLabels(aliased)).toEqual(["Resultados de laboratorio"]);
  });

  it("usa un control acorde al tipo original: decimal para números y selector para booleanos", () => {
    const html = renderReview(buildResult({
      lab_results: [{ name: "Glucosa", value: 174, unit: "mg/dL", ayuno: true, nota: null }],
    } as ExtractedData));

    expect(html).toMatch(/<input[^>]*inputMode="decimal"[^>]*aria-label="Resultado, fila 1"|<input[^>]*aria-label="Resultado, fila 1"[^>]*inputMode="decimal"/);
    expect(html).not.toMatch(/<input[^>]*inputMode="decimal"[^>]*aria-label="Prueba, fila 1"/);
    expect(html).toMatch(/<select[^>]*aria-label="Ayuno, fila 1"[\s\S]*?<option value="true" selected="">Sí<\/option>[\s\S]*?<option value="">Sin valor<\/option>/);
    expect(html).not.toContain("aria-invalid");
  });

  it("muestra valores no editables dentro de una celda sin convertirlos en texto", () => {
    const nested = renderReview(buildResult({
      lab_results: [{ name: "Glucosa", value: "174", detalle: { a: 1 } }],
    } as ExtractedData));

    expect(nested).toContain('aria-label="Prueba, fila 1"');
    expect(nested).not.toContain('aria-label="Detalle, fila 1"');
    expect(nested).toContain("result-fields");
  });
});

describe("Revisión clínica — primer resultado de laboratorio", () => {
  it.each([
    ["lista vacía", { patient: { name: "Ana" }, lab_results: [] }],
    ["clave ausente", { patient: { name: "Ana" } }],
    ["valor nulo", { patient: { name: "Ana" }, lab_results: null }],
  ])("permite agregar el primero en un informe de estudio con %s", (_name, data) => {
    const html = renderReview(buildResult(data as ExtractedData));

    expect(html).toContain("Sin resultados de laboratorio registrados");
    expect(html).toContain("Agregar resultado");
    expect(structuredLabels(html)).toEqual(["Resultados de laboratorio"]);
  });

  it("no llena documentos sin laboratorio con controles innecesarios", () => {
    const prescription = renderReview(buildResult({ patient: { name: "Ana" }, lab_results: [] } as ExtractedData, "PRESCRIPTION"));

    expect(prescription).not.toContain("clinical-review__lab-editor");
    expect(prescription).not.toContain("Agregar resultado");
    expect(prescription).not.toContain("Datos adicionales");
  });

  it("no muestra un campo de texto para un lab_results nulo en un documento sin laboratorio", () => {
    const html = renderReview(buildResult({ patient: { name: "Ana" }, labResults: null } as ExtractedData, "PRESCRIPTION"));

    expect(html).not.toContain("Resultados de laboratorio");
    expect(html).not.toContain("clinical-review__structured");
  });

  it("mantiene el editor de un documento con resultados aunque no sea informe de estudio", () => {
    const html = renderReview(buildResult(storedExtraction, "PRESCRIPTION"));

    expect(controlLabels(html)).toHaveLength(12);
  });
});

describe("Revisión clínica — otros datos adicionales editables", () => {
  const extraction = {
    patient: { name: "Ana López", age: 46 },
    measurements: { systolic: 128, diastolic: 82, unit: "mmHg", active: true, note: null },
    custom_key: "valor desconocido",
    nothing: null,
    allergies: ["penicilina", "aspirina"],
    procedures: [{ procedure_name: "Biopsia", done: true }, { site: "Abdomen" }],
    mixed: ["a", { b: 1 }],
    unknown_structure: { anidado: { profundo: [1, "x", { b: null }] }, vacio: [] },
    long_note: "x".repeat(90),
    lab_results: [],
    empty_object: {},
  } as ExtractedData;
  const html = renderReview(buildResult(extraction, "PRESCRIPTION"));

  it("muestra cada campo con su etiqueta humanizada y oculta las colecciones vacías de primer nivel", () => {
    expect(structuredLabels(html)).toEqual([
      "Mediciones", "Custom key", "Nothing", "Allergies", "Procedures", "Mixed", "Unknown structure", "Long note",
    ]);
  });

  it("usa controles apropiados al tipo de cada valor", () => {
    expect(html).toMatch(/<input type="number"[^>]*value="128"[^>]*aria-label="Mediciones, Presión sistólica"|<input[^>]*aria-label="Mediciones, Presión sistólica"[^>]*value="128"/);
    expect(html).toContain('aria-label="Mediciones, Active"');
    expect(html).toMatch(/<select[^>]*aria-label="Mediciones, Active"[\s\S]*?<option value="true" selected="">Sí<\/option>/);
    expect(html).toMatch(/<input[^>]*value="mmHg"[^>]*aria-label="Mediciones, Unidad"|<input[^>]*aria-label="Mediciones, Unidad"[^>]*value="mmHg"/);
    expect(html).toContain('aria-label="Custom key"');
    expect(html).toMatch(/<textarea[^>]*aria-label="Long note"[^>]*>x{90}<\/textarea>/);
    expect(controlLabels(html)).toContain("Allergies, elemento 2");
    expect(controlLabels(html)).toContain("Mediciones, Note");
  });

  it("muestra tablas editables para listas de objetos y conserva sus propiedades", () => {
    const table = parseTables(structuredHtml(html)).find((candidate) => candidate.headers.includes("Procedure name"))!;

    expect(table.headers).toEqual(["Procedure name", "Done", "Site"]);
    expect(table.rows.map((row) => [row[0], row[2]])).toEqual([["Biopsia", ""], ["", "Abdomen"]]);
    expect(controlLabels(html)).toContain("Procedures, Procedure name, fila 1");
    expect(controlLabels(html)).toContain("Procedures, Done, fila 1");
    expect(html).toMatch(/<select[^>]*aria-label="Procedures, Done, fila 1"[\s\S]*?<option value="true" selected="">Sí<\/option>/);
  });

  it("conserva la visualización de estructuras mixtas y anidadas sin convertirlas en JSON", () => {
    const block = structuredHtml(html);

    expect(block).toContain("Anidado");
    expect(block).toContain("Profundo");
    expect(block).toContain("Sin elementos");
    expect(block).toContain("result-data__list");
    expect(controlLabels(html).some((label) => label.startsWith("Mixed"))).toBe(false);
    expect(html).not.toContain("<details");
    expect(html).not.toMatch(/\[\s*\{|&quot;b&quot;/);
  });

  it("oculta el grupo cuando solo hay colecciones vacías y no es un informe de estudio", () => {
    const onlyEmpty = renderReview(buildResult({ patient: { name: "Ana" }, lab_results: [], measurements: {} } as ExtractedData, "PRESCRIPTION"));

    expect(onlyEmpty).not.toContain("clinical-review__structured");
    expect(onlyEmpty).not.toContain("Datos adicionales");
  });

  it("no muestra grupos adicionales cuando no hay campos adicionales", () => {
    expect(renderReview(buildResult({ patient: { name: "Ana" } }, "PRESCRIPTION"))).not.toContain("clinical-review__structured");
  });

  it("no ofrece edición para claves que podrían alterar el prototipo", () => {
    const unsafe = renderReview(buildResult(JSON.parse('{"patient":{"name":"Ana"},"__proto__":{"x":"1"}}') as ExtractedData, "PRESCRIPTION"));

    expect(unsafe).not.toContain('aria-label="Proto');
    expect(unsafe).not.toContain('aria-label="X');
  });
});

describe("Revisión clínica — apertura sin cambios reales", () => {
  const validationOrders: [string, ProcessingResponse["validation"]][] = [
    ["orden alfabético del Backend", { inconsistencies: [], missing_fields: ["patient.name"], warnings: [] }],
    ["orden del estado de la pantalla", { missing_fields: ["patient.name"], inconsistencies: [], warnings: [] }],
    ["orden invertido", { warnings: [], inconsistencies: [], missing_fields: ["patient.name"] }],
  ];

  it.each(validationOrders)("mantiene el estado limpio al abrir con validation en %s", (_name, validation) => {
    const html = renderReview({ ...buildResult(storedExtraction), validation });
    const pendingIndicator = /<div class="clinical-review__action-context">[\s\S]*?<span[^>]*>([^<]*)<\/span><\/div>/.exec(html)![1];

    expect(pendingIndicator).toBe("");
    expect(html).not.toContain("Cambios sin registrar");
    expect(html).not.toContain("Validación confirmada");
    expect(html).not.toContain("clinical-review__pending-confirmation");
  });

  it.each(validationOrders)("exige confirmar la validación al abrir con validation en %s", (_name, validation) => {
    const html = renderReview({ ...buildResult(storedExtraction), validation });
    const help = /<p id="clinical-approval-help"[^>]*>([\s\S]*?)<\/p>/.exec(html)![1];

    expect(help).toBe("Para aprobar: Confirme la validación revisada.");
    expect(html).toContain("Ir a validación");
    expect(html).toMatch(/<button[^>]*class="clinical-review__approve"[^>]*disabled/);
    expect(html).toMatch(/<input type="checkbox"\/>Validación revisada/);
  });

  it("no modifica los datos recibidos al renderizar la pantalla", () => {
    const frozen = deepFreeze(buildResult(structuredClone(storedExtraction)));
    const snapshot = structuredClone(frozen);

    expect(() => renderReview(frozen)).not.toThrow();
    expect(frozen).toEqual(snapshot);
    expect(frozen.extracted_data?.lab_results).toEqual(labResults);
  });

  it("sigue exigiendo confirmar la validación cuando el documento no tiene validación", () => {
    const html = renderReview({ ...buildResult(storedExtraction), validation: null });

    expect(html).not.toContain("Cambios sin registrar");
    expect(html).toContain("Para aprobar: Confirme la validación revisada.");
  });
});

describe("Revisión clínica — medicamentos y estudios solicitados", () => {
  it("muestra estados vacíos comprensibles y conserva los botones de agregar", () => {
    const html = renderReview(buildResult(storedExtraction));

    expect(html).toContain('<p class="clinical-review__empty">Sin medicamentos registrados</p>');
    expect(html).toContain('<p class="clinical-review__empty">Sin estudios solicitados</p>');
    expect(html).toContain("Agregar medicamento");
    expect(html).toContain("Agregar estudio");
  });

  it("no muestra los estados vacíos cuando existen elementos", () => {
    const html = renderReview(buildResult({
      medications: [{ name: "Metformina", dosage: "850 mg" }],
      requested_studies: [{ name: "Hemograma" }],
    }));

    expect(html).not.toContain("Sin medicamentos registrados");
    expect(html).not.toContain("Sin estudios solicitados");
    expect(html).toContain('value="Metformina"');
    expect(html).toContain('value="Hemograma"');
  });
});

describe("Revisión clínica — la presentación no altera datos ni PATCH", () => {
  const result = buildResult(storedExtraction);

  const patchFor = (decision: "APPROVE" | "REJECT", extracted: ExtractedData) =>
    createReviewPatch({
      decision, result, documentType: "STUDY_REPORT", priority: "ROUTINE", specialty: "Laboratorio Clínico",
      destination: "MEDICAL_RECORD", extracted, validation: structuredClone(result.validation!), confirmed: true,
    });

  it("sin acciones de edición no existe cambio en extracted_data ni en el PATCH", () => {
    for (const decision of ["APPROVE", "REJECT"] as const) {
      const request = patchFor(decision, structuredClone(storedExtraction));
      expect(request).toEqual({ decision });
      expect(request.extracted_data).toBeUndefined();
    }
    expect(changedFields(storedExtraction, structuredClone(storedExtraction))).toEqual({});
  });
});
