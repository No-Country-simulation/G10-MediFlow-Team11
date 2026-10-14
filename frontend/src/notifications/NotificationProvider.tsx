import { useState, type ReactNode } from "react";
import { Alert, Snackbar } from "@mui/material";
import {
  NotificationContext,
  type NotificationOptions,
} from "./NotificationContext";
import "../styles/notifications.css";

interface NotificationProviderProps {
  children: ReactNode;
}

function NotificationProvider({ children }: NotificationProviderProps) {
  const [notification, setNotification] =
    useState<NotificationOptions | null>(null);

  const showNotification = (options: NotificationOptions) => {
    setNotification(options);
  };

  const handleClose = () => {
    setNotification(null);
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}

      <Snackbar
        open={notification !== null}
        autoHideDuration={5000}
        onClose={handleClose}
        className="app-notification"
        anchorOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        {notification ? (
          <Alert
            severity={notification.severity}
            onClose={handleClose}
            variant="filled"
          >
            {notification.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export default NotificationProvider;