import { useId, type ReactNode } from "react";
import {
  destinationLabel,
  storageStateLabel,
} from "../../config/resultLabels";
import type {
  RoutingDecision,
  RoutingDestination,
  Storage,
  StorageState,
} from "../../types/processing";

interface RoutingCardProps {
  routing: RoutingDecision;
  storage: Storage;
}

interface IconProps {
  children: ReactNode;
}

function Icon({ children }: IconProps) {
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
      {children}
    </svg>
  );
}

const destinationIcons: Record<RoutingDestination, ReactNode> = {
  MEDICAL_EMERGENCY: (
    <Icon>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </Icon>
  ),
  PHARMACY: (
    <Icon>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </Icon>
  ),
  AUTHORIZATION_AUDIT: (
    <Icon>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </Icon>
  ),
  MEDICAL_RECORD: (
    <Icon>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </Icon>
  ),
  HUMAN_REVIEW: (
    <Icon>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </Icon>
  ),
};

const storageIcons: Record<StorageState, ReactNode> = {
  SUCCESS: (
    <Icon>
      <polyline points="20 6 9 17 4 12" />
    </Icon>
  ),
  PENDING: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Icon>
  ),
  ERROR: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </Icon>
  ),
};

function RoutingCard({ routing, storage }: RoutingCardProps) {
  const titleId = useId();

  return (
    <section className="result-card" aria-labelledby={titleId}>
      <div className="result-card__header">
        <h3 id={titleId} className="result-card__title">
          Enrutamiento
        </h3>
      </div>

      <div className="result-card__body result-card__body--stack">
        <div className="result-routing__destination">
          <span className="result-routing__destination-icon">
            {destinationIcons[routing.primary_destination]}
          </span>
          <div>
            <p className="result-routing__destination-label">
              Destino principal
            </p>
            <p className="result-routing__destination-value">
              {destinationLabel(routing.primary_destination)}
            </p>
          </div>
        </div>

        {routing.requires_human_review && (
          <div className="result-routing__review">
            <span className="result-routing__review-label">
              Revisión humana
            </span>
            <span className="result-routing__review-badge">Requerida</span>
          </div>
        )}

        {routing.justification && (
          <div className="result-routing__justification">
            <p className="result-routing__justification-label">Justificación</p>
            <p className="result-card__text">{routing.justification}</p>
          </div>
        )}

        <div
          className={`result-routing__storage result-routing__storage--${storage.state.toLowerCase()}`}
        >
          {storageIcons[storage.state]}
          <span>{storageStateLabel(storage.state)}</span>
        </div>
      </div>
    </section>
  );
}

export default RoutingCard;
