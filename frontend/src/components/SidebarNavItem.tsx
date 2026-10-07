import type { ReactNode } from "react"
import {
  Box,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  type SxProps,
  type Theme,
} from "@mui/material"
import { alpha } from "@mui/material/styles"
import { NavLink } from "react-router-dom"
import { focusRing } from "../theme/focusRing"

type SidebarNavItemProps = {
  icon: ReactNode
  label: string
  description: string
  to?: string
  disabled?: boolean
  collapsed?: boolean
  onClick?: () => void
}

const getNavItemSx = (collapsed: boolean): SxProps<Theme> => (theme) => ({
  width: collapsed ? 40 : "100%",
  minHeight: 46,
  px: collapsed ? 1 : 1.5,
  py: 1,
  mx: "auto",
  gap: 1.5,
  color: "text.primary",
  borderRadius: 1,
  transition: theme.transitions.create(["padding", "background-color"], {
    duration: 200,
  }),
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  "& .MuiListItemIcon-root": { minWidth: 0, color: "inherit", flexShrink: 0 },
  "& .MuiListItemText-root": { m: 0, minWidth: 0 },
  "& .MuiListItemText-primary": { fontSize: 14, fontWeight: 500 },
  "& .MuiListItemText-secondary": { fontSize: 12, lineHeight: "16px", mt: 0.5 },
  "&:hover": { bgcolor: "action.hover" },
  "&.Mui-focusVisible": focusRing(theme),
  "&.active": {
    bgcolor: alpha(theme.palette.primary.main, 0.12),
    color: "primary.main",
    "& .MuiListItemText-primary": { fontWeight: 600 },
  },
  "&.Mui-disabled": { opacity: 0.5 },
})

function SidebarNavItem({
  icon,
  label,
  description,
  to,
  disabled = false,
  collapsed = false,
  onClick,
}: SidebarNavItemProps) {
  const linkTo = disabled ? undefined : to
  const content = (
    <>
      <ListItemIcon>{icon}</ListItemIcon>
      {!collapsed && <ListItemText primary={label} secondary={description} />}
    </>
  )
  const item = linkTo ? (
    <ListItemButton
      component={NavLink}
      to={linkTo}
      aria-label={label}
      onClick={onClick}
      sx={getNavItemSx(collapsed)}
    >
      {content}
    </ListItemButton>
  ) : (
    <Box sx={{ width: collapsed ? 40 : "100%", mx: "auto" }}>
      <ListItemButton
        component="button"
        disabled
        aria-label={label}
        sx={getNavItemSx(collapsed)}
      >
        {content}
      </ListItemButton>
    </Box>
  )
  return (
    <Tooltip
      title={collapsed ? label : ""}
      placement="right"
      disableHoverListener={!collapsed}
      disableFocusListener={!collapsed}
      disableTouchListener={!collapsed}
    >
      {item}
    </Tooltip>
  )
}

export default SidebarNavItem
