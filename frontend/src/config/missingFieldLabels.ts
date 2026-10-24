const labels: Record<string, string> = {
  patient: "Paciente", "patient.name": "Nombre del paciente", "patient.age": "Edad del paciente",
  requesting_doctor: "Médico responsable", "requesting_doctor.name": "Médico responsable",
  "requesting_doctor.license_number": "N.º de colegiado / matrícula profesional",
  clinical_instructions: "Indicaciones clínicas", primary_diagnosis: "Diagnóstico principal",
  suggested_icd10: "Código CIE-10 sugerido", medications: "Medicamentos", requested_studies: "Estudios solicitados",
};

export function missingFieldLabel(field: string): string {
  const normalized = field.replace(/\[(\d+)\]/g, ".$1");
  const withoutIndexes = normalized.replace(/\.\d+(?=\.|$)/g, "");
  if (Object.hasOwn(labels, withoutIndexes)) return labels[withoutIndexes];
  if (withoutIndexes === "medications.name") return "Nombre del medicamento";
  if (withoutIndexes === "medications.dosage") return "Dosis del medicamento";
  if (withoutIndexes === "requested_studies.name") return "Nombre del estudio solicitado";
  const words = (withoutIndexes.split(".").at(-1) ?? "").replace(/_/g, " ").trim();
  if (!words || words.toLowerCase().includes("unknown") || words.startsWith("__")) return "Dato no identificado";
  return words.charAt(0).toUpperCase() + words.slice(1);
}
