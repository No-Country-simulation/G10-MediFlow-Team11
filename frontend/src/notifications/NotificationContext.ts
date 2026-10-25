import { createContext } from "react";

export type NotificationSeverity = "success" | "warning" | "error";

export interface NotificationOptions {
  message: string;
  severity: NotificationSeverity;
}

export interface NotificationContextValue {
  showNotification: (notification: NotificationOptions) => void;
}

export const NotificationContext =
  createContext<NotificationContextValue | null>(null);
