import { Box, Typography } from "@mui/material";

const SYMBOL_SIZE = 52;
const SYMBOL_SRC = `${import.meta.env.BASE_URL}brand/mediflow-symbol.svg`;

type MediFlowBrandProps = {
  collapsed?: boolean;
};

function MediFlowBrand({ collapsed = false }: MediFlowBrandProps) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box
        component="img"
        src={SYMBOL_SRC}
        alt=""
        width={SYMBOL_SIZE}
        height={SYMBOL_SIZE}
        sx={{ display: "block", flexShrink: 0 }}
      />

      <Box
        sx={(theme) => ({
          flexShrink: 0,
          opacity: collapsed ? 0 : 1,
          transition: theme.transitions.create("opacity", {
            duration: theme.transitions.duration.shorter,
          }),
          "@media (prefers-reduced-motion: reduce)": {
            transition: "none",
          },
        })}
      >
        <Typography
          component="span"
          sx={{
            display: "block",
            fontSize: "1.5rem",
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
          }}
        >
          MediFlow
        </Typography>

        <Typography
          variant="caption"
          component="span"
          noWrap
          sx={{
            display: "block",
            lineHeight: 1.4,
            fontWeight: 500,
            color: "text.secondary",
          }}
        >
          IA al servicio de la salud
        </Typography>
      </Box>
    </Box>
  );
}

export default MediFlowBrand;
