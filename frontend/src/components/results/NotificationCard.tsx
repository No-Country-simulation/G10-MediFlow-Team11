import { Alert, Box, Card, Divider, Typography } from "@mui/material";
import type { Notification } from "../../types/processing";

interface NotificationCardProps {
  notification: Notification;
}

function NotificationCard({ notification }: NotificationCardProps) {
  if (!notification.generated) {
    return null;
  }

  return (
    <Card variant="outlined">
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Notificación
        </Typography>
      </Box>

      <Divider />

      <Box sx={{ p: 2 }}>
        <Alert severity="info" variant="outlined">
          <Typography variant="body2" sx={{ fontWeight: 600 }} gutterBottom>
            Notificación generada
          </Typography>

          <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
            {notification.message}
          </Typography>
        </Alert>
      </Box>
    </Card>
  );
}

export default NotificationCard;
