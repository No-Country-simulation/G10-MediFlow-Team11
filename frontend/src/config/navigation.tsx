import type { ReactNode } from "react"
import {
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
  to?: string
}

export const PRIMARY_NAVIGATION: NavigationItem[] = [
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
