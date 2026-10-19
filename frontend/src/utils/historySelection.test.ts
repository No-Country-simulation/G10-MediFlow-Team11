import { describe, expect, it } from "vitest";
import type { DocumentListItem } from "../types/documentList";
import {
  buildDocumentHistoryPath,
  filterDocumentsBySearch,
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
    status: "PROCESSED",
    inputType: "TEXT",
    fileName: null,
    documentType: null,
    createdAt: "2026-10-13T08:00:00Z",
    updatedAt: "2026-10-13T08:05:00Z",
  },
];

describe("historySelection", () => {
  it("keeps the existing history URL contract used from Results", () => {
    expect(buildDocumentHistoryPath("DOC-2026-0001")).toBe(
      "/history?documentId=DOC-2026-0001",
    );
    expect(buildDocumentHistoryPath("DOC/especial")).toBe(
      "/history?documentId=DOC%2Fespecial",
    );
  });

  it("filters by identifier and file name without fabricating records", () => {
    expect(filterDocumentsBySearch(documents, "0001").map((item) => item.documentId)).toEqual([
      "DOC-2026-0001",
    ]);
    expect(
      filterDocumentsBySearch(documents, "informe-radiologia").map(
        (item) => item.documentId,
      ),
    ).toEqual(["DOC-2026-0001"]);
  });

  it("returns an empty list when the search has no matches", () => {
    expect(filterDocumentsBySearch(documents, "inexistente")).toEqual([]);
  });

  it("does not match a missing file name", () => {
    expect(filterDocumentsBySearch(documents, "informe-radiologia")).toHaveLength(
      1,
    );
    expect(filterDocumentsBySearch(documents, "0005")).toEqual([documents[1]]);
  });
});
