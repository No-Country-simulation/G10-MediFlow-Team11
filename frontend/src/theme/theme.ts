import { createTheme } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface TypeBackground {
    sidebar: string;
  }
}

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1570EF",
    },
    text: {
      primary: "#0F1A3D",
      secondary: "#4B5576",
    },
    background: {
      default: "#F1F5FB",
      paper: "#FFFFFF",
      sidebar: "#F5F9FE",
    },
    divider: "rgba(15, 26, 61, 0.09)",
  },
  typography: {
    fontFamily:
      '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
});
