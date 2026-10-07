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
import {
  DRAWER_BREAKPOINT,
  HEADER_HEIGHT,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_WIDTH,
} from "./layoutConstants"

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
          role="dialog"
          aria-modal="true"
          aria-label="Navegación"
          tabIndex={-1}
          sx={{ outline: "none" }}
        >
          {(ownerState?.open ?? props.open) && (
            <Box
              sx={{
                position: "fixed",
                top: (HEADER_HEIGHT - 40) / 2,
                left: 12,
              }}
            >
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
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        minWidth: 0,
      }}
    >
      <AppHeader
        sidebarId={sidebarId}
        mobile={isMobile}
        drawerOpen={drawerOpen}
        onToggleDrawer={toggleDrawer}
        navigationButtonRef={navigationButtonRef}
      />
      <Box sx={{ display: "flex", flexGrow: 1, minWidth: 0 }}>
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={drawerOpen}
            onClose={closeDrawer}
            elevation={0}
            transitionDuration={reducedMotion ? 0 : 200}
            slots={{ root: NavigationModal }}
            slotProps={{
              root: { sidebarId, onToggle: toggleDrawer },
              paper: {
                role: "presentation",
                "aria-modal": undefined,
                sx: {
                  top: HEADER_HEIGHT,
                  height: `calc(100dvh - ${HEADER_HEIGHT}px)`,
                  width: SIDEBAR_WIDTH,
                },
              },
              backdrop: { sx: { top: HEADER_HEIGHT } },
            }}
            sx={{ top: HEADER_HEIGHT }}
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
            sx={{
              width: sidebarPinned ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
              flexShrink: 0,
              position: "sticky",
              zIndex: "drawer",
              top: HEADER_HEIGHT,
              height: `calc(100dvh - ${HEADER_HEIGHT}px)`,
              alignSelf: "flex-start",
            }}
          >
            <AppSidebar
              id={sidebarId}
              collapsed={!sidebarExpanded}
              pinned={sidebarPinned}
              onTogglePin={() => {
                setSidebarPinned((pinned) => !pinned)
                if (sidebarPinned) setSuppressTransientExpansion(true)
                else setSuppressTransientExpansion(false)
              }}
              onPointerEnter={(event) => {
                if (event.pointerType !== "touch") setSidebarHovered(true)
              }}
              onPointerLeave={() => {
                setSidebarHovered(false)
                if (!sidebarFocused) setSuppressTransientExpansion(false)
              }}
              onFocusCapture={() => setSidebarFocused(true)}
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
          sx={{
            flexGrow: 1,
            minWidth: 0,
            overflowX: "auto",
            p: 3,
            bgcolor: "background.default",
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

export default AppLayout
