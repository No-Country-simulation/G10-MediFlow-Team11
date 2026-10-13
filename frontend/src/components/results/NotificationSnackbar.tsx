import { useState } from "react";
import { Alert, Snackbar } from "@mui/material";
import type { Notification } from "../../types/processing";

interface NotificationSnackbarProps {
  notification: Notification;
}

function NotificationSnackbar({ notification }: NotificationSnackbarProps) {
  const [open, setOpen] = useState(notification.generated);

  if (!notification.generated) {
    return null;
  }

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={6000}
      onClose={handleClose}
      anchorOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
    >
      <Alert
        severity="info"
        variant="filled"
        onClose={handleClose}
        sx={{
          width: "100%",
          maxWidth: 420,
          overflowWrap: "anywhere",
        }}
      >
        {notification.message}
      </Alert>
    </Snackbar>
  );
}

export default NotificationSnackbar;
