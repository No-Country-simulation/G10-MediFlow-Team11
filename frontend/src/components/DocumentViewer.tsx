import { Box, Typography } from "@mui/material";
import { useEffect, useMemo } from "react";

import { isImageFile, isPdfFile } from "../processing/form";

type DocumentViewerProps = {
  file: File;
};

const previewMinHeight = {
  xs: 400,
  lg: 560,
};

function DocumentViewer({ file }: DocumentViewerProps) {
  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const previewKind = useMemo(() => {
    if (isPdfFile(file)) {
      return "pdf" as const;
    }

    if (isImageFile(file)) {
      return "image" as const;
    }

    return "unsupported" as const;
  }, [file]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        height: "100%",
        bgcolor: "background.paper",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 2,
          px: 2,
          pt: 1.5,
          pb: 1,
          minWidth: 0,
        }}
      >
        <Typography
          component="h2"
          sx={{
            fontWeight: 600,
            fontSize: "0.95rem",
            color: "text.primary",
          }}
        >
          Documento
        </Typography>

        <Typography
          title={file.name}
          sx={{
            color: "text.secondary",
            fontSize: "0.8rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {file.name}
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: previewMinHeight,
          minWidth: 0,
          bgcolor: "background.paper",
        }}
      >
        {!objectUrl ? null : previewKind === "pdf" ? (
          <Box
            component="iframe"
            title={`Vista previa de ${file.name}`}
            src={objectUrl}
            sx={{
              display: "block",
              width: "100%",
              height: "100%",
              minHeight: previewMinHeight,
              border: 0,
              maxWidth: "100%",
            }}
          />
        ) : previewKind === "image" ? (
          <Box
            sx={{
              height: "100%",
              minHeight: previewMinHeight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 2,
              overflow: "auto",
            }}
          >
            <Box
              component="img"
              src={objectUrl}
              alt={`Vista previa de ${file.name}`}
              sx={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          </Box>
        ) : (
          <Typography color="text.secondary" sx={{ p: 3 }}>
            Este archivo no se puede previsualizar.
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default DocumentViewer;
