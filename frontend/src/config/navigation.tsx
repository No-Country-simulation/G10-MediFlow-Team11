import type { ReactNode } from "react"
import {
  DescriptionOutlined,
  HelpOutlineOutlined,
  FactCheckOutlined,
  SettingsOutlined,
} from "@mui/icons-material"

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
    icon: <DescriptionOutlined />,
    to: "/processing",
  },
  {
    label: "Auditoría",
    description: "Casos que requieren revisión humana",
    section: "Revisar",
    icon: <FactCheckOutlined />,
    to: "/audit",
  },
]

export const SECONDARY_NAVIGATION: NavigationItem[] = [
  {
    label: "Centro de ayuda",
    description: "Guía y soporte",
    icon: <HelpOutlineOutlined />,
  },
  {
    label: "Configuración",
    description: "Preferencias de la aplicación",
    icon: <SettingsOutlined />,
  },
]
