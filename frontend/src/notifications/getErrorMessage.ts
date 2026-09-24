import { ApiError } from "../services/processingService";

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return "No se pudo procesar la solicitud. Revisa los datos enviados.";

      case 404:
        return "No se encontró el recurso solicitado.";

      case 413:
        return "El archivo seleccionado supera el tamaño permitido.";

      case 422:
        return "No se pudo procesar el contenido del documento.";

      case 500:
      case 502:
      case 503:
        return "El servicio no está disponible en este momento. Inténtalo más tarde.";

      default:
        return "Ocurrió un error al procesar la solicitud.";
    }
  }

  return "No fue posible comunicarse con el servicio. Verifica tu conexión e inténtalo nuevamente.";
}
