import type { ReactNode } from "react"
import {
  Box,
  Fade,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from "@mui/material"
import { NavLink } from "react-router-dom"

type SidebarNavItemProps = {
  icon: ReactNode
  label: string
  description: string
  to?: string
  disabled?: boolean
  collapsed?: boolean
  onClick?: () => void
}

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
      className="app-shell__nav-item"
      data-collapsed={collapsed}
    >
      {content}
    </ListItemButton>
  ) : (
    <Box
      className="app-shell__nav-item-wrapper"
      data-collapsed={collapsed}
    >
      <ListItemButton
        component="button"
        disabled
        aria-label={label}
        className="app-shell__nav-item"
        data-collapsed={collapsed}
      >
        {content}
      </ListItemButton>
    </Box>
  )
  return (
    <Tooltip
      title={collapsed ? label : ""}
      placement="right"
      slots={{ transition: Fade }}
      slotProps={{
        popper: {
          modifiers: [
            {
              name: "offset",
              options: { offset: [0, -5.75] },
            },
          ],
        },
        transition: { timeout: 150 },
        tooltip: {
          className: "app-shell__tooltip",
        },
      }}
      disableHoverListener={!collapsed}
      disableFocusListener={!collapsed}
      disableTouchListener={!collapsed}
    >
      {item}
    </Tooltip>
  )
}

export default SidebarNavItem
