import { ArrowRight, Check, FileText, History, Plus, ShieldCheck, UserRoundCheck } from "lucide-react";
import { Box, Button, Card, Stack, Typography } from "@mui/material";
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
              fontFamily: '"Manrope", "Segoe UI", sans-serif',
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

        <Box
          role="img"
          aria-label="Ilustración de un documento organizado y validado"
          sx={{
            minHeight: { xs: 220, sm: 260, md: 300 },
            position: "relative",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            borderRadius: 1,
            bgcolor: "#edf5fc",
            backgroundImage:
              "linear-gradient(rgba(115, 154, 197, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(115, 154, 197, 0.07) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        >
          <Box
            aria-hidden="true"
            sx={{
              position: "absolute",
              width: { xs: 190, sm: 220, md: 245 },
              aspectRatio: "1",
              border: "1px solid rgba(53, 133, 208, 0.2)",
              borderRadius: "50%",
              boxShadow:
                "0 0 0 22px rgba(255,255,255,0.18), 0 0 0 48px rgba(53,133,208,0.035)",
            }}
          />

          <Card
            aria-hidden="true"
            variant="outlined"
            sx={{
              zIndex: 1,
              width: 170,
              minHeight: 205,
              p: 2,
              borderRadius: 1,
              borderColor: "#dbe6f0",
              boxShadow: "0 18px 36px rgba(29, 70, 117, 0.12)",
              transform: "rotate(-2deg)",
            }}
          >
            <Box
              sx={{
                width: 38,
                height: 42,
                display: "grid",
                placeItems: "center",
                mb: 2,
                borderRadius: 1,
                bgcolor: "#e9f2ff",
                color: "primary.main",
              }}
            >
              <FileText size={21} />
            </Box>
            <Stack spacing={1.25}>
              {["100%", "88%", "94%", "62%"].map((width, index) => (
                <Box
                  key={index}
                  sx={{ height: 6, width, borderRadius: 4, bgcolor: "#b7d3f7" }}
                />
              ))}
            </Stack>
          </Card>

          <Box
            aria-hidden="true"
            sx={{
              position: "absolute",
              top: { xs: 30, md: 40 },
              right: { xs: 16, md: 28 },
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              color: "common.white",
              bgcolor: "primary.main",
              boxShadow: "0 6px 14px rgba(23,105,245,0.22)",
            }}
          >
            <Check size={17} />
          </Box>
          <Box
            aria-hidden="true"
            sx={{
              position: "absolute",
              right: { xs: 8, md: 16 },
              top: "47%",
              width: 38,
              height: 38,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              color: "common.white",
              bgcolor: "primary.main",
              boxShadow: "0 6px 14px rgba(23,105,245,0.22)",
            }}
          >
            <Check size={19} />
          </Box>
          <Box
            aria-hidden="true"
            sx={{
              position: "absolute",
              bottom: 22,
              left: { xs: 28, md: 56 },
              width: 30,
              height: 30,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              color: "common.white",
              bgcolor: "#59bdca",
            }}
          >
            <Plus size={18} />
          </Box>
        </Box>
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
                bgcolor: title === "Revisión humana" ? "#e8f6f5" : "#e9f2ff",
                color: title === "Revisión humana" ? "#117f83" : "primary.main",
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
          bgcolor: "#eaf3fc",
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