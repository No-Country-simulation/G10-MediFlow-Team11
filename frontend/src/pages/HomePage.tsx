import { ArrowRight, Check, FileText, History, Plus, ShieldCheck, UserRoundCheck } from "lucide-react";
import { Box, Button, Card, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";

const accessCards = [
  {
    title: "Procesamiento de documentos",
    description: "Carga archivos PDF, JPG o PNG, o ingresa texto clínico.",
    icon: FileText,
  },
  {
    title: "Revisión humana",
    description: "Consulta los documentos que requieren validación en la sección de auditoría.",
    icon: UserRoundCheck,
  },
  {
    title: "Trazabilidad",
    description: "Consulta resultados y el historial de cada documento.",
    icon: History,
  },
];

function DocumentFlowIllustration() {
  return (
    <Box
      role="img"
      aria-label="Documentos conectados a un flujo de clasificación y revisión"
      sx={(theme) => ({
        minHeight: { xs: 215, sm: 260, md: 310 },
        position: "relative",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        background: `radial-gradient(ellipse at 52% 52%, ${alpha(theme.palette.primary.light, 0.22)} 0%, ${alpha(theme.palette.info.light, 0.1)} 42%, transparent 72%)`,
      })}
    >
      <Box
        aria-hidden="true"
        sx={(theme) => ({
          position: "absolute",
          width: "62%",
          height: "1px",
          top: "51%",
          left: "17%",
          bgcolor: alpha(theme.palette.info.main, 0.45),
          transform: "rotate(17deg)",
          transformOrigin: "center",
        })}
      />
      <Box
        aria-hidden="true"
        sx={(theme) => ({
          position: "absolute",
          width: "37%",
          height: "1px",
          top: "57%",
          left: "43%",
          bgcolor: alpha(theme.palette.info.main, 0.4),
          transform: "rotate(-19deg)",
          transformOrigin: "center",
        })}
      />

      <Card
        aria-hidden="true"
        variant="outlined"
        sx={{
          zIndex: 1,
          width: { xs: 142, md: 166 },
          minHeight: { xs: 168, md: 194 },
          p: 2,
          borderRadius: 1,
          bgcolor: "background.paper",
          borderColor: "divider",
          boxShadow: 4,
          transform: "rotate(-2deg)",
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 40,
            display: "grid",
            placeItems: "center",
            mb: 1.75,
            borderRadius: 1,
            bgcolor: "action.hover",
            color: "primary.main",
          }}
        >
          <FileText size={20} aria-hidden="true" />
        </Box>
        <Stack spacing={1.25}>
          {["100%", "88%", "94%", "62%"].map((width, index) => (
            <Box
              key={index}
              sx={{
                height: 6,
                width,
                borderRadius: 4,
                bgcolor: "primary.light",
                opacity: 0.58,
              }}
            />
          ))}
        </Stack>
      </Card>

      <Card
        aria-hidden="true"
        variant="outlined"
        sx={{
          position: "absolute",
          zIndex: 2,
          top: { xs: "22%", md: "25%" },
          left: { xs: "4%", md: "9%" },
          width: 58,
          height: 68,
          p: 1,
          borderRadius: 1,
          bgcolor: "background.paper",
          borderColor: "divider",
          boxShadow: 2,
          transform: "rotate(-3deg)",
        }}
      >
        <FileText size={16} color="currentColor" aria-hidden="true" />
        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
          <Box sx={{ height: 3, width: "100%", borderRadius: 2, bgcolor: "primary.light", opacity: 0.6 }} />
          <Box sx={{ height: 3, width: "78%", borderRadius: 2, bgcolor: "primary.light", opacity: 0.45 }} />
        </Stack>
      </Card>

      <Card
        aria-hidden="true"
        variant="outlined"
        sx={{
          position: "absolute",
          zIndex: 2,
          right: { xs: "1%", md: "0%" },
          bottom: { xs: "25%", md: "27%" },
          width: { xs: 80, md: 96 },
          height: 52,
          p: 1.25,
          borderRadius: 1,
          bgcolor: "background.paper",
          borderColor: "divider",
          boxShadow: 2,
          transform: "rotate(1deg)",
        }}
      >
        <Stack spacing={0.75}>
          <Box sx={{ height: 4, width: "100%", borderRadius: 3, bgcolor: "info.light", opacity: 0.75 }} />
          <Box sx={{ height: 4, width: "100%", borderRadius: 3, bgcolor: "info.light", opacity: 0.55 }} />
          <Box sx={{ height: 4, width: "64%", borderRadius: 3, bgcolor: "info.light", opacity: 0.45 }} />
        </Stack>
      </Card>

      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          top: { xs: "12%", md: "12%" },
          right: { xs: "16%", md: "15%" },
          width: 30,
          height: 30,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          color: "common.white",
          bgcolor: "primary.main",
          boxShadow: 2,
        }}
      >
        <Check size={16} />
      </Box>
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          top: "44%",
          right: { xs: "1%", md: "3%" },
          width: 38,
          height: 38,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          color: "common.white",
          bgcolor: "primary.main",
          boxShadow: 2,
        }}
      >
        <Check size={19} />
      </Box>
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          bottom: { xs: "9%", md: "8%" },
          left: { xs: "18%", md: "20%" },
          width: 28,
          height: 28,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          color: "common.white",
          bgcolor: "info.main",
        }}
      >
        <Plus size={17} />
      </Box>
    </Box>
  );
}

function HomePage() {
  return (
    <Box sx={{ width: "100%", maxWidth: 1240, mx: "auto" }}>
      <Box
        component="section"
        aria-labelledby="home-title"
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "minmax(0, 1.1fr) minmax(300px, 0.9fr)",
          },
          alignItems: "center",
          gap: { xs: 2, md: 3 },
          py: { xs: 1, md: 2.5 },
        }}
      >
        <Stack spacing={2} sx={{ maxWidth: 620, py: { xs: 1, md: 2 } }}>
          <Typography
            variant="subtitle2"
            sx={{ color: "primary.main", fontWeight: 700 }}
          >
            ¡Bienvenido a MediFlow!
          </Typography>

          <Typography
            id="home-title"
            component="h1"
            sx={{
              color: "text.primary",
              fontSize: { xs: 36, sm: 42, lg: 48 },
              fontWeight: 800,
              lineHeight: 1.12,
            }}
          >
            Menos tareas manuales.
            <Box component="span" sx={{ display: "block", color: "primary.main" }}>
              Más tiempo para cuidar.
            </Box>
          </Typography>

          <Typography
            variant="body1"
            sx={{ maxWidth: 560, color: "text.secondary", lineHeight: 1.65 }}
          >
            Organiza y revisa documentos clínicos desde un solo lugar, con
            trazabilidad y revisión humana cuando hace falta.
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              component={RouterLink}
              to="/processing"
              variant="contained"
              endIcon={<ArrowRight size={18} aria-hidden="true" />}
              sx={{ minHeight: 44, px: 2.25, alignSelf: "flex-start" }}
            >
              Comenzar procesamiento
            </Button>
            <Button
              component={RouterLink}
              to="/audit"
              variant="outlined"
              startIcon={<ShieldCheck size={18} aria-hidden="true" />}
              sx={{ minHeight: 44, px: 2.25, alignSelf: "flex-start" }}
            >
              Ir a auditoría
            </Button>
          </Stack>
        </Stack>

        <DocumentFlowIllustration />
      </Box>

      <Box
        component="section"
        aria-label="Información sobre las funciones de MediFlow"
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" },
          gap: 1.75,
          mt: { xs: 1, md: 2 },
        }}
      >
        {accessCards.map(({ title, description, icon: Icon }) => (
          <Card
            key={title}
            variant="outlined"
            sx={{
              minHeight: { xs: 142, md: 165 },
              p: 2.25,
              borderRadius: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <Box
              sx={{
                width: 38,
                height: 38,
                display: "grid",
                placeItems: "center",
                mb: 1.5,
                borderRadius: "50%",
                bgcolor: title === "Revisión humana" ? "info.light" : "action.hover",
                color: title === "Revisión humana" ? "info.dark" : "primary.main",
              }}
            >
              <Icon size={20} aria-hidden="true" />
            </Box>
            <Typography component="h2" variant="subtitle1" sx={{ mb: 0.5, fontWeight: 700 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
              {description}
            </Typography>
          </Card>
        ))}
      </Box>

      <Box
        component="aside"
        sx={{
          minHeight: 52,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          mt: 2.5,
          px: 2,
          py: 1.25,
          borderRadius: 1,
          color: "text.secondary",
          bgcolor: "action.hover",
        }}
      >
        <ShieldCheck size={19} aria-hidden="true" />
        <Typography variant="body2" sx={{ fontSize: 12 }}>
          La decisión final permanece bajo revisión humana cuando corresponde.
        </Typography>
      </Box>
    </Box>
  );
}

export default HomePage;