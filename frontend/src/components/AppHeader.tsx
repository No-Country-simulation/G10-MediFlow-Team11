import { Box, IconButton, Tooltip } from "@mui/material"
import { CloseOutlined, MenuOutlined } from "@mui/icons-material"
import type { Ref } from "react"
import MediFlowBrand from "./MediFlowBrand"
import { HEADER_HEIGHT } from "../layouts/layoutConstants"
import { focusRing } from "../theme/focusRing"

export type DrawerNavigationButtonProps = {
  sidebarId: string
  open: boolean
  onToggle: () => void
  buttonRef?: Ref<HTMLButtonElement>
  hidden?: boolean
}

export function DrawerNavigationButton({
  sidebarId,
  open,
  onToggle,
  buttonRef,
  hidden = false,
}: DrawerNavigationButtonProps) {
  const label = open ? "Cerrar navegación" : "Abrir navegación"
  return (
    <Tooltip title={hidden ? "" : label}>
      <IconButton
        ref={buttonRef}
        aria-label={label}
        aria-expanded={open}
        aria-controls={sidebarId}
        aria-hidden={hidden || undefined}
        tabIndex={hidden ? -1 : 0}
        onClick={onToggle}
        sx={(theme) => ({
          width: 40,
          height: 40,
          borderRadius: 1,
          visibility: hidden ? "hidden" : "visible",
          color: "text.primary",
          "&.Mui-focusVisible": focusRing(theme),
        })}
      >
        {open ? <CloseOutlined /> : <MenuOutlined />}
      </IconButton>
    </Tooltip>
  )
}

type AppHeaderProps = {
  sidebarId: string
  mobile: boolean
  drawerOpen: boolean
  onToggleDrawer: () => void
  navigationButtonRef: Ref<HTMLButtonElement>
}

function AppHeader({
  sidebarId,
  mobile,
  drawerOpen,
  onToggleDrawer,
  navigationButtonRef,
}: AppHeaderProps) {
  return (
    <Box
      component="header"
      sx={(theme) => ({
        height: HEADER_HEIGHT,
        flexShrink: 0,
        px: 1.5,
        display: "flex",
        alignItems: "center",
        gap: 1,
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
        position: "sticky",
        top: 0,
        zIndex: theme.zIndex.drawer + 1,
      })}
    >
      {mobile && (
        <DrawerNavigationButton
          sidebarId={sidebarId}
          open={drawerOpen}
          onToggle={onToggleDrawer}
          buttonRef={navigationButtonRef}
          hidden={drawerOpen}
        />
      )}
      <MediFlowBrand />
    </Box>
  )
}

export default AppHeader
