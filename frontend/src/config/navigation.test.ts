import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PRIMARY_NAVIGATION } from "./navigation";

const sourceRoot = dirname(fileURLToPath(import.meta.url));

describe("history navigation compatibility", () => {
  it("exposes an independent Historial entry in the app shell", () => {
    const historyItem = PRIMARY_NAVIGATION.find((item) => item.to === "/history");

    expect(historyItem?.label).toBe("Historial");
    expect(historyItem?.to).toBe("/history");
  });

  it("keeps the Results contextual link to the history query contract", () => {
    const resultIdentity = readFileSync(
      join(sourceRoot, "../components/results/ResultIdentity.tsx"),
      "utf8",
    );

    expect(resultIdentity).toContain(
      "`/history?documentId=${encodeURIComponent(documentId)}`",
    );
  });

  it("keeps the history route registered in the app shell", () => {
    const appRoutes = readFileSync(
      join(sourceRoot, "../routes/AppRoutes.tsx"),
      "utf8",
    );

    expect(appRoutes).toContain('path="history"');
    expect(appRoutes).toContain("HistoryPage");
    expect(appRoutes).toContain('path="results/:documentId"');
    expect(appRoutes).toContain('path="processing"');
    expect(appRoutes).toContain('path="audit"');
  });

  it("shows the selector when HistoryPage has no documentId", () => {
    const historyPage = readFileSync(
      join(sourceRoot, "../pages/HistoryPage.tsx"),
      "utf8",
    );

    expect(historyPage).toContain("HistoryDocumentSelector");
    expect(historyPage).toContain("searchParams.get(\"documentId\")");
    expect(historyPage).toContain("{!documentId ? (");
  });
});
