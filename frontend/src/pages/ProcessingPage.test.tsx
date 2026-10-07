import { act } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import NotificationProvider from "../notifications/NotificationProvider";
import { successfulProcessingResponse } from "../mocks/processingMocks";
import { ApiError } from "../services/processingService";
import { theme } from "../theme/theme";
import { MAX_FILE_SIZE } from "../processing/form";
import ProcessingPage from "./ProcessingPage";

const processFile = vi.fn();
const processText = vi.fn();
const navigate = vi.fn();

vi.mock("../config/env", () => ({
  env: {
    apiBaseUrl: "http://localhost:8080",
    useMocks: false,
  },
}));

vi.mock("../services/processingService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/processingService")>();

  return {
    ...actual,
    processFile: (...args: unknown[]) => processFile(...args),
    processText: (...args: unknown[]) => processText(...args),
  };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();

  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <NotificationProvider>
        <MemoryRouter>
          <ProcessingPage />
        </MemoryRouter>
      </NotificationProvider>
    </ThemeProvider>,
  );
}

function createFile(name: string, type: string, size = 2048) {
  const file = new File(["contenido"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function chooseFile(file: File) {
  fireEvent.change(screen.getByLabelText("Seleccionar archivo"), {
    target: { files: [file] },
  });
}

async function selectChannel(label: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: /Canal de origen/i }));
  await user.click(await screen.findByRole("option", { name: label }));
}

describe("ProcessingPage", () => {
  beforeEach(() => {
    processFile.mockReset();
    processText.mockReset();
    navigate.mockReset();
    processFile.mockResolvedValue(successfulProcessingResponse);
    processText.mockResolvedValue(successfulProcessingResponse);
  });

  it("no muestra ni solicita document_id", () => {
    renderPage();

    expect(screen.queryByLabelText(/document[_\s-]?id/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ID del documento/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/document_id/i)).not.toBeInTheDocument();
  });

  it("permite alternar Archivo y Texto", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByText("Agregue un archivo para previsualizarlo aquí"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Texto" }));

    expect(screen.getByLabelText(/Texto del documento/i)).toBeInTheDocument();
    expect(screen.queryByTitle(/Vista previa/i)).not.toBeInTheDocument();
  });

  it("acepta PDF, JPG y PNG y muestra el archivo seleccionado", async () => {
    const user = userEvent.setup();
    renderPage();

    chooseFile(createFile("carta.pdf", "application/pdf"));

    expect(screen.getAllByText("carta.pdf").length).toBeGreaterThan(0);
    expect(screen.getByText("Listo para procesar")).toBeInTheDocument();
    expect(screen.getByTitle("Vista previa de carta.pdf")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitar archivo" }));
    chooseFile(createFile("nota.jpg", "image/jpeg"));
    expect(screen.getAllByText("nota.jpg").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Quitar archivo" }));
    chooseFile(createFile("foto.jpeg", "image/jpeg"));
    expect(screen.getAllByText("foto.jpeg").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Quitar archivo" }));
    chooseFile(createFile("scan.png", "image/png"));
    expect(screen.getAllByText("scan.png").length).toBeGreaterThan(0);
  });

  it("no permite procesar un archivo sin canal de origen", async () => {
    renderPage();

    chooseFile(createFile("carta.pdf", "application/pdf"));

    const processButtons = screen.getAllByRole("button", {
      name: "Procesar documento",
    });

    expect(processButtons.length).toBeGreaterThanOrEqual(1);
    for (const button of processButtons) {
      expect(button).toBeDisabled();
    }

    expect(processFile).not.toHaveBeenCalled();
  });

  it("conserva el archivo válido si se intenta reemplazar por uno inválido", () => {
    renderPage();

    chooseFile(createFile("carta.pdf", "application/pdf"));
    chooseFile(createFile("nota.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));

    expect(screen.getAllByText("carta.pdf").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Formato no admitido. Selecciona un archivo PDF, JPG o PNG./i),
    ).toBeInTheDocument();
  });

  it("rechaza un tipo inválido y un archivo demasiado grande", () => {
    renderPage();

    chooseFile(createFile("foto.gif", "image/gif"));
    expect(
      screen.getByText(/Formato no admitido. Selecciona un archivo PDF, JPG o PNG./i),
    ).toBeInTheDocument();

    chooseFile(createFile("grande.pdf", "application/pdf", MAX_FILE_SIZE + 1));
    expect(
      screen.getByText("El archivo no puede superar los 10 MB."),
    ).toBeInTheDocument();
  });

  it("permite quitar el archivo seleccionado", async () => {
    const user = userEvent.setup();
    renderPage();

    chooseFile(createFile("carta.pdf", "application/pdf"));

    await user.click(screen.getByRole("button", { name: "Quitar archivo" }));

    expect(screen.queryByText("carta.pdf")).not.toBeInTheDocument();
    expect(
      screen.getByText("Agregue un archivo para previsualizarlo aquí"),
    ).toBeInTheDocument();
  });

  it("no envía document_id y navega a Resultado tras un archivo válido", async () => {
    const user = userEvent.setup();
    renderPage();

    chooseFile(createFile("carta.pdf", "application/pdf"));
    await selectChannel("Consulta Externa");
    await user.click(
      screen.getAllByRole("button", { name: "Procesar documento" })[0],
    );

    await waitFor(() => {
      expect(processFile).toHaveBeenCalledTimes(1);
    });

    const request = processFile.mock.calls[0]?.[0] as {
      file: File;
      origin_channel: string;
      document_id?: string;
    };

    expect(request.origin_channel).toBe("Consulta Externa");
    expect(request.file.name).toBe("carta.pdf");
    expect(request).not.toHaveProperty("document_id");
    expect(navigate).toHaveBeenCalledWith("/result/DOC-2026-0001", {
      state: { processingResponse: successfulProcessingResponse },
    });
  });

  it("rechaza texto vacío o solo espacios y exige canal", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Texto" }));

    const processButton = screen.getByRole("button", { name: "Procesar texto" });
    expect(processButton).toBeDisabled();

    await user.type(screen.getByLabelText(/Texto del documento/i), "   ");
    expect(processButton).toBeDisabled();

    await user.clear(screen.getByLabelText(/Texto del documento/i));
    await user.type(screen.getByLabelText(/Texto del documento/i), "prueba");
    expect(processButton).toBeDisabled();

    await selectChannel("Hospitalización");
    expect(processButton).toBeEnabled();
  });

  it("conserva archivo, texto y canal si el procesamiento falla", async () => {
    const user = userEvent.setup();
    processFile.mockRejectedValue(
      new ApiError(500, "STORAGE_ERROR", "fallo interno"),
    );
    processText.mockRejectedValue(
      new ApiError(500, "STORAGE_ERROR", "fallo interno"),
    );

    renderPage();

    chooseFile(createFile("carta.pdf", "application/pdf"));
    await selectChannel("Hospitalización");
    await user.click(
      screen.getAllByRole("button", { name: "Procesar documento" })[0],
    );

    await screen.findByText(/El servicio no está disponible/i);
    expect(screen.getAllByText("carta.pdf").length).toBeGreaterThan(0);
    expect(screen.getByText("Hospitalización")).toBeInTheDocument();
    expect(screen.queryByText(/STORAGE_ERROR/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fallo interno/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Texto" }));
    await user.type(screen.getByLabelText(/Texto del documento/i), "contenido clínico");
    await user.click(screen.getByRole("button", { name: "Procesar texto" }));

    await screen.findAllByText(/El servicio no está disponible/i);
    expect(screen.getByDisplayValue("contenido clínico")).toBeInTheDocument();
    expect(screen.getByText("Hospitalización")).toBeInTheDocument();
  });

  it("deshabilita acciones y evita doble envío mientras procesa", async () => {
    const user = userEvent.setup();
    let resolveRequest: ((value: typeof successfulProcessingResponse) => void) | undefined;

    processFile.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    renderPage();

    chooseFile(createFile("carta.pdf", "application/pdf"));
    await selectChannel("Consulta Externa");

    const processButton = screen.getAllByRole("button", {
      name: "Procesar documento",
    })[0];
    await user.click(processButton);

    const processingButton = (
      await screen.findAllByRole("button", {
        name: "Procesando documento…",
      })
    )[0];

    expect(processingButton).toBeDisabled();
    fireEvent.click(processingButton);

    const clearButtons = screen.getAllByRole("button", { name: "Limpiar" });
    for (const clearButton of clearButtons) {
      expect(clearButton).toBeDisabled();
    }
    expect(processFile).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest?.(successfulProcessingResponse);
    });
  });

  it("procesa texto válido sin DocumentViewer y sin document_id", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Texto" }));
    await user.type(screen.getByLabelText(/Texto del documento/i), "prueba");
    await selectChannel("Hospitalización");
    await user.click(screen.getByRole("button", { name: "Procesar texto" }));

    await waitFor(() => {
      expect(processText).toHaveBeenCalledTimes(1);
    });

    const request = processText.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(request).toEqual({
      document_text: "prueba",
      origin_channel: "Hospitalización",
    });
    expect(screen.queryByTitle(/Vista previa/i)).not.toBeInTheDocument();
    expect(navigate).toHaveBeenCalledWith("/result/DOC-2026-0001", {
      state: { processingResponse: successfulProcessingResponse },
    });
  });
});
