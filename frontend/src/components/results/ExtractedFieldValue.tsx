import type { FieldEntry, FieldNode, ListNode } from "../../utils/extractedFieldStructure";
import { buildFieldTable, isLabResultsTable } from "./extractedDataRows";
import "../../styles/result-cards.css";

function EmptyValue() {
  return (
    <span className="result-data__empty" role="img" aria-label="Sin dato">
      —
    </span>
  );
}

interface FieldTableViewProps {
  list: ListNode;
  caption?: string;
  clinical?: boolean;
}

export function FieldTableView({ list, caption, clinical = false }: FieldTableViewProps) {
  const table = buildFieldTable(list, clinical);

  return (
    <div className={`result-table${clinical ? " result-table--clinical" : ""}`}>
      <table className="result-table__table">
        {caption && <caption className="result-table__caption">{caption}</caption>}
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th key={column.key} scope="col">
                {column.heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, index) => {
                const column = table.columns[index];
                const content = <FieldValue node={cell} caption={column.heading} />;

                return clinical && index === 0 ? (
                  <th key={column.key} scope="row" data-label={column.heading}>
                    {content}
                  </th>
                ) : (
                  <td key={column.key} data-label={column.heading}>
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FieldEntryValue({ entry }: { entry: FieldEntry }) {
  return isLabResultsTable(entry) ? (
    <FieldTableView list={entry.node} caption={entry.displayLabel} clinical />
  ) : (
    <FieldValue node={entry.node} caption={entry.displayLabel} />
  );
}

interface FieldValueProps {
  node: FieldNode;
  caption?: string;
}

export function FieldValue({ node, caption }: FieldValueProps) {
  switch (node.kind) {
    case "null":
      return <EmptyValue />;
    case "scalar":
      return node.blank ? <EmptyValue /> : <span>{node.text}</span>;
    case "empty":
      return (
        <span className="result-data__note">
          {node.shape === "list" ? "Sin elementos" : "Sin datos"}
        </span>
      );
    case "object":
      return (
        <dl className="result-fields">
          {node.entries.map((entry) => (
            <div key={entry.key} className="result-fields__item">
              <dt className="result-fields__label">{entry.displayLabel}</dt>
              <dd className="result-fields__value">
                <FieldValue node={entry.node} caption={entry.displayLabel} />
              </dd>
            </div>
          ))}
        </dl>
      );
    case "list":
      if (node.listKind === "object") {
        return <FieldTableView list={node} caption={caption} />;
      }

      return (
        <ul className="result-data__list">
          {node.items.map((item) => (
            <li key={item.path.join(".")} className="result-data__list-item">
              <span className="result-data__bullet" aria-hidden="true">
                •
              </span>
              <div className="result-data__list-value">
                <FieldValue node={item} />
              </div>
            </li>
          ))}
        </ul>
      );
  }
}
