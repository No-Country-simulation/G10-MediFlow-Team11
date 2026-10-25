import { buildFieldTable } from "../results/extractedDataRows";
import { FieldValue } from "../results/ExtractedFieldValue";
import { buildFieldNode, type FieldNode, type ListNode } from "../../utils/extractedFieldStructure";
import { labCellAdmitsNull } from "../../pages/clinicalReviewModel";

interface LabResultsEditorProps {
  rows: readonly unknown[];
  disabled: boolean;
  hasIncompleteNewRows: boolean;
  hasInvalidDrafts: boolean;
  originals: readonly Record<string, unknown>[];
  drafts: Record<string, { text: string; error: string }>;
  onChangeCell: (index: number, columnKey: string, text: string) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
}

function inputValue(cell: FieldNode): string {
  if (cell.kind === "scalar") return String(cell.raw);
  return "";
}

function LabResultsEditor({
  rows, disabled, hasIncompleteNewRows, hasInvalidDrafts, originals, drafts, onChangeCell, onAddRow, onRemoveRow,
}: LabResultsEditorProps) {
  const node = buildFieldNode(rows);
  const table = node.kind === "list" ? buildFieldTable(node as ListNode, true) : null;

  return (
    <div className="clinical-review__lab-editor">
      {table ? (
        <div className="result-table result-table--clinical">
          <table className="result-table__table">
            <caption className="result-table__caption">Resultados de laboratorio</caption>
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th key={column.key} scope="col">{column.heading}</th>
                ))}
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={index}>
                  {row.cells.map((cell, columnIndex) => {
                    const column = table.columns[columnIndex];
                    const editable = cell.kind !== "object" && cell.kind !== "list" && cell.kind !== "empty";
                    const originalValue = originals[index]?.[column.key];
                    const draft = drafts[`${index}:${column.key}`];
                    const label = `${column.heading}, fila ${index + 1}`;
                    const errorId = `lab-cell-error-${index}-${columnIndex}`;
                    let control = <FieldValue node={cell} />;
                    if (editable && typeof originalValue === "boolean") {
                      control = (
                        <select value={cell.kind === "scalar" && typeof cell.raw === "boolean" ? String(cell.raw) : ""}
                          disabled={disabled} aria-label={label}
                          onChange={(event) => onChangeCell(index, column.key, event.target.value)}>
                          <option value="true">Sí</option>
                          <option value="false">No</option>
                          {labCellAdmitsNull(column.key) && <option value="">Sin valor</option>}
                        </select>
                      );
                    } else if (editable) {
                      control = (
                        <input type="text" inputMode={typeof originalValue === "number" ? "decimal" : undefined}
                          value={draft ? draft.text : inputValue(cell)} disabled={disabled} aria-label={label}
                          aria-invalid={draft ? true : undefined} aria-describedby={draft ? errorId : undefined}
                          onChange={(event) => onChangeCell(index, column.key, event.target.value)} />
                      );
                    }
                    return (
                      <td key={column.key} data-label={column.heading}>
                        {control}
                        {draft && <span id={errorId} className="clinical-review__field-error" role="alert">{draft.error}</span>}
                      </td>
                    );
                  })}
                  <td data-label="Acciones">
                    <button
                      type="button"
                      className="clinical-review__row-remove"
                      disabled={disabled || hasInvalidDrafts}
                      aria-label={`Eliminar fila ${index + 1} de resultados de laboratorio`}
                      onClick={() => onRemoveRow(index)}
                    >
                      Eliminar fila
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="clinical-review__empty">Sin resultados de laboratorio registrados</p>
      )}
      {hasIncompleteNewRows && (
        <p className="clinical-review__field-error" role="alert">
          Complete Prueba y Resultado, o elimine las filas nuevas incompletas antes de aprobar.
        </p>
      )}
      {hasInvalidDrafts && (
        <p className="clinical-review__hint">Corrija los valores inválidos para agregar o eliminar filas.</p>
      )}
      <button type="button" className="clinical-review__add" disabled={disabled || hasInvalidDrafts} onClick={onAddRow}>
        Agregar resultado
      </button>
    </div>
  );
}

export default LabResultsEditor;
