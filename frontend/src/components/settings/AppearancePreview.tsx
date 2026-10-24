import { useId } from "react";
import { CircleHelp, ClipboardCheck, FileText, House, Settings } from "lucide-react";
import type { AppearancePreference } from "../../theme/appearance";

function PreviewScene() {
  return (
    <g className="settings-page__preview-scene">
      <rect width="240" height="138" fill="var(--preview-background)" />
      <path d="M68 0H240V22H68ZM0 0H68V138H0Z" fill="var(--preview-surface)" />
      <path d="M68 0V138M68 22H240" stroke="var(--preview-border)" strokeWidth="0.7" />

      <image href={`${import.meta.env.BASE_URL}brand/sidebar-96.png`} x="8" y="9" width="13" height="13" />
      <text x="25" y="16" className="settings-page__preview-brand">MediFlow</text>
      <text x="25" y="22" fontSize="3.6">IA al servicio de la salud</text>
      <g fill="none" stroke="var(--preview-text)">
        <House x="9" y="33" width="8" height="8" strokeWidth="1.5" />
        <ClipboardCheck x="9" y="81" width="8" height="8" strokeWidth="1.5" />
        <CircleHelp x="9" y="109" width="8" height="8" strokeWidth="1.5" />
        <Settings x="9" y="123" width="8" height="8" strokeWidth="1.5" />
      </g>
      <text x="22" y="39">Inicio</text>
      <text x="9" y="50" fontSize="3.8" letterSpacing="0.5">PROCESAR</text>
      <rect x="5" y="54" width="58" height="17" rx="3" fill="var(--preview-selected)" />
      <FileText x="9" y="58" width="8" height="8" stroke="var(--preview-action)" strokeWidth="1.5" />
      <text x="22" y="64" fill="var(--preview-action)">Procesamiento</text>
      <text x="9" y="77" fontSize="3.8" letterSpacing="0.5">REVISAR</text>
      <text x="22" y="87">Auditoría</text>
      <text x="22" y="115">Ayuda</text>
      <text x="22" y="129">Configuración</text>

      <House x="79" y="8" width="6" height="6" stroke="var(--preview-text)" strokeWidth="1.5" />
      <text x="89" y="13" fontSize="4.8">MediFlow / Procesamiento</text>
      <text x="79" y="36" className="settings-page__preview-title">Procesamiento de documentos</text>
      <text x="79" y="44" fontSize="4.5">Clasificación, extracción y enrutamiento clínico</text>
      <text x="79" y="55" fill="var(--preview-action)">Archivo</text>
      <text x="112" y="55">Texto</text>
      <path d="M79 59H229" stroke="var(--preview-border)" strokeWidth="0.7" />
      <path d="M79 59H103" stroke="var(--preview-action)" strokeWidth="1.3" />

      <rect x="79" y="65" width="150" height="47" rx="4" fill="var(--preview-surface)" stroke="var(--preview-border)" strokeWidth="0.7" />
      <rect x="143" y="71" width="22" height="23" rx="5" fill="var(--preview-selected)" />
      <path d="M150 75H156L160 79V90H148V77Q148 75 150 75ZM156 75V79H160M151 84H157M151 87H155" fill="none" stroke="var(--preview-action)" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
      <text x="154" y="101" textAnchor="middle" fontSize="5">PDF, JPG o PNG</text>
      <text x="154" y="108" textAnchor="middle" fontSize="4.5" fill="var(--preview-action)">+ Seleccionar archivo</text>
      <rect x="139" y="119" width="90" height="12" rx="3" fill="var(--preview-button)" />
      <text x="184" y="127" textAnchor="middle" fill="#ffffff" fontSize="5">Procesar documento</text>
    </g>
  );
}

export function AppearancePreview({ preference }: { preference: AppearancePreference }) {
  const id = useId();
  return (
    <svg className="settings-page__preview" viewBox="0 0 240 138" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`${id}-light`}><rect width="120" height="138" /></clipPath>
        <clipPath id={`${id}-dark`}><rect x="120" width="120" height="138" /></clipPath>
      </defs>
      {preference !== 'dark' && (
        <g className="settings-page__preview-light" clipPath={preference === 'system' ? `url(#${id}-light)` : undefined}>
          <PreviewScene />
        </g>
      )}
      {preference !== 'light' && (
        <g className="settings-page__preview-dark" clipPath={preference === 'system' ? `url(#${id}-dark)` : undefined}>
          <PreviewScene />
        </g>
      )}
      {preference === 'system' && <path d="M120 0V138" stroke="var(--mui-palette-mediflow-borderStrong)" />}
    </svg>
  );
}


