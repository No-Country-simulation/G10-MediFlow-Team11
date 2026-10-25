import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LabResultsEditor from "./LabResultsEditor";

const rows = [
  { name: "Glucosa", value: 180, unit: "mg/dL" },
  { name: "HbA1c", value: "8.2", unit: "%" },
];
const originals = [{ name: "Glucosa", value: 174, unit: "mg/dL" }, { name: "HbA1c", value: "8.2", unit: "%" }];
const noop = () => undefined;

function render(drafts: Record<string, { text: string; error: string }>, hasInvalidDrafts: boolean): string {
  return renderToStaticMarkup(
    <LabResultsEditor rows={rows} disabled={false} hasIncompleteNewRows={false} hasInvalidDrafts={hasInvalidDrafts}
      originals={originals} drafts={drafts} onChangeCell={noop} onAddRow={noop} onRemoveRow={noop} />,
  );
}

describe("LabResultsEditor — borradores inválidos", () => {
  const html = render({ "0:value": { text: "18a", error: "Ingrese un número válido." } }, true);

  it("muestra el texto inválido escrito, marcado y con su mensaje, no el último valor válido", () => {
    expect(html).toMatch(/<input[^>]*value="18a"[^>]*aria-label="Resultado, fila 1"|<input[^>]*aria-label="Resultado, fila 1"[^>]*value="18a"/);
    expect(html).not.toMatch(/value="180"/);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Ingrese un número válido.");
    expect(html).toContain('role="alert"');
  });

  it("impide agregar o eliminar filas mientras exista un borrador inválido, y lo explica", () => {
    expect(html.match(/<button[^>]*disabled/g)).toHaveLength(3);
    expect(html).toContain("Corrija los valores inválidos para agregar o eliminar filas.");
  });

  it("sin borradores muestra el valor actual y habilita agregar y eliminar", () => {
    const clean = render({}, false);

    expect(clean).toMatch(/value="180"/);
    expect(clean).not.toContain("aria-invalid");
    expect(clean).not.toMatch(/<button[^>]*disabled/);
    expect(clean).not.toContain("Corrija los valores inválidos");
  });
});
