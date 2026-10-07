import { Box, IconButton, Tooltip } from "@mui/material"
import { Menu, X } from "lucide-react"
import type { Ref } from "react"
import MediFlowBrand from "./MediFlowBrand"

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
    <Tooltip
      title={hidden ? "" : label}
      slotProps={{
        tooltip: {
          className: "app-shell__tooltip",
        },
      }}
    >
      <IconButton
        ref={buttonRef}
        aria-label={label}
        aria-expanded={open}
        aria-controls={sidebarId}
        aria-hidden={hidden || undefined}
        tabIndex={hidden ? -1 : 0}
        onClick={onToggle}
        className="app-shell__drawer-button"
        data-hidden={hidden}
      >
        {open ? (
          <X
            className="app-shell__drawer-icon"
            strokeWidth={1.25}
            aria-hidden="true"
          />
        ) : (
          <Menu
            className="app-shell__drawer-icon"
            strokeWidth={1.25}
            aria-hidden="true"
          />
        )}
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
      className="app-shell__header"
      sx={(theme) => ({ zIndex: theme.zIndex.drawer + 1 })}
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
