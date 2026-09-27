import type { ReactNode } from "react";
import {
  Box,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  type SxProps,
  type Theme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { NavLink } from "react-router-dom";
import { focusRing } from "../theme/focusRing";

const ACCENT_WIDTH = 5;

type SidebarNavItemProps = {
  icon: ReactNode;
  label: string;
  to?: string;
  disabled?: boolean;
  dense?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
};

const getNavItemSx = (collapsed: boolean): SxProps<Theme> => (theme) => ({
  position: "relative",
  minHeight: 46,
  py: 0.875,
  mr: collapsed ? 1 : 1.75,
  pl: collapsed ? 3 : 4.25,
  pr: 2,
  overflow: "hidden",
  color: "text.primary",
  borderRadius: 2.5,
  borderTopLeftRadius: 0,
  borderBottomLeftRadius: 0,
  transition: theme.transitions.create(["padding", "margin", "background-color"], {
    duration: theme.transitions.duration.shorter,
  }),
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
    "& .MuiListItemText-root": {
      transition: "none",
    },
  },
  "& .MuiListItemIcon-root": {
    minWidth: 0,
    mr: 3,
    color: "text.secondary",
  },
  "& .MuiListItemText-root": {
    whiteSpace: "nowrap",
    opacity: collapsed ? 0 : 1,
    transition: theme.transitions.create("opacity", {
      duration: theme.transitions.duration.shorter,
    }),
  },
  "& .MuiListItemText-primary": {
    fontWeight: 500,
  },
  "&:hover": {
    bgcolor: "action.hover",
  },
  "&.Mui-focusVisible": focusRing(theme),
  "&.active": {
    bgcolor: alpha(theme.palette.primary.main, 0.14),
    "&::before": {
      content: '""',
      position: "absolute",
      inset: "0 auto 0 0",
      width: ACCENT_WIDTH,
      bgcolor: "primary.main",
    },
    "& .MuiListItemIcon-root": {
      color: "primary.main",
    },
    "& .MuiListItemText-primary": {
      fontWeight: 600,
    },
  },
  "&.MuiListItemButton-dense": {
    minHeight: 40,
    py: 0.5,
  },
  "&.Mui-disabled": {
    opacity: 1,
    color: "text.secondary",
  },
});

function SidebarNavItem({
  icon,
  label,
  to,
  disabled = false,
  dense = false,
  collapsed = false,
  onClick,
}: SidebarNavItemProps) {
  const linkTo = disabled ? undefined : to;
  const sx = getNavItemSx(collapsed);

  const content = (
    <>
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText
        primary={label}
        slotProps={{ primary: { variant: dense ? "body2" : "body1" } }}
      />
    </>
  );

  const item = linkTo ? (
    <ListItemButton component={NavLink} to={linkTo} dense={dense} onClick={onClick} sx={sx}>
      {content}
    </ListItemButton>
  ) : (
    <Box>
      <ListItemButton disabled dense={dense} sx={sx}>
        {content}
      </ListItemButton>
    </Box>
  );

  return (
    <Tooltip
      title={label}
      placement="right"
      describeChild={!linkTo}
      disableHoverListener={!collapsed}
      disableFocusListener={!collapsed}
      disableTouchListener={!collapsed}
    >
      {item}
    </Tooltip>
  );
}

export default SidebarNavItem;
