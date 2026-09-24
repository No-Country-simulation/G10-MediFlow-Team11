import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import AppSidebar from "../components/AppSidebar";
import AppHeader from "../components/AppHeader";

function AppLayout() {
  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
      }}
    >
      <AppSidebar />

      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <AppHeader />

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