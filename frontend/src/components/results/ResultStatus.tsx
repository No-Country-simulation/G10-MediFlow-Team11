import { statusLabel } from "../../config/resultLabels";
import type { DocumentStatus } from "../../types/processing";
import { getStatusTone } from "./resultPresentation";

interface ResultStatusProps {
  status: DocumentStatus;
}

function ResultStatus({ status }: ResultStatusProps) {
  return (
    <span
      className={`result-status result-status--${getStatusTone(status)}`}
      data-status={status}
    >
      <span className="result-status__dot" aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

export default ResultStatus;
