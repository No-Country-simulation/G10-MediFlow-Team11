import type { FocusEventHandler, PointerEventHandler } from "react"
import {
  Box,
  Divider,
  Fade,
  IconButton,
  List,
  Tooltip,
  Typography,
} from "@mui/material"
import { ChevronsLeft, ChevronsRight } from "lucide-react"
import SidebarNavItem from "./SidebarNavItem"
import { PRIMARY_NAVIGATION, SECONDARY_NAVIGATION } from "../config/navigation"

type AppSidebarProps = {
  id: string
  collapsed: boolean
  mobile?: boolean
  pinned?: boolean
  onTogglePin?: () => void
  onNavigate?: () => void
  onPointerEnter?: PointerEventHandler<HTMLElement>
  onPointerLeave?: PointerEventHandler<HTMLElement>
  onFocusCapture?: FocusEventHandler<HTMLElement>
  onBlurCapture?: FocusEventHandler<HTMLElement>
}

function AppSidebar({
  id,
  collapsed,
  mobile = false,
  pinned = false,
  onTogglePin,
  onNavigate,
  ...events
}: AppSidebarProps) {
  const pinLabel = pinned ? "Contraer barra lateral" : "Fijar barra lateral"
  return (
    <Box
      component="aside"
      id={id}
      {...events}
      className="app-shell__sidebar"
      data-collapsed={collapsed}
      data-mobile={mobile}
      sx={(theme) => ({ zIndex: theme.zIndex.drawer })}
    >
      <Box className="app-shell__sidebar-scroll">
        <List component="nav" aria-label="Navegación principal" disablePadding>
          {PRIMARY_NAVIGATION.map((item, index) => (
            <Box key={item.label}>
              {index > 0 && (
                <Divider className="app-shell__divider app-shell__divider--group" />
              )}
              {!collapsed && (
                <Typography className="app-shell__section-heading">
                  {item.section}
                </Typography>
              )}
              <SidebarNavItem
                {...item}
                collapsed={collapsed}
                onClick={onNavigate}
              />
            </Box>
          ))}
        </List>
        <Box className="app-shell__sidebar-spacer" />
        <Divider className="app-shell__divider app-shell__divider--settings" />
        {!collapsed && (
          <Typography className="app-shell__section-heading">
            Ajustes
          </Typography>
        )}
        <List
          component="div"
          disablePadding
          className="app-shell__secondary-nav"
        >
          {SECONDARY_NAVIGATION.map((item) => (
            <SidebarNavItem
              key={item.label}
              {...item}
              disabled
              collapsed={collapsed}
            />
          ))}
        </List>
      </Box>
      {!mobile && !collapsed && (
        <Tooltip
          title={pinLabel}
          placement="top"
          slots={{ transition: Fade }}
          slotProps={{
            popper: {
              modifiers: [
                {
                  name: "offset",
                  options: { offset: [0, -7] },
                },
              ],
            },
            transition: { timeout: 150 },
            tooltip: {
              className: "app-shell__tooltip",
            },
          }}
        >
          <IconButton
            aria-label={pinLabel}
            aria-pressed={pinned}
            onClick={(event) => {
              onTogglePin?.()

              if (pinned) {
                event.currentTarget
                  .closest("aside")
                  ?.querySelector<HTMLAnchorElement>("a")
                  ?.focus()
              }
            }}
            className="app-shell__pin-button"
          >
            {pinned ? (
              <ChevronsLeft
                className="app-shell__pin-icon"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            ) : (
              <ChevronsRight
                className="app-shell__pin-icon"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            )}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  )
}

export default AppSidebar
