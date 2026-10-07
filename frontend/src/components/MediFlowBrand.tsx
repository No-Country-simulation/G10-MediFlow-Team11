import { Box } from "@mui/material"

const BRAND_SRC = `${import.meta.env.BASE_URL}brand/mediflow-horizontal-compact.svg`

function MediFlowBrand() {
  return (
    <Box className="app-shell__brand">
      <Box
        component="img"
        src={BRAND_SRC}
        alt="MediFlow"
        className="app-shell__brand-image"
      />
    </Box>
  )
}

export default MediFlowBrand
