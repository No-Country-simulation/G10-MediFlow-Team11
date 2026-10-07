import { Box, Typography } from "@mui/material"

const SYMBOL_SRC = `${import.meta.env.BASE_URL}brand/mediflow-symbol.svg`

function MediFlowBrand() {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1,
        height: 40,
        borderRadius: 1,
        bgcolor: "action.hover",
      }}
    >
      <Box
        component="img"
        src={SYMBOL_SRC}
        alt=""
        width={28}
        height={28}
        sx={{ display: "block", flexShrink: 0 }}
      />
      <Typography
        component="span"
        sx={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}
      >
        MediFlow
      </Typography>
    </Box>
  )
}

export default MediFlowBrand
