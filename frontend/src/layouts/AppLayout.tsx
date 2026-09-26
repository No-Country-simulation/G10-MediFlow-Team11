import { useId, useState } from "react";
import { Box, Drawer, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Outlet } from "react-router-dom";
import AppSidebar from "../components/AppSidebar";
import AppHeader from "../components/AppHeader";

function AppLayout() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"), { noSsr: true });
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  const [expandedPreference, setExpandedPreference] = useState<boolean | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarId = useId();

  if (!isMobile && drawerOpen) {
    setDrawerOpen(false);
  }

  const sidebarExpanded = expandedPreference ?? isDesktop;

  const handleToggleSidebar = () => {
    if (isMobile) {
      setDrawerOpen(!drawerOpen);
    } else {
      setExpandedPreference(!sidebarExpanded);
    }
  };

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
      }}
    >
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={closeDrawer}
          slotProps={{ root: { keepMounted: true } }}
        >
          <AppSidebar id={sidebarId} collapsed={false} onNavigate={closeDrawer} />
        </Drawer>
      ) : (
        <AppSidebar id={sidebarId} collapsed={!sidebarExpanded} />
      )}

      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <AppHeader
          sidebarId={sidebarId}
          sidebarExpanded={isMobile ? drawerOpen : sidebarExpanded}
          onToggleSidebar={handleToggleSidebar}
        />

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            bgcolor: "background.default",
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

export default AppLayout;
