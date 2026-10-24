import type { ComponentType } from "react";
import { Box, Button, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { ClinicalWorkflowIllustration } from "../components/home/ClinicalWorkflowIllustration";
import {
  ClinicalProcessingIcon,
  ClinicalReviewIcon,
  ClinicalTraceabilityIcon,
} from "../components/home/HomeCapabilityIcons";
import "../styles/home-page.css";

type HomeCapability = {
  title: string;
  description: string;
  icon: ComponentType;
};

const capabilities = [
  {
    title: "Procesamiento de documentos",
    description: "Cargue un PDF, una imagen o texto clínico. MediFlow lo clasifica, extrae sus datos y propone su destino.",
    icon: ClinicalProcessingIcon,
  },
  {
    title: "Revisión humana",
    description: "Los documentos dudosos o incompletos esperan en Auditoría. Compare con el original, corrija y apruebe o rechace.",
    icon: ClinicalReviewIcon,
  },
  {
    title: "Trazabilidad",
    description: "Consulte el resultado de cada documento y las decisiones de revisión registradas.",
    icon: ClinicalTraceabilityIcon,
  },
] satisfies readonly HomeCapability[];

function HomePage() {
  const theme = useTheme();

  return (
    <Box className="home-page" data-color-mode={theme.palette.mode}>
      <Box className="home-page__content">
        <Box component="section" className="home-page__hero" aria-labelledby="home-title">
          <Box className="home-page__hero-copy">
            <Typography component="p" className="home-page__welcome">
              ¡Bienvenido a MediFlow!
            </Typography>
            <Typography component="h1" id="home-title" className="home-page__title">
              MediFlow clasifica documentos clínicos <span>con IA.</span>
            </Typography>
            <Typography component="p" className="home-page__description">
              Cargue un PDF, una imagen o texto. MediFlow extrae los datos importantes y propone su destino. Los casos dudosos o incompletos pasan a revisión humana.
            </Typography>
            <Box className="home-page__actions">
              <Button component={RouterLink} to="/processing" className="home-page__cta home-page__cta--primary" disableElevation disableFocusRipple>
                Cargar documento <ArrowRight size={20} aria-hidden="true" />
              </Button>
              <Button component={RouterLink} to="/audit" className="home-page__cta home-page__cta--secondary" disableFocusRipple>
                <ShieldCheck size={23} aria-hidden="true" /> Revisar casos pendientes
              </Button>
            </Box>
          </Box>
          <ClinicalWorkflowIllustration />
        </Box>

        <Box component="section" className="home-page__capabilities" aria-label="Capacidades de MediFlow">
          {capabilities.map(({ title, description, icon: Icon }) => (
            <Box component="article" className="home-page__feature-card" key={title}>
              <span className="home-page__icon-frame"><Icon /></span>
              <Box>
                <Typography component="h2" className="home-page__feature-title">{title}</Typography>
                <Typography component="p" className="home-page__feature-description">{description}</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <Box className="home-page__trust">
          <ShieldCheck size={25} aria-hidden="true" />
          <Typography component="p" className="home-page__trust-text">
            La decisión final permanece bajo revisión humana cuando corresponde.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default HomePage;
