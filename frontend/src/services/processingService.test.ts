import { successfulProcessingResponse } from "../mocks/processingMocks";

vi.mock("../config/env", () => ({
  env: {
    apiBaseUrl: "http://localhost:8080",
    useMocks: false,
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe("processingService", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("processText envía solo document_text y origin_channel", async () => {
    fetchMock.mockResolvedValue(jsonResponse(successfulProcessingResponse));

    const { processText } = await import("./processingService");

    await processText({
      document_text: "contenido clínico",
      origin_channel: "Hospitalización",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];

    expect(url).toBe("http://localhost:8080/api/v1/documents/process-text");
    expect(options.method).toBe("POST");

    const payload = JSON.parse(options.body) as Record<string, unknown>;

    expect(payload).toEqual({
      document_text: "contenido clínico",
      origin_channel: "Hospitalización",
    });
    expect(payload).not.toHaveProperty("document_id");
  });

  it("processFile envía solo file y origin_channel", async () => {
    fetchMock.mockResolvedValue(jsonResponse(successfulProcessingResponse));

    const { processFile } = await import("./processingService");
    const file = new File(["pdf"], "carta.pdf", { type: "application/pdf" });

    await processFile({
      file,
      origin_channel: "Consulta Externa",
    });

    const [, options] = fetchMock.mock.calls[0] as [
      string,
      { method: string; body: FormData },
    ];

    const formData = options.body;

    expect(formData.get("file")).toBe(file);
    expect(formData.get("origin_channel")).toBe("Consulta Externa");
    expect(formData.has("document_id")).toBe(false);
  });
});
