import { createTheme } from "@mui/material/styles";
import type {} from "@mui/material/themeCssVarsAugmentation";

export const DARK_PRIMARY_FOCUS_RIPPLE_OPACITY = 0.12;

export interface MediFlowColors {
  background: string;
  legacyContentSurface: string;
  surface: string;
  surfaceMuted: string;
  textPrimary: string;
  textSecondary: string;
  textOnMuted: string;
  border: string;
  borderStrong: string;
  action: string;
  actionHover: string;
  actionText: string;
  actionSurface: string;
  onAction: string;
  focus: string;
  focusOffset: string;
  disabledSurface: string;
  disabledText: string;
  navigationSurface: string;
  navigationHover: string;
  navigationSelected: string;
  navigationTextOnSelected: string;
  overlay: string;
  infoSurface: string;
  infoText: string;
  successSurface: string;
  successText: string;
  warningSurface: string;
  warningText: string;
  errorSurface: string;
  errorText: string;
  illustrationPaper: string;
  illustrationDetail: string;
  tooltipSurface: string;
  tooltipText: string;
}

declare module "@mui/material/styles" {
  interface TypeBackground {
    sidebar: string;
  }
  interface Palette {
    mediflow: MediFlowColors;
  }
  interface PaletteOptions {
    mediflow?: MediFlowColors;
  }
}

const lightColors: MediFlowColors = {
  background: "#fafafa",
  legacyContentSurface: "#fafafa",
  surface: "#ffffff",
  surfaceMuted: "#f5f5f5",
  textPrimary: "#1a1a1a",
  textSecondary: "#737373",
  // Use on surfaceMuted: textSecondary is reserved for the white surface.
  textOnMuted: "#6b6b6b",
  border: "#e5e5e5",
  borderStrong: "#d9d9d9",
  action: "#1a5fd0",
  actionHover: "#174fa9",
  actionText: "#1a5fd0",
  actionSurface: "#eef4ff",
  onAction: "#ffffff",
  focus: "#1a5fd0",
  focusOffset: "#ffffff",
  disabledSurface: "#f5f5f5",
  disabledText: "#a9a9a9",
  navigationSurface: "#ffffff",
  navigationHover: "rgba(0, 0, 0, 0.04)",
  navigationSelected: "rgba(26, 95, 208, 0.12)",
  navigationTextOnSelected: "#606060",
  overlay: "rgba(0, 0, 0, 0.2)",
  infoSurface: "#eef4ff",
  infoText: "#1a5fd0",
  successSurface: "#eaf7f5",
  successText: "#0b7573",
  warningSurface: "#fff8e6",
  warningText: "#b34b00",
  errorSurface: "#faeeee",
  errorText: "#a64040",
  illustrationPaper: "#f5f5f5",
  illustrationDetail: "#dce0e6",
  tooltipSurface: "#1a1a1a",
  tooltipText: "#ffffff",
};

const darkColors: MediFlowColors = {
  background: "#0c192b",
  legacyContentSurface: "#fafafa",
  surface: "#0f1e32",
  surfaceMuted: "#182b43",
  textPrimary: "#f3f6fc",
  textSecondary: "#b7cfee",
  textOnMuted: "#b7cfee",
  border: "#2a4666",
  borderStrong: "#526b88",
  action: "#006cff",
  actionHover: "#005bd7",
  actionText: "#78c9ff",
  actionSurface: "#102e55",
  onAction: "#ffffff",
  focus: "#78c9ff",
  focusOffset: "#0f1e32",
  disabledSurface: "#182b43",
  disabledText: "#92a9c7",
  navigationSurface: "#0c192b",
  navigationHover: "#182b43",
  navigationSelected: "#102e55",
  navigationTextOnSelected: "#b7cfee",
  overlay: "rgba(0, 0, 0, 0.55)",
  infoSurface: "#102e55",
  infoText: "#78c9ff",
  successSurface: "#173835",
  successText: "#83d9cd",
  warningSurface: "#352b26",
  warningText: "#ffb98b",
  errorSurface: "#40272d",
  errorText: "#f4afb5",
  illustrationPaper: "#1b3654",
  illustrationDetail: "#7497ba",
  tooltipSurface: "#13273e",
  tooltipText: "#f3f6fc",
};

export const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: '[data-mediflow-color-scheme="%s"]',
  },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#1570EF" },
        text: { primary: "#0F1A3D", secondary: "#4B5576" },
        background: {
          default: "#F1F5FB",
          paper: "#FFFFFF",
          sidebar: "#F5F9FE",
        },
        divider: "rgba(15, 26, 61, 0.09)",
        mediflow: lightColors,
      },
    },
    dark: {
      palette: {
        // MUI main is also text (links, radios, text buttons), so use the readable
        // accent with dark ink for contained buttons. Brand-blue fills remain
        // the separate mediflow.action/onAction pair.
        primary: {
          main: darkColors.actionText,
          dark: "#49a7ef",
          contrastText: darkColors.background,
        },
        text: {
          primary: darkColors.textPrimary,
          secondary: darkColors.textSecondary,
          disabled: darkColors.disabledText,
        },
        background: {
          default: darkColors.background,
          paper: darkColors.surface,
          sidebar: darkColors.navigationSurface,
        },
        divider: darkColors.border,
        info: { main: darkColors.infoText },
        success: { main: darkColors.successText },
        warning: { main: darkColors.warningText },
        error: { main: darkColors.errorText },
        mediflow: darkColors,
      },
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: ({ theme }) => theme.applyStyles("dark", {
          // Keep the persistent focus ripple from washing out primary button text.
          // :where keeps Home's existing, more specific focus outline intact.
          "&:where(.MuiButton-colorPrimary)": {
            "&.Mui-focusVisible": {
              outline: `2px solid ${theme.vars.palette.mediflow.focus}`,
              outlineOffset: 2,
            },
            "& .MuiTouchRipple-ripplePulsate.MuiTouchRipple-rippleVisible": {
              opacity: DARK_PRIMARY_FOCUS_RIPPLE_OPACITY,
            },
          },
        }),
      },
    },
  },
  typography: {
    fontFamily:
      '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    button: { textTransform: "none" },
  },
});
