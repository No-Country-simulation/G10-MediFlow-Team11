import type { ReactNode } from "react"
import {
  House,
  FileText,
  CircleHelp,
  ClipboardCheck,
  Settings,
} from "lucide-react"

export type NavigationItem = {
  label: string
  description: string
  section?: string
  icon: ReactNode
  disabled?: boolean
  to?: string
}

export const PRIMARY_NAVIGATION: NavigationItem[] = [
  {
    label: "Inicio",
    description: "Bienvenida y accesos principales",
    icon: (
      <House
        className="app-shell__nav-icon"
        strokeWidth={1.25}
        aria-hidden="true"
      />
    ),
    to: "/",
  },
  {
    label: "Procesamiento",
    description: "Cargue y clasifique documentos clínicos",
    section: "Procesar",
    icon: (
      <FileText
        className="app-shell__nav-icon"
        strokeWidth={1.25}
        aria-hidden="true"
      />
    ),
    to: "/processing",
  },
  {
    label: "Auditoría",
    description: "Casos que requieren revisión humana",
    section: "Revisar",
    icon: (
      <ClipboardCheck
        className="app-shell__nav-icon"
        strokeWidth={1.25}
        aria-hidden="true"
      />
    ),
    to: "/audit",
  },
]

export const SECONDARY_NAVIGATION: NavigationItem[] = [
  {
    label: "Centro de ayuda",
    disabled: true,
    description: "Guía y soporte",
    icon: (
      <CircleHelp
        className="app-shell__nav-icon"
        strokeWidth={1.25}
        aria-hidden="true"
      />
    ),
  },
  {
    label: "Configuración",
    to: "/settings",
    description: "Preferencias de la aplicación",
    icon: (
      <Settings
        className="app-shell__nav-icon"
        strokeWidth={1.25}
        aria-hidden="true"
      />
    ),
  },
]
