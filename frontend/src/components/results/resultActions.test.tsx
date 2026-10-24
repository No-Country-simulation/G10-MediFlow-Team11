import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import ReviewReasonsCard from "./ReviewReasonsCard";
import { buildExtractedDataRows } from "./extractedDataRows";

describe("result review communication", () => {
  it("shows the exact review path and known missing field only while review is pending", () => {
    const render = (pending: boolean) => renderToStaticMarkup(<MemoryRouter><ReviewReasonsCard
      reasons={["MISSING_CRITICAL_FIELDS"]} requiresHumanReview={pending}
      documentId="DOC-585b7f42-99ba-44dd-9b0a-dea23e633207" missingFields={["patient.name"]} />
    </MemoryRouter>);
    expect(render(true)).toContain('/audit/DOC-585b7f42-99ba-44dd-9b0a-dea23e633207/review');
    expect(render(true)).toContain('Datos no identificados: Nombre del paciente');
    expect(render(false)).not.toContain('Revisar documento');
  });

  it("shows a missing patient only when validation identifies the null name", () => {
    const data = { patient: { name: null, age: null } };
    expect(buildExtractedDataRows(data, ["patient.name"])).toContainEqual({label:"Paciente",value:"No identificado"});
    expect(buildExtractedDataRows(data)).toEqual([]);
    expect(data.patient.name).toBeNull();
  });
});
