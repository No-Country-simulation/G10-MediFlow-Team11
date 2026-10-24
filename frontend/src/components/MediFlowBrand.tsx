import { Box } from "@mui/material"
import { useTheme } from "@mui/material/styles"

const BRAND_BASE = `${import.meta.env.BASE_URL}brand/mediflow-horizontal-compact`

function MediFlowBrand() {
  const theme = useTheme()
  const source = `${BRAND_BASE}-${theme.palette.mode === "dark" ? "dark" : "light"}.png`
  return (
    <Box className="app-shell__brand">
      <Box
        component="img"
        src={source}
        alt="MediFlow"
        width={578}
        height={140}
        className="app-shell__brand-image"
      />
    </Box>
  )
}

export default MediFlowBrand
