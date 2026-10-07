import {
  Add,
  FileUploadOutlined,
  Title as TitleIcon,
} from "@mui/icons-material";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useId, useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";

import DocumentDropIllustration from "../components/DocumentDropIllustration";
import DocumentViewer from "../components/DocumentViewer";
import PageHeader from "../components/PageHeader";
import { useNotification } from "../notifications/useNotification";
import {
  ACCEPTED_FILE_EXTENSIONS,
  ORIGIN_CHANNELS,
  formatFileSize,
  getFileKind,
  hasOriginChannel,
  hasProcessableText,
  validateSelectedFile,
} from "../processing/form";
import { processFile, processText } from "../services/processingService";

type InputMode = "file" | "text";

const formCardSx = {
  width: "100%",
  maxWidth: 800,
  mx: "auto",
  px: { xs: 2.5, sm: 4 },
  py: { xs: 3, sm: 4 },
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 4,
  bgcolor: "background.paper",
  minWidth: 0,
};

const panelCardSx = {
  minWidth: 0,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 4,
  bgcolor: "background.paper",
};

const tabButtonSx = {
  px: 1.5,
  py: 1.25,
  gap: 1,
  border: 0,
  borderBottom: "2px solid transparent",
  borderRadius: 0,
  textTransform: "none" as const,
  fontWeight: 600,
  color: "text.secondary",
  bgcolor: "transparent",

  "&.Mui-selected": {
    color: "primary.main",
    bgcolor: "transparent",
    borderBottomColor: "primary.main",
  },

  "&.Mui-selected:hover": {
    bgcolor: "transparent",
  },

  "&:hover": {
    bgcolor: "transparent",
  },
};

const actionButtonSx = {
  textTransform: "none" as const,
  fontWeight: 600,
  px: 2.5,
  py: 1,
  borderRadius: 1.5,
  minHeight: 40,
};

function RequiredMark() {
  return (
    <Box component="span" sx={{ color: "error.main", ml: 0.25 }}>
      *
    </Box>
  );
}

function OriginChannelField({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <FormControl fullWidth required>
      <FormLabel
        id={`${id}-label`}
        htmlFor={id}
        sx={{
          mb: 1,
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "text.primary",
        }}
      >
        Canal de origen
        <RequiredMark />
      </FormLabel>

      <Select
        id={id}
        labelId={`${id}-label`}
        displayEmpty
        value={value}
        disabled={disabled}
        aria-label="Canal de origen"
        inputProps={{
          "aria-labelledby": `${id}-label`,
        }}
        onChange={(event) => onChange(event.target.value)}
        renderValue={(selected) =>
          selected ? (
            selected
          ) : (
            <Typography component="span" sx={{ color: "text.secondary" }}>
              Seleccione un canal
            </Typography>
          )
        }
        sx={{
          borderRadius: 1.5,
          bgcolor: "background.paper",
          "& .MuiSelect-select": {
            py: 1.375,
          },
        }}
      >
        {ORIGIN_CHANNELS.map((channel) => (
          <MenuItem key={channel} value={channel}>
            {channel}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function ProcessingPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const fileInputId = useId();
  const fileChannelId = useId();
  const textChannelId = useId();
  const textFieldId = useId();
  const formErrorId = useId();
  const fileErrorId = useId();

  const navigate = useNavigate();
  const { showError } = useNotification();

  const [inputMode, setInputMode] = useState<InputMode>("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [documentText, setDocumentText] = useState("");
  const [originChannel, setOriginChannel] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const hasContentToClear =
    selectedFile !== null ||
    documentText.length > 0 ||
    originChannel.length > 0 ||
    fileError !== null ||
    formError !== null;

  const canSubmitFile =
    selectedFile !== null && hasOriginChannel(originChannel) && !isProcessing;

  const canSubmitText =
    hasProcessableText(documentText) &&
    hasOriginChannel(originChannel) &&
    !isProcessing;

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFile = (file: File) => {
    if (isProcessing) {
      return;
    }

    setFormError(null);
    resetFileInput();

    const validation = validateSelectedFile(file);

    if (!validation.ok) {
      setFileError(validation.message);
      return;
    }

    setSelectedFile(file);
    setFileError(null);
  };

  const handleRemoveFile = () => {
    if (isProcessing) {
      return;
    }

    setSelectedFile(null);
    setFileError(null);
    setFormError(null);
    resetFileInput();
  };

  const validateForm = (): boolean => {
    if (!hasOriginChannel(originChannel)) {
      setFormError("Selecciona el canal de origen.");
      return false;
    }

    if (inputMode === "file" && !selectedFile) {
      setFormError("Selecciona un documento para procesar.");
      return false;
    }

    if (inputMode === "text" && !hasProcessableText(documentText)) {
      setFormError("Ingresa el contenido del documento.");
      return false;
    }

    setFormError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current || isProcessing || !validateForm()) {
      return;
    }

    isSubmittingRef.current = true;
    setIsProcessing(true);
    setFormError(null);

    try {
      const response =
        inputMode === "file" && selectedFile
          ? await processFile({
              file: selectedFile,
              origin_channel: originChannel,
            })
          : await processText({
              document_text: documentText.trim(),
              origin_channel: originChannel,
            });

      navigate(`/result/${response.document_id}`, {
        state: { processingResponse: response },
      });
    } catch (error) {
      showError(error);
    } finally {
      isSubmittingRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleClearForm = () => {
    if (isProcessing) {
      return;
    }

    setInputMode("file");
    setSelectedFile(null);
    setFileError(null);
    setDocumentText("");
    setOriginChannel("");
    setFormError(null);
    resetFileInput();
  };

  const handleModeChange = (
    _: MouseEvent<HTMLElement>,
    value: InputMode | null,
  ) => {
    if (!value || isProcessing) {
      return;
    }

    setInputMode(value);
    setFormError(null);
    setFileError(null);
  };

  const fileKind = selectedFile ? getFileKind(selectedFile) : null;
  const showSplitLayout = inputMode === "file" && selectedFile !== null;

  const actionButtons = (mode: InputMode, enabled: boolean) => (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        flexWrap: "wrap",
      }}
    >
      <Button
        variant="contained"
        onClick={handleSubmit}
        disabled={!enabled}
        aria-busy={isProcessing}
        sx={{
          ...actionButtonSx,
          boxShadow: "none",
        }}
      >
        {mode === "text"
          ? isProcessing
            ? "Procesando texto…"
            : "Procesar texto"
          : isProcessing
            ? "Procesando documento…"
            : "Procesar documento"}
      </Button>

      <Button
        variant="outlined"
        onClick={handleClearForm}
        disabled={isProcessing || !hasContentToClear}
        sx={{
          ...actionButtonSx,
          color: "text.secondary",
          borderColor: "divider",
        }}
      >
        Limpiar
      </Button>
    </Stack>
  );

  return (
    <Box sx={{ width: "100%", minWidth: 0 }}>
      <PageHeader
        title="Procesamiento de documentos"
        description="Cargue un documento clínico o ingrese texto para iniciar su clasificación, extracción y enrutamiento."
      />

      <input
        id={fileInputId}
        ref={fileInputRef}
        type="file"
        hidden
        accept={ACCEPTED_FILE_EXTENSIONS}
        aria-label="Seleccionar archivo"
        aria-invalid={fileError !== null}
        aria-describedby={fileError ? fileErrorId : undefined}
        disabled={isProcessing}
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            handleFile(file);
          }
        }}
      />

      <Box
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          mb: 3,
        }}
      >
        <ToggleButtonGroup
          value={inputMode}
          exclusive
          onChange={handleModeChange}
          aria-label="Tipo de entrada"
          sx={{
            gap: 0.5,
            borderRadius: 0,
            "& .MuiToggleButtonGroup-grouped": {
              border: 0,
              margin: 0,
            },
          }}
        >
          <ToggleButton
            value="file"
            aria-label="Archivo"
            disabled={isProcessing}
            sx={tabButtonSx}
          >
            <FileUploadOutlined sx={{ fontSize: 18 }} />
            Archivo
          </ToggleButton>

          <ToggleButton
            value="text"
            aria-label="Texto"
            disabled={isProcessing}
            sx={tabButtonSx}
          >
            <TitleIcon sx={{ fontSize: 18 }} />
            Texto
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {inputMode === "file" && !showSplitLayout && (
        <Paper elevation={0} sx={formCardSx}>
          <Stack spacing={3}>
            <Box>
              <Typography
                sx={{
                  mb: 1.5,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                Documento
                <RequiredMark />
              </Typography>

              <Box
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(event) => {
                  event.preventDefault();

                  if (isProcessing) {
                    return;
                  }

                  const file = event.dataTransfer.files?.[0];

                  if (file) {
                    handleFile(file);
                  }
                }}
                sx={{
                  minHeight: { xs: 220, sm: 280 },
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  px: 2,
                }}
              >
                <DocumentDropIllustration />

                <Typography sx={{ mt: 1.5, color: "text.secondary" }}>
                  Agregue un archivo para previsualizarlo aquí
                </Typography>

                <Typography
                  variant="body2"
                  sx={{ mt: 0.5, color: "text.secondary" }}
                >
                  PDF, JPG o PNG
                </Typography>

                <Button
                  variant="text"
                  startIcon={<Add />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  sx={{
                    mt: 1.5,
                    textTransform: "none",
                    fontWeight: 600,
                  }}
                >
                  Seleccionar archivo
                </Button>
              </Box>

              {fileError && (
                <Typography
                  id={fileErrorId}
                  role="alert"
                  color="error"
                  variant="body2"
                  sx={{ mt: 1 }}
                >
                  {fileError}
                </Typography>
              )}
            </Box>

            <OriginChannelField
              id={fileChannelId}
              value={originChannel}
              disabled={isProcessing}
              onChange={(value) => {
                setOriginChannel(value);
                setFormError(null);
              }}
            />

            {formError && (
              <Typography
                id={formErrorId}
                role="alert"
                color="error"
                variant="body2"
              >
                {formError}
              </Typography>
            )}

            <Box
              sx={{
                pt: 1,
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              {actionButtons("file", canSubmitFile)}
            </Box>
          </Stack>
        </Paper>
      )}

      {showSplitLayout && selectedFile && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              lg: "minmax(280px, 400px) minmax(0, 1fr)",
            },
            gap: { xs: 2.5, lg: 3 },
            alignItems: "stretch",
            minWidth: 0,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              ...panelCardSx,
              display: "flex",
              flexDirection: "column",
              p: { xs: 2.5, sm: 3 },
              minHeight: { lg: 560 },
            }}
          >
            <Stack spacing={3} sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: "0.95rem" }}>
                Configuración del procesamiento
              </Typography>

              <Box>
                <Typography
                  sx={{
                    mb: 1.25,
                    fontSize: "0.875rem",
                    color: "text.secondary",
                  }}
                >
                  Archivo seleccionado
                </Typography>

                <Paper
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    overflow: "hidden",
                    bgcolor: "background.default",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      p: 2,
                    }}
                  >
                    <Box
                      sx={{
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 0.75,
                        bgcolor: fileKind === "PDF" ? "#E53935" : "primary.main",
                        color: "common.white",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        flexShrink: 0,
                      }}
                    >
                      {fileKind}
                    </Box>

                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        title={selectedFile.name}
                        sx={{
                          fontWeight: 600,
                          fontSize: "0.9rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {selectedFile.name}
                      </Typography>

                      <Typography variant="body2" color="text.secondary">
                        {fileKind} · {formatFileSize(selectedFile.size)}
                      </Typography>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      gap: 2,
                      px: 2,
                      py: 1,
                      borderTop: "1px solid",
                      borderColor: "divider",
                      bgcolor: "background.paper",
                    }}
                  >
                    <Button
                      variant="text"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing}
                      sx={{ textTransform: "none", px: 0, minWidth: 0 }}
                    >
                      Cambiar archivo
                    </Button>

                    <Button
                      variant="text"
                      color="inherit"
                      onClick={handleRemoveFile}
                      disabled={isProcessing}
                      sx={{
                        textTransform: "none",
                        px: 0,
                        minWidth: 0,
                        color: "text.secondary",
                      }}
                    >
                      Quitar archivo
                    </Button>
                  </Box>
                </Paper>
              </Box>

              <OriginChannelField
                id={`${fileChannelId}-selected`}
                value={originChannel}
                disabled={isProcessing}
                onChange={(value) => {
                  setOriginChannel(value);
                  setFormError(null);
                }}
              />

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                  px: 2,
                  py: 1.25,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.default",
                }}
              >
                <Typography
                  sx={{ color: "text.secondary", fontSize: "0.875rem" }}
                >
                  Estado
                </Typography>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: isProcessing ? "warning.main" : "#0F9D58",
                    }}
                  />
                  <Typography
                    sx={{
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      color: isProcessing ? "text.primary" : "#0F9D58",
                    }}
                  >
                    {isProcessing ? "Procesando…" : "Listo para procesar"}
                  </Typography>
                </Box>
              </Box>

              {fileError && (
                <Typography
                  id={fileErrorId}
                  role="alert"
                  color="error"
                  variant="body2"
                >
                  {fileError}
                </Typography>
              )}

              {formError && (
                <Typography
                  id={formErrorId}
                  role="alert"
                  color="error"
                  variant="body2"
                >
                  {formError}
                </Typography>
              )}

              <Box sx={{ flexGrow: 1, display: { xs: "none", lg: "block" } }} />

              <Box sx={{ display: { xs: "none", lg: "block" } }}>
                {actionButtons("file", canSubmitFile)}
              </Box>
            </Stack>
          </Paper>

          <Box sx={{ display: { xs: "block", lg: "none" } }}>
            {actionButtons("file", canSubmitFile)}
          </Box>

          <Paper elevation={0} sx={{ ...panelCardSx, overflow: "hidden" }}>
            <DocumentViewer file={selectedFile} />
          </Paper>
        </Box>
      )}

      {inputMode === "text" && (
        <Paper elevation={0} sx={formCardSx}>
          <Stack spacing={3}>
            <FormControl fullWidth>
              <FormLabel
                htmlFor={textFieldId}
                sx={{
                  mb: 1,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "text.primary",
                }}
              >
                Texto del documento
                <RequiredMark />
              </FormLabel>

              <TextField
                id={textFieldId}
                hiddenLabel
                placeholder="Ingrese o pegue el contenido clínico aquí."
                value={documentText}
                onChange={(event) => {
                  setDocumentText(event.target.value);
                  setFormError(null);
                }}
                multiline
                minRows={8}
                fullWidth
                disabled={isProcessing}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 1.5,
                  },
                }}
              />
            </FormControl>

            <OriginChannelField
              id={textChannelId}
              value={originChannel}
              disabled={isProcessing}
              onChange={(value) => {
                setOriginChannel(value);
                setFormError(null);
              }}
            />

            {formError && (
              <Typography
                id={formErrorId}
                role="alert"
                color="error"
                variant="body2"
              >
                {formError}
              </Typography>
            )}

            <Box
              sx={{
                pt: 1,
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              {actionButtons("text", canSubmitText)}
            </Box>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}

export default ProcessingPage;
