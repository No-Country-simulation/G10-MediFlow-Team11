import { useId } from "react";
import type { ExtractedData } from "../../types/processing";
import { buildExtractedDataRows, type DataRow } from "./extractedDataRows";
import { getDataRowLayout } from "./resultPresentation";

interface ExtractedDataCardProps {
  data: ExtractedData;
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

function ExtractedDataCard({ data }: ExtractedDataCardProps) {
  const titleId = useId();
  const rows = buildExtractedDataRows(data);

  if (rows.length === 0) {
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
      </div>
    </section>
  );
}

export default ExtractedDataCard;
