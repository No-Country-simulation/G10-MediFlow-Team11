import { useState } from "react";
import { Box, Breadcrumbs, IconButton, Tooltip, Typography } from "@mui/material";
import { MenuOpenOutlined, MenuOutlined } from "@mui/icons-material";
import { matchPath, useLocation } from "react-router-dom";
import { PRIMARY_NAVIGATION } from "../config/navigation";
import { HEADER_HEIGHT } from "../layouts/layoutConstants";
import { focusRing } from "../theme/focusRing";

type AppHeaderProps = {
  sidebarId: string;
  sidebarExpanded: boolean;
  onToggleSidebar: () => void;
};

function AppHeader({ sidebarId, sidebarExpanded, onToggleSidebar }: AppHeaderProps) {
  const { pathname } = useLocation();

  const section = PRIMARY_NAVIGATION.find(
    (item) => item.to && matchPath({ path: item.to, end: false }, pathname),
  );

  const [tooltipOpen, setTooltipOpen] = useState(false);

  const toggleLabel = sidebarExpanded ? "Ocultar barra lateral" : "Mostrar barra lateral";

  const handleToggle = () => {
    setTooltipOpen(false);
    onToggleSidebar();
  };

  return (
    <Box
      component="header"
      sx={{
        height: HEADER_HEIGHT,
        px: 3,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Tooltip
        title={toggleLabel}
        open={tooltipOpen}
        onOpen={() => setTooltipOpen(true)}
        onClose={() => setTooltipOpen(false)}
      >
        <IconButton
          edge="start"
          aria-label={toggleLabel}
          aria-expanded={sidebarExpanded}
          aria-controls={sidebarId}
          onClick={handleToggle}
          sx={(theme) => ({
            color: "text.secondary",
            "&.Mui-focusVisible": focusRing(theme),
          })}
        >
          {sidebarExpanded ? <MenuOpenOutlined /> : <MenuOutlined />}
        </IconButton>
      </Tooltip>

      <Breadcrumbs aria-label="Ubicación actual" sx={{ typography: "body2" }}>
        <Typography variant="body2" color="text.secondary">
          MediFlow
        </Typography>

        {section && (
          <Typography
            variant="body2"
            aria-current="page"
            sx={{ color: "text.primary", fontWeight: 500 }}
          >
            {section.label}
          </Typography>
        )}
      </Breadcrumbs>
    </Box>
  );
}

export default AppHeader;
