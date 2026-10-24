import CopyIdButton from "./results/CopyIdButton";
import "../styles/document-identity.css";

export default function DocumentIdentity({ documentId }: { documentId: string }) {
  const suffixLength = documentId.length > 12 ? 7 : 0;
  return (
    <div className="document-identity">
      <span className="document-identity__sr-only">Documento: {documentId}</span>
      <code className="document-identity__value" aria-hidden="true" title={documentId}>
        <span className="document-identity__prefix">{suffixLength ? documentId.slice(0, -suffixLength) : documentId}</span>
        {suffixLength > 0 && <span className="document-identity__suffix">{documentId.slice(-suffixLength)}</span>}
      </code>
      <CopyIdButton value={documentId} />
    </div>
  );
}
