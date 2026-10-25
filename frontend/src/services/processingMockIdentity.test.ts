import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/env", () => ({ env: { apiBaseUrl: "http://localhost:8080", useMocks: true } }));

describe("mock processing identity", () => {
  beforeEach(() => vi.resetModules());

  it("rejects arbitrary text without assigning a clinical result or document ID", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { processText } = await import("./processingService");
    const { getDocumentResult } = await import("./resultService");
    await expect(processText({ document_text: "Texto arbitrario de prueba", origin_channel: "CONSULTA_EXTERNA" }))
      .rejects.toMatchObject({ code: "MOCK_TEXT_UNAVAILABLE" });
    expect(await getDocumentResult("Texto arbitrario de prueba")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only returns the controlled text fixture with its own original and identity", async () => {
    const { processText } = await import("./processingService");
    const { getDocumentContent } = await import("./documentService");
    const { getDocumentResult } = await import("./resultService");
    const content = await getDocumentContent("DOC-2026-0006");
    expect(content?.kind).toBe("text");
    if (!content || content.kind !== "text") throw new Error("Missing text fixture");
    const processed = await processText({ document_text: content.text, origin_channel: "CONSULTA_EXTERNA" });
    expect(processed.document_id).toBe("DOC-2026-0006");
    expect(processed.extracted_data?.patient?.name).toBe("Sofía Ramírez");
    expect((await getDocumentResult(processed.document_id))?.extracted_data).toEqual(processed.extracted_data);
    await expect(processText({ document_text: `${content.text} extra`, origin_channel: "CONSULTA_EXTERNA" }))
      .rejects.toMatchObject({ code: "MOCK_TEXT_UNAVAILABLE" });
  });

  it.each([
    ["DOC-2026-0001", "PROCESSED"],
    ["DOC-2026-0002", "NEEDS_AUDIT"],
    ["DOC-2026-0003", "APPROVED"],
    ["DOC-2026-0004", "REJECTED"],
  ])("keeps %s as %s", async (id, status) => {
    const { getDocumentResult } = await import("./resultService");
    expect((await getDocumentResult(id))?.status).toBe(status);
  });
});
