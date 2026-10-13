import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocumentContent } from "./documentService";
import { ApiError } from "./processingService";

vi.mock("../config/env", () => ({
  env: {
    apiBaseUrl: "http://localhost:8080",
    useMocks: false,
  },
}));

function createResponse(
  body: BodyInit | null,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(body, {
    status,
    headers: new Headers(headers),
  });
}

describe("getDocumentContent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("devuelve null cuando el backend responde 404", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createResponse(null, 404, { "Content-Type": "application/json" }),
    );

    const result = await getDocumentContent("DOC-001");

    expect(result).toBeNull();
  });

  it("lanza ApiError cuando el backend responde con error HTTP", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createResponse(null, 500, { "Content-Type": "application/json" }),
    );

    await expect(getDocumentContent("DOC-001")).rejects.toBeInstanceOf(ApiError);
  });

  it("procesa una respuesta PDF válida", async () => {
    const blob = new Blob(["pdf-bytes"], { type: "application/pdf" });
    global.fetch = vi.fn().mockResolvedValue(
      createResponse(blob, 200, { "Content-Type": "application/pdf" }),
    );

    const result = await getDocumentContent("DOC-001");

    expect(result).toEqual({
      kind: "file",
      mimeType: "application/pdf",
      blob: expect.any(Blob),
    });
  });

  it("procesa una respuesta JPEG válida", async () => {
    const blob = new Blob(["jpeg-bytes"], { type: "image/jpeg" });
    global.fetch = vi.fn().mockResolvedValue(
      createResponse(blob, 200, { "Content-Type": "image/jpeg" }),
    );

    const result = await getDocumentContent("DOC-001");

    expect(result).toEqual({
      kind: "file",
      mimeType: "image/jpeg",
      blob: expect.any(Blob),
    });
  });

  it("procesa una respuesta PNG válida", async () => {
    const blob = new Blob(["png-bytes"], { type: "image/png" });
    global.fetch = vi.fn().mockResolvedValue(
      createResponse(blob, 200, { "Content-Type": "image/png" }),
    );

    const result = await getDocumentContent("DOC-001");

    expect(result).toEqual({
      kind: "file",
      mimeType: "image/png",
      blob: expect.any(Blob),
    });
  });

  it("procesa una respuesta JSON de documento TEXT y extrae document_text", async () => {
    const jsonBody = JSON.stringify({
      document_id: "DOC-001",
      document_text: "HOSPITAL SANTA LUCIA - INFORME DE ESTUDIO",
      origin_channel: "Guardia_Emergencias",
    });

    global.fetch = vi.fn().mockResolvedValue(
      createResponse(jsonBody, 200, { "Content-Type": "application/json" }),
    );

    const result = await getDocumentContent("DOC-001");

    expect(result).toEqual({
      kind: "text",
      text: "HOSPITAL SANTA LUCIA - INFORME DE ESTUDIO",
    });
  });

  it("lanza error cuando el JSON de documento TEXT está malformado", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createResponse("{invalid json", 200, {
        "Content-Type": "application/json",
      }),
    );

    await expect(getDocumentContent("DOC-001")).rejects.toBeInstanceOf(ApiError);
  });

  it("lanza error cuando el JSON no incluye el campo document_text", async () => {
    const jsonBody = JSON.stringify({
      document_id: "DOC-001",
      origin_channel: "Guardia_Emergencias",
    });

    global.fetch = vi.fn().mockResolvedValue(
      createResponse(jsonBody, 200, { "Content-Type": "application/json" }),
    );

    await expect(getDocumentContent("DOC-001")).rejects.toBeInstanceOf(ApiError);
  });

  it("lanza error cuando document_text no es una cadena", async () => {
    const jsonBody = JSON.stringify({
      document_id: "DOC-001",
      document_text: 12345,
    });

    global.fetch = vi.fn().mockResolvedValue(
      createResponse(jsonBody, 200, { "Content-Type": "application/json" }),
    );

    await expect(getDocumentContent("DOC-001")).rejects.toBeInstanceOf(ApiError);
  });

  it("lanza error para MIME binario no admitido", async () => {
    const blob = new Blob(["gif-bytes"], { type: "image/gif" });
    global.fetch = vi.fn().mockResolvedValue(
      createResponse(blob, 200, { "Content-Type": "image/gif" }),
    );

    await expect(getDocumentContent("DOC-001")).rejects.toBeInstanceOf(ApiError);
  });

  it("lanza error cuando no hay Content-Type", async () => {
    const blob = new Blob(["bytes"], { type: "" });
    global.fetch = vi.fn().mockResolvedValue(
      createResponse(blob, 200, {}),
    );

    await expect(getDocumentContent("DOC-001")).rejects.toBeInstanceOf(ApiError);
  });

  it("propaga errores de red", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("Network request failed"));

    await expect(getDocumentContent("DOC-001")).rejects.toThrow(
      "Network request failed",
    );
  });

  it("incluye application/json en el header Accept de la petición", async () => {
    const blob = new Blob(["pdf"], { type: "application/pdf" });
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse(blob, 200, { "Content-Type": "application/pdf" }),
    );
    global.fetch = fetchMock;

    await getDocumentContent("DOC-001");

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(requestInit.headers).toMatchObject({
      Accept: expect.stringContaining("application/json"),
    });
  });
});
