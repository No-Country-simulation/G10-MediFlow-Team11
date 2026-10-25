import { buildFieldTable } from "../results/extractedDataRows";
import { FieldValue } from "../results/ExtractedFieldValue";
import { coerceFieldInput, valueAtPath } from "../../pages/clinicalReviewModel";
import type { FieldEntry, FieldNode, FieldPath, ListNode } from "../../utils/extractedFieldStructure";

type ChangeHandler = (path: FieldPath, value: unknown) => void;

interface ScalarControlProps {
  node: FieldNode;
  label: string;
  original: unknown;
  disabled: boolean;
  onChange: ChangeHandler;
}

const MULTILINE_MIN_LENGTH = 80;

function ScalarControl({ node, label, original, disabled, onChange }: ScalarControlProps) {
  const originalValue = valueAtPath(original, node.path);
  const isUnsafe = node.path.some((segment) => segment === "__proto__");
  if (isUnsafe || (node.kind === "scalar" && node.valueType === "other")) return <FieldValue node={node} />;

  const commit = (raw: string) => onChange(node.path, coerceFieldInput(raw, originalValue));
  const current = node.kind === "scalar" ? String(node.raw) : "";

  if (typeof originalValue === "boolean") {
    return (
      <select value={current === "true" || current === "false" ? current : ""} disabled={disabled}
        aria-label={label} onChange={(event) => commit(event.target.value)}>
        <option value="true">Sí</option>
        <option value="false">No</option>
        <option value="">Sin valor</option>
      </select>
    );
  }
  if (typeof originalValue === "number") {
    return (
      <input type="number" step="any" inputMode="decimal" value={current} disabled={disabled}
        aria-label={label} onChange={(event) => commit(event.target.value)} />
    );
  }
  if (typeof originalValue === "string" && (originalValue.length >= MULTILINE_MIN_LENGTH || originalValue.includes("\n"))) {
    return (
      <textarea rows={3} value={current} disabled={disabled} aria-label={label}
        onChange={(event) => commit(event.target.value)} />
    );
  }
  return (
    <input type="text" value={current} disabled={disabled} aria-label={label}
      onChange={(event) => commit(event.target.value)} />
  );
}

interface FieldEditorProps {
  node: FieldNode;
  label: string;
  original: unknown;
  disabled: boolean;
  onChange: ChangeHandler;
}

function ObjectListTable({ list, label, original, disabled, onChange }: FieldEditorProps & { list: ListNode }) {
  const table = buildFieldTable(list, false);

  return (
    <div className="result-table">
      <table className="result-table__table">
        <caption className="result-table__caption">{label}</caption>
        <thead>
          <tr>
            {table.columns.map((column) => <th key={column.key} scope="col">{column.heading}</th>)}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={row.key}>
              {row.cells.map((cell, columnIndex) => {
                const column = table.columns[columnIndex];
                const isScalar = cell.kind === "scalar" || cell.kind === "null";
                return (
                  <td key={column.key} data-label={column.heading}>
                    {isScalar ? (
                      <ScalarControl node={cell} label={`${label}, ${column.heading}, fila ${rowIndex + 1}`}
                        original={original} disabled={disabled} onChange={onChange} />
                    ) : (
                      <FieldValue node={cell} />
                    )}
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

export function FieldEditor({ node, label, original, disabled, onChange }: FieldEditorProps) {
  switch (node.kind) {
    case "null":
    case "scalar":
      return <ScalarControl node={node} label={label} original={original} disabled={disabled} onChange={onChange} />;
    case "empty":
      return <FieldValue node={node} />;
    case "object":
      return (
        <dl className="result-fields">
          {node.entries.map((entry) => (
            <div key={entry.key} className="result-fields__item">
              <dt className="result-fields__label">{entry.displayLabel}</dt>
              <dd className="result-fields__value">
                <FieldEditor node={entry.node} label={`${label}, ${entry.displayLabel}`} original={original}
                  disabled={disabled} onChange={onChange} />
              </dd>
            </div>
          ))}
        </dl>
      );
    case "list":
      if (node.listKind === "object") {
        return <ObjectListTable list={node} node={node} label={label} original={original} disabled={disabled} onChange={onChange} />;
      }
      if (node.listKind === "mixed") return <FieldValue node={node} />;
      return (
        <ul className="result-data__list">
          {node.items.map((item, index) => (
            <li key={index} className="result-data__list-item">
              <FieldEditor node={item} label={`${label}, elemento ${index + 1}`} original={original}
                disabled={disabled} onChange={onChange} />
            </li>
          ))}
        </ul>
      );
  }
}

interface AdditionalFieldsEditorProps {
  entries: readonly FieldEntry[];
  original: unknown;
  disabled: boolean;
  onChange: ChangeHandler;
}

export function AdditionalFieldsEditor({ entries, original, disabled, onChange }: AdditionalFieldsEditorProps) {
  return (
    <div className="clinical-review__structured">
      {entries.map((entry) => (
        <div key={entry.key} className="clinical-review__structured-item">
          <h5 className="clinical-review__structured-label">{entry.displayLabel}</h5>
          <div className="clinical-review__structured-value">
            <FieldEditor node={entry.node} label={entry.displayLabel} original={original}
              disabled={disabled} onChange={onChange} />
          </div>
        </div>
      ))}
    </div>
  );
}
