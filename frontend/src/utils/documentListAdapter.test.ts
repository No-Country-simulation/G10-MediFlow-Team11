import { describe, expect, it } from "vitest";
import { adaptDocumentList, adaptDocumentListItem } from "./documentListAdapter";

describe("adaptDocumentList", () => {
  it("converts snake_case selection metadata to internal models", () => {
    const result = adaptDocumentList([
      {
        document_id: "DOC-2026-0001",
        status: "APPROVED",
        input_type: "FILE",
        file_name: "informe.pdf",
        document_type: "IMAGING_REPORT",
        created_at: "2026-10-10T09:30:00Z",
        updated_at: "2026-10-10T09:31:00Z",
      },
    ]);

    expect(result).toEqual([
      {
        documentId: "DOC-2026-0001",
        status: "APPROVED",
        inputType: "FILE",
        fileName: "informe.pdf",
        documentType: "IMAGING_REPORT",
        createdAt: "2026-10-10T09:30:00Z",
        updatedAt: "2026-10-10T09:31:00Z",
      },
    ]);
  });

  it("preserves null file_name and document_type", () => {
    expect(
      adaptDocumentListItem({
        document_id: "DOC-2026-0005",
        status: "PROCESSED",
        input_type: "TEXT",
        file_name: null,
        document_type: null,
        created_at: "2026-10-13T08:00:00Z",
        updated_at: "2026-10-13T08:05:00Z",
      }),
    ).toMatchObject({
      documentId: "DOC-2026-0005",
      fileName: null,
      documentType: null,
    });
  });

  it("skips malformed items instead of mixing them into the list", () => {
    const result = adaptDocumentList([
      {
        document_id: "DOC-VALID",
        status: "APPROVED",
        input_type: "FILE",
        file_name: "a.pdf",
        document_type: "PRESCRIPTION",
        created_at: "2026-10-10T09:30:00Z",
        updated_at: "2026-10-10T09:31:00Z",
      },
      { status: "APPROVED" },
      "not-an-object",
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].documentId).toBe("DOC-VALID");
  });

  it("rejects a non-array payload", () => {
    expect(() => adaptDocumentList({ document_id: "DOC-1" })).toThrow(
      "INVALID_DOCUMENT_LIST",
    );
  });
});
