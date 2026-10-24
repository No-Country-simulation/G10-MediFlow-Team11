import { Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { storageStateLabel } from "../../config/resultLabels";
import type { DocumentStatus, StorageState } from "../../types/processing";
import DocumentIdentity from "../DocumentIdentity";
import ResultStatus from "./ResultStatus";

interface ResultIdentityProps {
  documentId: string;
  status: DocumentStatus;
  storageState: StorageState;
  titleId: string;
}

function ResultIdentity({ documentId, status, storageState, titleId }: ResultIdentityProps) {
  return (
    <>
      <div className="result-panel__header result-panel__header--result">
        <h2 id={titleId} className="result-panel__title result-panel__title--result">Resultado</h2>
        <DocumentIdentity documentId={documentId} />
        <ResultStatus status={status} />
        <Link className="result-history-link" to={`/history?documentId=${encodeURIComponent(documentId)}`}>
          <Clock3 aria-hidden="true" size={14} strokeWidth={1.5} />
          Ver historial
        </Link>
      </div>
      {storageState !== "SUCCESS" && (
        <p className={`result-meta__storage result-meta__storage--${storageState.toLowerCase()}`} role="status">
          {storageStateLabel(storageState)}
        </p>
      )}
    </>
  );
}

export default ResultIdentity;
