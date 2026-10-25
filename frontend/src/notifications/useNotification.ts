import { useContext } from "react";
import { NotificationContext } from "./NotificationContext";
import { getErrorMessage } from "./getErrorMessage";

export function useNotification() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotification must be used within a NotificationProvider",
    );
  }

  const showError = (error: unknown) => {
    context.showNotification({
      message: getErrorMessage(error),
      severity: "error",
    });
  };

  return {
    ...context,
    showError,
  };
}
