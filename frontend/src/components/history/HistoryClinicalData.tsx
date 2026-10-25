import { FieldEntryValue } from "../results/ExtractedFieldValue";
import { buildAdditionalFields } from "../../utils/extractedFieldStructure";
import type { ExtractedData } from "../../types/processing";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface HistoryClinicalDataProps {
  extractedData: Record<string, unknown> | null;
}

function HistoryClinicalData({ extractedData }: HistoryClinicalDataProps) {
  const patient = isRecord(extractedData?.patient)
    ? extractedData.patient
    : null;

  const requestingDoctor = isRecord(extractedData?.requesting_doctor)
    ? extractedData.requesting_doctor
    : null;

  const clinicalGroups = [
    [
      {
        label: "Paciente",
        value: typeof patient?.name === "string" ? patient.name : null,
      },
      {
        label: "Edad",
        value:
          typeof patient?.age === "number" ? `${patient.age} años` : null,
      },
    ],
    [
      {
        label: "Médico",
        value:
          typeof requestingDoctor?.name === "string"
            ? requestingDoctor.name
            : null,
      },
      {
        label: "N.º de colegiado / matrícula profesional",
        value:
          typeof requestingDoctor?.license_number === "string"
            ? requestingDoctor.license_number
            : null,
      },
    ],
    [
      {
        label: "Diagnóstico principal",
        value:
          typeof extractedData?.primary_diagnosis === "string"
            ? extractedData.primary_diagnosis
            : null,
      },
      {
        label: "Código CIE-10",
        value:
          typeof extractedData?.suggested_icd10 === "string"
            ? extractedData.suggested_icd10
            : null,
      },
    ],
  ]
    .map((group) => group.filter((field) => field.value !== null))
    .filter((group) => group.length > 0);

  const medications = Array.isArray(extractedData?.medications)
    ? extractedData.medications.filter(isRecord)
    : [];

  const requestedStudies = Array.isArray(
    extractedData?.requested_studies,
  )
    ? extractedData.requested_studies.filter(isRecord)
    : [];

  const additionalFields = buildAdditionalFields(
    extractedData as ExtractedData | null,
    { omitEmptyCollections: true },
  ).entries;

  const hasContent = clinicalGroups.length > 0
    || medications.length > 0
    || requestedStudies.length > 0
    || additionalFields.length > 0;

  if (!extractedData || !hasContent) return null;

  return (
    <section className="history-page__detail-card history-page__detail-card--full history-page__detail-card--clinical">
      <h3 className="history-page__detail-card-title">
        Datos clínicos extraídos
      </h3>
      <div className="history-page__detail-card-body history-page__clinical-content">
        {clinicalGroups.length > 0 && (
          <div className="history-page__clinical-grid">
            {clinicalGroups.map((group) => (
              <div
                key={group[0].label}
                className="history-page__clinical-group"
              >
                {group.map((item) => (
                  <div
                    key={item.label}
                    className="history-page__detail-row history-page__detail-row--stacked"
                  >
                    <span className="history-page__detail-label">
                      {item.label}
                    </span>

                    <span className="history-page__detail-value">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {medications.length > 0 && (
          <div className="history-page__detail-row history-page__detail-row--stacked">
            <span className="history-page__detail-label">
              Medicamentos
            </span>

            <ul className="history-page__medication-list">
              {medications.map((medication, index) => {
                const name =
                  typeof medication.name === "string"
                    ? medication.name
                    : null;

                const dosage =
                  typeof medication.dosage === "string"
                    ? medication.dosage
                    : null;

                if (!name && !dosage) return null;

                return (
                  <li
                    key={index}
                    className="history-page__medication-item"
                  >
                    {[name, dosage]
                      .filter(Boolean)
                      .join(" ")}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {requestedStudies.length > 0 && (
          <div className="history-page__detail-row history-page__detail-row--stacked">
            <span className="history-page__detail-label">
              Estudios solicitados
            </span>

            <ul className="history-page__medication-list">
              {requestedStudies.map((study, index) => {
                if (
                  typeof study.name !== "string" ||
                  !study.name.trim()
                ) {
                  return null;
                }

                return (
                  <li
                    key={index}
                    className="history-page__medication-item"
                  >
                    {study.name}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {additionalFields.map((field) => (
          <div
            key={field.key}
            className="history-page__detail-row history-page__detail-row--stacked history-page__additional"
          >
            <span className="history-page__detail-label">
              {field.displayLabel}
            </span>

            <div className="history-page__detail-value">
              <FieldEntryValue entry={field} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default HistoryClinicalData;
