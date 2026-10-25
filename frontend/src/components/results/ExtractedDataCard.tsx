import { useId } from "react";
import type { ExtractedData, Validation } from "../../types/processing";
import { buildAdditionalFields } from "../../utils/extractedFieldStructure";
import { buildExtractedDataRows, type DataRow } from "./extractedDataRows";
import { FieldEntryValue } from "./ExtractedFieldValue";
import { getDataRowLayout, getFieldRowLayout } from "./resultPresentation";

interface ExtractedDataCardProps {
  data: ExtractedData;
  missingFields?: Validation["missing_fields"];
}

function DataRowValue({ value }: { value: DataRow["value"] }) {
  if (Array.isArray(value)) {
    return (
      <ul className="result-data__list">
        {value.map((item, index) => (
          <li key={`${item}-${index}`} className="result-data__list-item">
            <span className="result-data__bullet" aria-hidden="true">
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  return <span>{value}</span>;
}

function ExtractedDataCard({ data, missingFields }: ExtractedDataCardProps) {
  const titleId = useId();
  const rows = buildExtractedDataRows(data, missingFields);
  const { entries: additionalFields } = buildAdditionalFields(data, {
    omitEmptyCollections: true,
  });

  if (rows.length === 0 && additionalFields.length === 0) {
    return null;
  }

  return (
    <section className="result-card" aria-labelledby={titleId}>
      <div className="result-card__header">
        <h3 id={titleId} className="result-card__title">
          Datos clínicos extraídos
        </h3>
      </div>

      <div className="result-data">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`result-data__row result-data__row--${getDataRowLayout(row)}`}
          >
            <span className="result-data__label">{row.label}</span>
            <div className="result-data__content">
              <DataRowValue value={row.value} />
            </div>
          </div>
        ))}

        {additionalFields.map((entry) => (
          <div
            key={entry.key}
            className={`result-data__row result-data__row--${getFieldRowLayout(entry.node)}`}
          >
            <span className="result-data__label">{entry.displayLabel}</span>
            <div className="result-data__content">
              <FieldEntryValue entry={entry} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ExtractedDataCard;
