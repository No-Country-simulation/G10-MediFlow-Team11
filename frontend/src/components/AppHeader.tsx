import { AccountCircleOutlined } from "@mui/icons-material";
import { Box, Typography } from "@mui/material";

function AppHeader() {
  return (
    <Box
      component="header"
      sx={{
        height: 72,
        px: 3,
        borderBottom: 1,
        borderColor: "divider",
        display: "flex",
        bgcolor: "background.paper",
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <AccountCircleOutlined />

        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Usuario MediFlow
          </Typography>

          <Typography variant="caption" color="text.secondary">
            Usuario
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default AppHeader;
