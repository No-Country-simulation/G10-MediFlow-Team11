import {
  formatFileSize,
  getFileKind,
  hasOriginChannel,
  hasProcessableText,
  isAllowedFile,
  MAX_FILE_SIZE,
  validateSelectedFile,
} from "./form";

function createFile(name: string, type: string, size = 1024): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateSelectedFile", () => {
  it("acepta PDF", () => {
    const result = validateSelectedFile(
      createFile("receta.pdf", "application/pdf"),
    );

    expect(result).toEqual({ ok: true, kind: "PDF" });
  });

  it("acepta JPG", () => {
    const result = validateSelectedFile(createFile("nota.jpg", "image/jpeg"));

    expect(result).toEqual({ ok: true, kind: "JPG" });
  });

  it("acepta PNG", () => {
    const result = validateSelectedFile(createFile("scan.png", "image/png"));

    expect(result).toEqual({ ok: true, kind: "PNG" });
  });

  it("rechaza tipos inválidos", () => {
    const gif = validateSelectedFile(createFile("foto.gif", "image/gif"));
    const docx = validateSelectedFile(
      createFile(
        "nota.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    );

    expect(gif.ok).toBe(false);
    expect(docx.ok).toBe(false);
  });

  it("rechaza archivos demasiado grandes", () => {
    const result = validateSelectedFile(
      createFile("grande.pdf", "application/pdf", MAX_FILE_SIZE + 1),
    );

    expect(result).toEqual({
      ok: false,
      message: "El archivo no puede superar los 10 MB.",
    });
  });
});

describe("file helpers", () => {
  it("identifica el tipo por MIME o extensión", () => {
    expect(getFileKind(createFile("a.PDF", "application/pdf"))).toBe("PDF");
    expect(getFileKind(createFile("a.jpeg", "image/jpeg"))).toBe("JPG");
    expect(isAllowedFile(createFile("a.webp", "image/webp"))).toBe(false);
  });

  it("formatea tamaños como en el mockup", () => {
    expect(formatFileSize(14540.8)).toBe("14.2 KB");
    expect(formatFileSize(3.9 * 1024 * 1024)).toBe("3.9 MB");
  });
});

describe("text and channel validation", () => {
  it("rechaza texto vacío o solo espacios", () => {
    expect(hasProcessableText("")).toBe(false);
    expect(hasProcessableText("   \n\t  ")).toBe(false);
    expect(hasProcessableText("prueba")).toBe(true);
  });

  it("exige un canal de origen", () => {
    expect(hasOriginChannel("")).toBe(false);
    expect(hasOriginChannel("  ")).toBe(false);
    expect(hasOriginChannel("Hospitalización")).toBe(true);
  });
});
