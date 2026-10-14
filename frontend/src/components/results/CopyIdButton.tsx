import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";

interface CopyIdButtonProps {
  value: string;
}

type CopyState = "idle" | "copied" | "failed";

const FEEDBACK_DURATION_MS = 1800;

const FEEDBACK_MESSAGES: Record<CopyState, string> = {
  idle: "",
  copied: "Identificador copiado al portapapeles",
  failed: "No fue posible copiar el identificador",
};

function CopyIdButton({ value }: CopyIdButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const showFeedback = (next: CopyState) => {
    window.clearTimeout(timeoutRef.current);
    setState(next);
    timeoutRef.current = window.setTimeout(
      () => setState("idle"),
      FEEDBACK_DURATION_MS,
    );
  };

  const handleCopy = () => {
    if (!navigator.clipboard) {
      showFeedback("failed");
      return;
    }

    navigator.clipboard.writeText(value).then(
      () => showFeedback("copied"),
      () => showFeedback("failed"),
    );
  };

  const label =
    state === "copied"
      ? "Copiado"
      : state === "failed"
        ? "No copiado"
        : "Copiar ID";

  return (
    <>
      <button
        type="button"
        className={`result-copy-button result-copy-button--${state}`}
        onClick={handleCopy}
      >
        <Copy aria-hidden="true" size={15} strokeWidth={1.25} />
        <span>{label}</span>
      </button>
      <span className="result-visually-hidden" role="status" aria-live="polite">
        {FEEDBACK_MESSAGES[state]}
      </span>
    </>
  );
}

export default CopyIdButton;
