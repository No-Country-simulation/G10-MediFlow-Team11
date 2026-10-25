export interface ExtractedFieldDefinition {
  readonly key: string;
  readonly label: string;
  readonly aliases?: readonly string[];
}

export interface ResolvedFieldLabel {
  readonly label: string;
  readonly canonicalKey: string | null;
  readonly known: boolean;
}

export const EXTRACTED_FIELD_DEFINITIONS: readonly ExtractedFieldDefinition[] = [
  { key: "patient", label: "Paciente", aliases: ["paciente"] },
  { key: "age", label: "Edad", aliases: ["edad"] },
  {
    key: "requesting_doctor",
    label: "Médico responsable",
    aliases: ["medico_solicitante", "medico_responsable"],
  },
  {
    key: "license_number",
    label: "N.º de colegiado / matrícula profesional",
    aliases: ["matricula", "numero_de_colegiado"],
  },
  {
    key: "primary_diagnosis",
    label: "Diagnóstico principal",
    aliases: ["diagnostico_principal"],
  },
  {
    key: "suggested_icd10",
    label: "Código CIE-10 sugerido",
    aliases: ["suggested_icd_10", "codigo_cie10_sugerido"],
  },
  { key: "medications", label: "Medicamentos", aliases: ["medicamentos"] },
  { key: "dosage", label: "Dosis", aliases: ["dose", "dosis"] },
  {
    key: "requested_studies",
    label: "Estudios solicitados",
    aliases: ["estudios_solicitados"],
  },
  {
    key: "lab_results",
    label: "Resultados de laboratorio",
    aliases: [
      "laboratory_results",
      "resultados_de_laboratorio",
      "resultados_laboratorio",
    ],
  },
  {
    key: "measurements",
    label: "Mediciones",
    aliases: ["measurement", "mediciones", "medicion"],
  },
  { key: "name", label: "Nombre", aliases: ["nombre", "test_name"] },
  { key: "value", label: "Valor", aliases: ["valor"] },
  { key: "unit", label: "Unidad", aliases: ["units", "unidad", "unidades"] },
  {
    key: "reference_range",
    label: "Intervalo de referencia",
    aliases: [
      "reference_interval",
      "ref_range",
      "rango_de_referencia",
      "rango_referencia",
      "intervalo_de_referencia",
      "intervalo_referencia",
    ],
  },
  {
    key: "systolic",
    label: "Presión sistólica",
    aliases: ["systolic_pressure", "systolic_bp", "sistolica", "presion_sistolica"],
  },
  {
    key: "diastolic",
    label: "Presión diastólica",
    aliases: [
      "diastolic_pressure",
      "diastolic_bp",
      "diastolica",
      "presion_diastolica",
    ],
  },
  {
    key: "blood_pressure",
    label: "Presión arterial",
    aliases: ["presion_arterial"],
  },
  {
    key: "heart_rate",
    label: "Frecuencia cardíaca",
    aliases: ["frecuencia_cardiaca"],
  },
  {
    key: "respiratory_rate",
    label: "Frecuencia respiratoria",
    aliases: ["frecuencia_respiratoria"],
  },
  {
    key: "temperature",
    label: "Temperatura",
    aliases: ["temperatura", "body_temperature"],
  },
  {
    key: "oxygen_saturation",
    label: "Saturación de oxígeno",
    aliases: ["spo2", "saturacion_de_oxigeno", "saturacion_oxigeno"],
  },
  { key: "weight", label: "Peso", aliases: ["peso"] },
  { key: "height", label: "Estatura", aliases: ["altura", "talla", "estatura"] },
];

const UNNAMED_FIELD_LABEL = "Dato sin nombre";
const MAX_ACRONYM_LENGTH = 5;

export function normalizeFieldKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1_$2")
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1_$2")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

function buildDefinitionIndex(): ReadonlyMap<string, ExtractedFieldDefinition> {
  const index = new Map<string, ExtractedFieldDefinition>();
  for (const definition of EXTRACTED_FIELD_DEFINITIONS) {
    for (const candidate of [definition.key, ...(definition.aliases ?? [])]) {
      const normalized = normalizeFieldKey(candidate);
      if (!index.has(normalized)) index.set(normalized, definition);
    }
  }
  return index;
}

const definitionIndex = buildDefinitionIndex();

function isAcronym(word: string): boolean {
  return (
    word.length > 1 &&
    word.length <= MAX_ACRONYM_LENGTH &&
    /\p{Lu}/u.test(word) &&
    word === word.toUpperCase()
  );
}

export function humanizeFieldKey(key: string): string {
  const words = key
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1 $2")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);

  if (words.length === 0) return key.trim() || UNNAMED_FIELD_LABEL;

  const keepAcronyms = /\p{Ll}/u.test(key) || words.length === 1;
  const [first, ...rest] = words.map((word) =>
    keepAcronyms && isAcronym(word) ? word : word.toLowerCase(),
  );

  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

export function resolveFieldLabel(key: string): ResolvedFieldLabel {
  const definition = definitionIndex.get(normalizeFieldKey(key));
  if (definition) {
    return { label: definition.label, canonicalKey: definition.key, known: true };
  }
  return { label: humanizeFieldKey(key), canonicalKey: null, known: false };
}

export function fieldLabel(key: string): string {
  return resolveFieldLabel(key).label;
}
