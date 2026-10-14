import { useId } from "react";
import { notificationTypeLabel } from "../../config/resultLabels";
import type { Notification } from "../../types/processing";

interface NotificationCardProps {
  notification: Notification;
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function NotificationCard({ notification }: NotificationCardProps) {
  const titleId = useId();

  if (!notification.generated) {
    return null;
  }

  return (
    <section
      className="result-card result-card--attention"
      aria-labelledby={titleId}
    >
      <div className="result-card__header result-card__header--icon">
        <BellIcon />
        <h3 id={titleId} className="result-card__title">
          Notificación generada
        </h3>
      </div>

      <div className="result-card__body result-card__body--stack result-card__body--tight">
        {notification.type && (
          <p className="result-card__emphasis">
            {notificationTypeLabel(notification.type)}
          </p>
        )}
        {notification.message && (
          <p className="result-card__text">{notification.message}</p>
        )}
      </div>
    </section>
  );
}

export default NotificationCard;
