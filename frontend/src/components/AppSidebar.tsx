import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import {
  DescriptionOutlined,
  FactCheckOutlined,
  MonitorHeart,
} from "@mui/icons-material";
import { NavLink } from "react-router-dom";

const SIDEBAR_WIDTH = 240;

function AppSidebar() {
  return (
    <Box
      component="aside"
      sx={{
        width: SIDEBAR_WIDTH,
        minWidth: SIDEBAR_WIDTH,
        height: "100vh",
        borderRight: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
      }}
    >
      <Box
        sx={{
          px: 3,
          py: 3,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <MonitorHeart
          sx={{
            fontSize: 32,
            color: "primary.main",
          }}
        />

        <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
          MediFlow
        </Typography>
      </Box>
      <List component="nav" sx={{ px: 2 }}>
        <ListItemButton
          component={NavLink}
          to="/processing"
          sx={{
            borderRadius: 2,
            mb: 1,
            "&.active": {
              bgcolor: "action.selected",
            },
          }}
        >
          <ListItemIcon>
            <DescriptionOutlined />
          </ListItemIcon>
          <ListItemText primary="Procesamiento" />
        </ListItemButton>

        <ListItemButton
          component={NavLink}
          to="/audit"
          sx={{
            borderRadius: 2,
            "&.active": {
              bgcolor: "action.selected",
            },
          }}
        >
          <ListItemIcon>
            <FactCheckOutlined />
          </ListItemIcon>
          <ListItemText primary="Auditoría" />
        </ListItemButton>
      </List>
    </Box>
  );
}

export default AppSidebar;
