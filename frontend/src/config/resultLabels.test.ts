import { describe, expect, it } from "vitest";
import {
  destinationLabel,
  notificationTypeLabel,
  priorityLabel,
  statusLabel,
  storageStateLabel,
} from "./resultLabels";

describe("resultLabels", () => {
  it("traduce los estados del documento", () => {
    expect(statusLabel("PROCESSED")).toBe("Procesado");
    expect(statusLabel("NEEDS_AUDIT")).toBe("Requiere revisión");
    expect(statusLabel("APPROVED")).toBe("Aprobado");
    expect(statusLabel("REJECTED")).toBe("Rechazado");
  });

  it("traduce prioridades y destinos", () => {
    expect(priorityLabel("URGENT")).toBe("Urgente");
    expect(priorityLabel("ROUTINE")).toBe("Rutinaria");
    expect(destinationLabel("HUMAN_REVIEW")).toBe("Revisión Humana");
    expect(destinationLabel("MEDICAL_RECORD")).toBe("Expediente Clínico");
  });

  it("traduce el estado de almacenamiento", () => {
    expect(storageStateLabel("SUCCESS")).toBe("Guardado correctamente");
    expect(storageStateLabel("PENDING")).toBe("Almacenamiento pendiente");
    expect(storageStateLabel("ERROR")).toBe("Problema de almacenamiento");
  });

  it("conserva el código de un tipo de notificación desconocido", () => {
    expect(notificationTypeLabel("MEDICAL_EMERGENCY")).toBe("Urgencia Médica");
    expect(notificationTypeLabel("OTHER_TYPE")).toBe("OTHER_TYPE");
  });
});
