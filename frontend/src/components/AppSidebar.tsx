import { Box, Divider, List } from "@mui/material";
import MediFlowBrand from "./MediFlowBrand";
import SidebarNavItem from "./SidebarNavItem";
import { PRIMARY_NAVIGATION, SECONDARY_NAVIGATION } from "../config/navigation";
import {
  HEADER_HEIGHT,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_WIDTH,
} from "../layouts/layoutConstants";

type AppSidebarProps = {
  id: string;
  collapsed: boolean;
  onNavigate?: () => void;
};

function AppSidebar({ id, collapsed, onNavigate }: AppSidebarProps) {
  return (
    <Box
      component="aside"
      id={id}
      sx={(theme) => ({
        width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        // "clip" (not "hidden") so the clipped labels can never scroll the rail horizontally.
        overflowX: "clip",
        bgcolor: "background.sidebar",
        borderRight: 1,
        borderColor: "divider",
        transition: theme.transitions.create("width", {
          duration: theme.transitions.duration.shorter,
        }),
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
        },
      })}
    >
      {/* Mirrors AppHeader's box (content + 1px bottom border) so both share the same vertical center. */}
      <Box
        sx={(theme) => ({
          height: HEADER_HEIGHT,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid transparent",
          pl: collapsed ? 1.25 : 4.25,
          pr: 2,
          transition: theme.transitions.create("padding", {
            duration: theme.transitions.duration.shorter,
          }),
          "@media (prefers-reduced-motion: reduce)": {
            transition: "none",
          },
        })}
      >
        <MediFlowBrand collapsed={collapsed} />
      </Box>

      <List
        component="nav"
        aria-label="Navegación principal"
        disablePadding
        sx={{ display: "flex", flexDirection: "column", pt: 3 }}
      >
        {PRIMARY_NAVIGATION.map((item) => (
          <SidebarNavItem
            key={item.label}
            {...item}
            collapsed={collapsed}
            onClick={onNavigate}
          />
        ))}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Divider sx={{ mx: collapsed ? 2 : 3.5 }} />

      <List
        component="div"
        disablePadding
        sx={{ display: "flex", flexDirection: "column", gap: 1.25, pt: 2.75, pb: 10 }}
      >
        {SECONDARY_NAVIGATION.map((item) => (
          <SidebarNavItem key={item.label} {...item} dense disabled collapsed={collapsed} />
        ))}
      </List>
    </Box>
  );
}

export default AppSidebar;
