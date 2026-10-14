import { describe, expect, it } from "vitest";
import {
  FILE_ERROR_MESSAGES,
  MAX_FILE_SIZE,
  formatBytes,
  getFileExtension,
  getFileTypeLabel,
  getOriginErrorTarget,
  hasOriginChannel,
  isOtherChannelMissing,
  normalizeViewerMimeType,
  resolveOriginChannel,
  validateProcessingFile,
} from "./processingForm";

const file = (name: string, type: string, size = 1024) => ({ name, type, size });

describe("getFileExtension", () => {
  it("returns the lowercase extension", () => {
    expect(getFileExtension("Informe.PDF")).toBe(".pdf");
    expect(getFileExtension("scan.final.JPeG")).toBe(".jpeg");
  });

  it("returns an empty string without extension", () => {
    expect(getFileExtension("informe")).toBe("");
  });
});

describe("normalizeViewerMimeType", () => {
  it("keeps supported MIME types", () => {
    expect(normalizeViewerMimeType(file("a.bin", "application/pdf"))).toBe("application/pdf");
    expect(normalizeViewerMimeType(file("a.bin", "image/png"))).toBe("image/png");
    expect(normalizeViewerMimeType(file("a.bin", "image/jpeg"))).toBe("image/jpeg");
  });

  it("falls back to the extension when the MIME type is empty or nonstandard", () => {
    expect(normalizeViewerMimeType(file("a.PDF", ""))).toBe("application/pdf");
    expect(normalizeViewerMimeType(file("a.jpg", "application/octet-stream"))).toBe("image/jpeg");
    expect(normalizeViewerMimeType(file("a.jpeg", ""))).toBe("image/jpeg");
    expect(normalizeViewerMimeType(file("a.png", "image/x-png"))).toBe("image/png");
  });

  it("rejects unsupported files", () => {
    expect(normalizeViewerMimeType(file("a.docx", "application/msword"))).toBeNull();
    expect(normalizeViewerMimeType(file("a", ""))).toBeNull();
  });
});

describe("validateProcessingFile", () => {
  it("accepts supported files within the size limit", () => {
    expect(validateProcessingFile(file("a.pdf", "application/pdf", 1))).toBeNull();
    expect(validateProcessingFile(file("a.png", "", MAX_FILE_SIZE))).toBeNull();
  });

  it("rejects unsupported formats", () => {
    expect(validateProcessingFile(file("a.txt", "text/plain"))).toBe(
      FILE_ERROR_MESSAGES.unsupportedFormat,
    );
  });

  it("rejects files of zero bytes", () => {
    expect(validateProcessingFile(file("a.pdf", "application/pdf", 0))).toBe(
      FILE_ERROR_MESSAGES.emptyFile,
    );
  });

  it("rejects files above 10 MB", () => {
    expect(validateProcessingFile(file("a.pdf", "application/pdf", MAX_FILE_SIZE + 1))).toBe(
      FILE_ERROR_MESSAGES.tooLarge,
    );
  });

  it("reports the format error before the size errors", () => {
    expect(validateProcessingFile(file("a.txt", "text/plain", 0))).toBe(
      FILE_ERROR_MESSAGES.unsupportedFormat,
    );
  });
});

describe("file presentation helpers", () => {
  it("maps MIME types to labels", () => {
    expect(getFileTypeLabel("application/pdf")).toBe("PDF");
    expect(getFileTypeLabel("image/png")).toBe("PNG");
    expect(getFileTypeLabel("image/jpeg")).toBe("JPG");
  });

  it("formats byte sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("origin channel", () => {
  it("resolves the selected channel", () => {
    expect(resolveOriginChannel("Laboratorio", "ignored")).toBe("Laboratorio");
  });

  it("resolves the trimmed custom channel for Otro", () => {
    expect(resolveOriginChannel("Otro", "  Clínica externa  ")).toBe("Clínica externa");
  });

  it("treats a blank custom channel as missing", () => {
    expect(isOtherChannelMissing("Otro", "")).toBe(true);
    expect(isOtherChannelMissing("Otro", "   ")).toBe(true);
    expect(isOtherChannelMissing("Otro", "Clínica")).toBe(false);
    expect(isOtherChannelMissing("Laboratorio", "")).toBe(false);
  });

  it("requires a channel and a custom value for Otro", () => {
    expect(hasOriginChannel("", "")).toBe(false);
    expect(hasOriginChannel("Laboratorio", "")).toBe(true);
    expect(hasOriginChannel("Otro", "   ")).toBe(false);
    expect(hasOriginChannel("Otro", "Clínica")).toBe(true);
  });

  it("points the error at the control that needs correction", () => {
    expect(getOriginErrorTarget(false, "Otro", "")).toBeNull();
    expect(getOriginErrorTarget(true, "", "")).toBe("select");
    expect(getOriginErrorTarget(true, "Otro", "")).toBe("other");
    expect(getOriginErrorTarget(true, "Otro", "   ")).toBe("other");
    expect(getOriginErrorTarget(true, "Otro", "Clínica")).toBe("select");
  });
});
