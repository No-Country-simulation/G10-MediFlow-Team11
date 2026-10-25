import { describe, expect, it } from "vitest";
import type { DocumentListItem } from "../types/documentList";
import type { DocumentStatus } from "../types/processing";
import {
  buildDocumentHistoryPath,
  filterDocuments,
} from "./historySelection";

const documents: DocumentListItem[] = [
  {
    documentId: "DOC-2026-0001",
    status: "PROCESSED",
    inputType: "FILE",
    fileName: "informe-radiologia.pdf",
    documentType: "IMAGING_REPORT",
    createdAt: "2026-10-10T09:30:00Z",
    updatedAt: "2026-10-10T09:31:00Z",
  },
  {
    documentId: "DOC-2026-0005",
    status: "RECEIVED",
    inputType: "TEXT",
    fileName: null,
    documentType: null,
    createdAt: "2026-10-13T08:00:00Z",
    updatedAt: "2026-10-13T08:05:00Z",
  },
];

describe("historySelection", () => {
  it.each([
    "585b7f42-99ba-44dd-9b0a-dea23e633207",
    "LAB-SYN-047",
    "DOC/especial con espacios",
  ])("finds full and partial alternate identifiers and preserves the history route: %s", (documentId) => {
    const document = { ...documents[0], documentId };
    expect(filterDocuments([document], `  ${documentId.toUpperCase()}  `, "PROCESSED")).toEqual([document]);
    expect(filterDocuments([document], documentId.slice(-6), "")).toEqual([document]);
    expect(buildDocumentHistoryPath(documentId)).toBe(`/history?documentId=${encodeURIComponent(documentId)}`);
  });
  it("keeps the existing history URL contract used from Results", () => {
    expect(buildDocumentHistoryPath("DOC-2026-0001")).toBe(
      "/history?documentId=DOC-2026-0001",
    );
    expect(buildDocumentHistoryPath("DOC/especial")).toBe(
      "/history?documentId=DOC%2Fespecial",
    );
  });

  it("filters by identifier and file name without fabricating records", () => {
    expect(filterDocuments(documents, "0001", "").map((item) => item.documentId)).toEqual([
      "DOC-2026-0001",
    ]);
    expect(
      filterDocuments(documents, "informe-radiologia", "").map(
        (item) => item.documentId,
      ),
    ).toEqual(["DOC-2026-0001"]);
  });

  it("returns an empty list when the search has no matches", () => {
    expect(filterDocuments(documents, "inexistente", "")).toEqual([]);
  });

  it("does not match a missing file name", () => {
    expect(filterDocuments(documents, "informe-radiologia", "")).toHaveLength(
      1,
    );
    expect(filterDocuments(documents, "0005", "")).toEqual([documents[1]]);
  });

  const statuses: DocumentStatus[] = [
    "RECEIVED",
    "PROCESSING",
    "PROCESSED",
    "NEEDS_AUDIT",
    "APPROVED",
    "REJECTED",
    "FAILED",
  ];

  it.each(statuses)("selects only documents in status %s", (status) => {
    const candidates = statuses.map((candidate, index) => ({
      ...documents[0],
      documentId: `DOC-${index}`,
      status: candidate,
    }));
    expect(filterDocuments(candidates, "", status)).toEqual([
      candidates.find((document) => document.status === status),
    ]);
  });

  it("matches identifiers and file names without case sensitivity", () => {
    expect(filterDocuments(documents, "doc-2026-0001", "")).toEqual([
      documents[0],
    ]);
    expect(filterDocuments(documents, "INFORME-RADIOLOGIA", "")).toEqual([
      documents[0],
    ]);
  });

  it("trims surrounding whitespace and treats whitespace-only search as empty", () => {
    expect(filterDocuments(documents, "  informe-radiologia  ", "")).toEqual([
      documents[0],
    ]);
    expect(filterDocuments(documents, "   ", "")).toEqual(documents);
  });

  it("does not mutate the source documents", () => {
    const original = structuredClone(documents);

    filterDocuments(documents, "0001", "PROCESSED");

    expect(documents).toEqual(original);
  });

  it("combines identifier or file-name search with status", () => {
    expect(filterDocuments(documents, "0001", "RECEIVED")).toEqual([]);
    expect(filterDocuments(documents, "informe-radiologia", "PROCESSED")).toEqual([
      documents[0],
    ]);
    expect(filterDocuments(documents, "0005", "RECEIVED")).toEqual([
      documents[1],
    ]);
  });

  it("uses all statuses by default and restores all results after clearing", () => {
    expect(filterDocuments(documents, "", "")).toEqual(documents);
    expect(filterDocuments(documents, "0001", "RECEIVED")).toEqual([]);
    expect(filterDocuments(documents, "", "")).toEqual(documents);
  });
});
