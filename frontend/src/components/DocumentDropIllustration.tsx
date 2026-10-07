import { Box } from "@mui/material";

function DocumentDropIllustration() {
  return (
    <Box
      aria-hidden
      sx={{
        width: 148,
        height: 120,
        position: "relative",
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 148 120"
        sx={{ width: "100%", height: "100%" }}
      >
        <ellipse cx="74" cy="102" rx="42" ry="8" fill="#D7E4F5" />
        <path
          d="M38 86h72c4 0 7 3 7 7v6H31v-6c0-4 3-7 7-7z"
          fill="#C9D7EA"
        />
        <path
          d="M34 78h80c3.5 0 6 2.4 6 5.5V88H28v-4.5c0-3.1 2.5-5.5 6-5.5z"
          fill="#DCE6F4"
        />
        <rect x="52" y="28" width="44" height="52" rx="4" fill="#EEF3FA" />
        <rect
          x="52"
          y="28"
          width="44"
          height="52"
          rx="4"
          fill="none"
          stroke="#9BB3D3"
          strokeWidth="1.5"
        />
        <path d="M80 28v14c0 2 1.5 3.5 3.5 3.5H96" fill="#E4ECF7" />
        <path
          d="M96 31.5V45.5c0 2-1.5 3.5-3.5 3.5H80V28"
          fill="none"
          stroke="#9BB3D3"
          strokeWidth="1.5"
        />
        <rect x="60" y="52" width="22" height="2.2" rx="1" fill="#C5D4E8" />
        <rect x="60" y="58" width="28" height="2.2" rx="1" fill="#C5D4E8" />
        <rect x="60" y="64" width="18" height="2.2" rx="1" fill="#C5D4E8" />
        <circle cx="108" cy="30" r="12" fill="#E8EEF7" />
        <circle
          cx="108"
          cy="30"
          r="12"
          fill="none"
          stroke="#B7C7DC"
          strokeWidth="1.2"
        />
        <circle cx="103.5" cy="28" r="1.6" fill="#8AA0BE" />
        <circle cx="108" cy="26.5" r="1.6" fill="#8AA0BE" />
        <circle cx="112.5" cy="28" r="1.6" fill="#8AA0BE" />
      </Box>
    </Box>
  );
}

export default DocumentDropIllustration;
