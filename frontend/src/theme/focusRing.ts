import type { Theme } from "@mui/material/styles";

export const focusRing = (theme: Theme) => ({
  outline: `2px solid ${theme.palette.primary.main}`,
  outlineOffset: -2,
});
