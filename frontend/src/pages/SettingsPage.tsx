import { useId } from "react";
import { Box, Typography } from "@mui/material";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { AppearancePreview } from "../components/settings/AppearancePreview";
import { useAppearance, type AppearancePreference } from "../theme/appearance";
import "../styles/settings-page.css";

const appearanceOptions = [
  { value: "light", label: "Claro", description: "Superficies luminosas y tonos suaves.", icon: Sun },
  { value: "dark", label: "Oscuro", description: "Superficies oscuras y contraste cuidado.", icon: Moon },
  { value: "system", label: "Sistema", description: "Se adapta a la apariencia de tu dispositivo.", icon: Monitor },
] satisfies ReadonlyArray<{
  value: AppearancePreference;
  label: string;
  description: string;
  icon: typeof Sun;
}>;

export default function SettingsPage() {
  const { preference, resolvedMode, setPreference } = useAppearance();
  const id = useId();
  const selectedDescription = preference === "system"
    ? `MediFlow sigue la apariencia de tu dispositivo. Ahora utiliza el tema ${resolvedMode === "dark" ? "oscuro" : "claro"}.`
    : `La interfaz de MediFlow permanece en modo ${preference === "dark" ? "oscuro" : "claro"}.`;

  return (
    <Box className="settings-page">
      <Box className="settings-page__content">
        <Box component="header" className="settings-page__header">
          <Typography component="h1">Configuración</Typography>
          <Typography component="p">Personaliza la apariencia de MediFlow.</Typography>
        </Box>
        <Box component="section" className="settings-page__section" aria-labelledby={`${id}-title`}>
          <Box className="settings-page__section-heading">
            <span className="settings-page__section-icon"><Sun size={22} strokeWidth={1.6} aria-hidden="true" /></span>
            <Box>
              <Typography component="h2" id={`${id}-title`}>Apariencia</Typography>
              <Typography component="p">Elige el tema que prefieras para la interfaz.</Typography>
            </Box>
          </Box>
          <fieldset className="settings-page__options" role="radiogroup" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
            <legend className="settings-page__sr-only">Tema de la aplicación</legend>
            {appearanceOptions.map(({ value, label, description, icon: Icon }) => (
              <label key={value} className="settings-page__option">
                <span className="settings-page__preview-frame"><AppearancePreview preference={value} /></span>
                <span className="settings-page__option-details">
                  <span className="settings-page__option-heading">
                    <Icon size={18} strokeWidth={1.6} aria-hidden="true" />
                    <span id={`${id}-${value}-label`} className="settings-page__option-title">{label}</span>
                    <input
                      className="settings-page__radio"
                      type="radio"
                      name={`${id}-theme`}
                      value={value}
                      checked={preference === value}
                      onChange={() => setPreference(value)}
                      aria-labelledby={`${id}-${value}-label`}
                      aria-describedby={`${id}-${value}-description`}
                    />
                  </span>
                  <span id={`${id}-${value}-description`} className="settings-page__option-description">{description}</span>
                  <span className="settings-page__option-state" aria-hidden="true">
                    {preference === value && <><Check size={15} strokeWidth={2} /> Seleccionado</>}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <Box className="settings-page__current" role="status" aria-live="polite" aria-atomic="true">
            <Check size={18} strokeWidth={1.8} aria-hidden="true" />
            <Box>
              <Typography component="p" className="settings-page__current-title">
                {preference === "system" ? "Apariencia del sistema" : `Tema ${preference === "dark" ? "oscuro" : "claro"} activado`}
              </Typography>
              <Typography component="p" id={`${id}-description`}>{selectedDescription}</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
