import type { ReactNode } from "react";
import {
  DescriptionOutlined,
  HelpOutlineOutlined,
  PeopleAltOutlined,
  SettingsOutlined,
} from "@mui/icons-material";

export type NavigationItem = {
  label: string;
  icon: ReactNode;
  to?: string;
};

export const PRIMARY_NAVIGATION: NavigationItem[] = [
  { label: "Procesamiento", icon: <DescriptionOutlined />, to: "/processing" },
  { label: "Auditoría", icon: <PeopleAltOutlined />, to: "/audit" },
];

export const SECONDARY_NAVIGATION: NavigationItem[] = [
  { label: "Centro de ayuda", icon: <HelpOutlineOutlined /> },
  { label: "Configuración", icon: <SettingsOutlined /> },
];
