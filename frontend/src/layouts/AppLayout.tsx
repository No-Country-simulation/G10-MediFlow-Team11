import { forwardRef, useEffect, useId, useRef, useState } from "react"
import {
  Box,
  Drawer,
  Modal,
  useMediaQuery,
  type DrawerOwnerState,
  type ModalProps,
} from "@mui/material"
import { Outlet } from "react-router-dom"
import AppSidebar from "../components/AppSidebar"
import AppHeader, { DrawerNavigationButton } from "../components/AppHeader"
import { DRAWER_BREAKPOINT } from "./layoutConstants"
import "../styles/app-shell.css"

const DRAWER_MEDIA_QUERY = `(width < ${DRAWER_BREAKPOINT}px)`

declare module "@mui/material/Drawer" {
  interface DrawerRootSlotPropsOverrides {
    sidebarId: string

    onToggle: () => void
  }
}

type NavigationModalProps = ModalProps & {
  ownerState?: DrawerOwnerState
  sidebarId: string
  onToggle: () => void
}

// Include the header's close control in MUI's focus scope, above the sliding paper.
const NavigationModal = forwardRef<HTMLDivElement, NavigationModalProps>(
  function NavigationModal(
    { children, ownerState, sidebarId, onToggle, ...props },
    ref,
  ) {
    return (
      <Modal {...props} ref={ref} closeAfterTransition={false}>
        <Box
          className="app-shell__modal-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Navegación"
          tabIndex={-1}
        >
          {(ownerState?.open ?? props.open) && (
            <Box className="app-shell__modal-close">
              <DrawerNavigationButton
                sidebarId={sidebarId}
                open
                onToggle={onToggle}
              />
            </Box>
          )}
          {children}
        </Box>
      </Modal>
    )
  },
)

function AppLayout() {
  const isMobile = useMediaQuery(DRAWER_MEDIA_QUERY, { noSsr: true })
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const [sidebarPinned, setSidebarPinned] = useState(false)
  const [sidebarHovered, setSidebarHovered] = useState(false)
  const [sidebarFocused, setSidebarFocused] = useState(false)
  const [suppressTransientExpansion, setSuppressTransientExpansion] =
    useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigationButtonRef = useRef<HTMLButtonElement>(null)
  const drawerWasOpen = useRef(false)
  const skipNextSidebarFocusExpansion = useRef(false)
  const sidebarId = useId()

  useEffect(() => {
    const media = window.matchMedia(DRAWER_MEDIA_QUERY)
    const onBreakpointChange = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        setDrawerOpen(false)
        setSidebarHovered(false)
        setSidebarFocused(false)
        setSuppressTransientExpansion(false)
      }
    }
    media.addEventListener("change", onBreakpointChange)
    return () => media.removeEventListener("change", onBreakpointChange)
  }, [])

  useEffect(() => {
    // The modal close control occupies the opener's position; restore the persistent opener.
    if (drawerWasOpen.current && !drawerOpen && isMobile)
      navigationButtonRef.current?.focus()
    drawerWasOpen.current = drawerOpen
  }, [drawerOpen, isMobile])

  const sidebarExpanded =
    sidebarPinned ||
    (!suppressTransientExpansion && (sidebarHovered || sidebarFocused))
  const closeDrawer = () => setDrawerOpen(false)
  const toggleDrawer = () => setDrawerOpen((open) => !open)

  return (
    <Box className="app-shell">
      <AppHeader
        sidebarId={sidebarId}
        mobile={isMobile}
        drawerOpen={drawerOpen}
        onToggleDrawer={toggleDrawer}
        navigationButtonRef={navigationButtonRef}
      />
      <Box className="app-shell__body">
        {isMobile ? (
          <Drawer
            className="app-shell__drawer"
            variant="temporary"
            open={drawerOpen}
            onClose={closeDrawer}
            elevation={0}
            transitionDuration={reducedMotion ? 0 : 200}
            slots={{ root: NavigationModal }}
            slotProps={{
              root: { sidebarId, onToggle: toggleDrawer },
              paper: {
                className: "app-shell__drawer-paper",
                role: "presentation",
                "aria-modal": undefined,
              },
              backdrop: { className: "app-shell__drawer-backdrop" },
            }}
          >
            <AppSidebar
              id={sidebarId}
              collapsed={false}
              mobile
              onNavigate={closeDrawer}
            />
          </Drawer>
        ) : (
          <Box
            className="app-shell__desktop-rail"
            data-expanded={sidebarExpanded}
            sx={{ zIndex: "drawer" }}
          >
            <AppSidebar
              id={sidebarId}
              collapsed={!sidebarExpanded}
              pinned={sidebarPinned}
              onTogglePin={(wasPinned, preserveFocus) => {
                setSidebarPinned((pinned) => !pinned)
                if (wasPinned) {
                  skipNextSidebarFocusExpansion.current = preserveFocus
                  if (!preserveFocus) setSidebarFocused(false)
                  setSuppressTransientExpansion(true)
                } else {
                  skipNextSidebarFocusExpansion.current = false
                  setSuppressTransientExpansion(false)
                }
              }}
              onPointerEnter={(event) => {
                if (event.pointerType !== "touch") {
                  setSidebarHovered(true)
                  setSuppressTransientExpansion(false)
                }
              }}
              onPointerLeave={() => {
                setSidebarHovered(false)
                if (!sidebarFocused) setSuppressTransientExpansion(false)
              }}
              onFocusCapture={(event) => {
                if (skipNextSidebarFocusExpansion.current) {
                  skipNextSidebarFocusExpansion.current = false
                  setSidebarFocused(true)
                  return
                }
                const focusVisible = event.target.matches(":focus-visible")
                setSidebarFocused(focusVisible)
                if (focusVisible)
                  setSuppressTransientExpansion(false)
              }}
              onBlurCapture={(event) => {
                if (
                  !(event.relatedTarget instanceof Node) ||
                  !event.currentTarget.contains(event.relatedTarget)
                ) {
                  setSidebarFocused(false)
                  if (!sidebarHovered) setSuppressTransientExpansion(false)
                }
              }}
            />
          </Box>
        )}
        <Box
          component="main"
          className="app-shell__main"
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

export default AppLayout
