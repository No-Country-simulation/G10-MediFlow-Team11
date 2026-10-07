import type { FocusEventHandler, PointerEventHandler } from "react"
import {
  Box,
  Divider,
  IconButton,
  List,
  Tooltip,
  Typography,
} from "@mui/material"
import {
  KeyboardDoubleArrowLeftOutlined,
  KeyboardDoubleArrowRightOutlined,
} from "@mui/icons-material"
import SidebarNavItem from "./SidebarNavItem"
import { PRIMARY_NAVIGATION, SECONDARY_NAVIGATION } from "../config/navigation"
import {
  HEADER_HEIGHT,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_WIDTH,
} from "../layouts/layoutConstants"
import { focusRing } from "../theme/focusRing"

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

const sectionSx = {
  px: 1.5,
  mb: 0.5,
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "text.secondary",
} as const

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
      sx={(theme) => ({
        width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        height: mobile ? "100%" : `calc(100dvh - ${HEADER_HEIGHT}px)`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: mobile ? "relative" : "absolute",
        top: 0,
        left: 0,
        bgcolor: "background.paper",
        borderRight: 1,
        borderColor: "divider",
        zIndex: theme.zIndex.drawer,
        transition: theme.transitions.create("width", { duration: 200 }),
        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
      })}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          px: collapsed ? 0 : 1.5,
          pt: 2.75,
          pb: 1,
        }}
      >
        <List component="nav" aria-label="Navegación principal" disablePadding>
          {PRIMARY_NAVIGATION.map((item, index) => (
            <Box key={item.label}>
              {index > 0 && <Divider sx={{ my: 1, mx: collapsed ? 1.5 : 0 }} />}
              {!collapsed && (
                <Typography sx={sectionSx}>{item.section}</Typography>
              )}
              <SidebarNavItem
                {...item}
                collapsed={collapsed}
                onClick={onNavigate}
              />
            </Box>
          ))}
        </List>
        <Box sx={{ flexGrow: 1, minHeight: 2 }} />
        <Divider sx={{ my: 1, mx: collapsed ? 1.5 : 0 }} />
        {!collapsed && <Typography sx={sectionSx}>Ajustes</Typography>}
        <List
          component="div"
          disablePadding
          sx={{ display: "flex", flexDirection: "column", gap: 1 }}
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
        <Tooltip title={pinLabel}>
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
            sx={(theme) => ({
              width: "100%",
              height: 32,
              flexShrink: 0,
              borderRadius: 0,
              borderTop: 1,
              borderColor: "divider",
              color: "text.primary",
              "&.Mui-focusVisible": focusRing(theme),
            })}
          >
            {pinned ? (
              <KeyboardDoubleArrowLeftOutlined fontSize="small" />
            ) : (
              <KeyboardDoubleArrowRightOutlined fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  )
}

export default AppSidebar
