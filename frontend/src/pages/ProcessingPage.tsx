import {
  Box,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Button,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";
import {
  CloudUploadOutlined,
  CheckCircle,
  DeleteOutlined,
  DescriptionOutlined,
  FileUpload,
  SettingsOutlined,
} from "@mui/icons-material";
import { useRef, useState } from "react";

type InputMode = "file" | "text";
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

const ORIGIN_CHANNELS = [
  "Guardia / Emergencias",
  "Consultorio Externo",
  "Portal de Pacientes",
  "Farmacia",
  "Laboratorio",
  "Otro",
] as const;

function ProcessingPage() {
  const [inputMode, setInputMode] = useState<InputMode>("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const handleFile = (file: File) => {
    if (
      !ALLOWED_FILE_TYPES.includes(
        file.type as (typeof ALLOWED_FILE_TYPES)[number],
      )
    ) {
      setSelectedFile(null);
      setFileError(
        "Formato no admitido. Selecciona un archivo PDF, JPG o PNG.",
      );
      return;
    }

    setSelectedFile(file);
    setFileError(null);
  };
  const [documentText, setDocumentText] = useState("");
  const [originChannel, setOriginChannel] = useState("");
  const [customOriginChannel, setCustomOriginChannel] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const validateForm = (): boolean => {
    if (!originChannel.trim()) {
      setFormError("Indica el canal de origen.");
      return false;
    }

    if (originChannel === "Otro" && !customOriginChannel.trim()) {
      setFormError("Especifica el canal de origen.");
      return false;
    }

    if (inputMode === "file" && !selectedFile) {
      setFormError("Selecciona un documento para procesar.");
      return false;
    }

    if (inputMode === "text" && !documentText.trim()) {
      setFormError("Ingresa el contenido del documento.");
      return false;
    }

    setFormError(null);
    return true;
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleClearForm = () => {
    setInputMode("file");
    setSelectedFile(null);
    setDocumentText("");
    setOriginChannel("");
    setCustomOriginChannel("");
    setDocumentId("");
    setFileError(null);
    setFormError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  return (
    <Box sx={{ maxWidth: 960, mx: "auto" }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
        Procesamiento de documentos
      </Typography>

      <Typography color="text.secondary" sx={{ mt: 1 }}>
        Ingresa un documento clínico para iniciar su procesamiento.
      </Typography>
      <Stack
        spacing={3}
        sx={{
          bgcolor: "background.paper",
          p: 2,
          borderRadius: 1,
          boxShadow: 3,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <ToggleButtonGroup
            value={inputMode}
            exclusive
            onChange={(_, value: InputMode | null) => {
              if (value) {
                setInputMode(value);
              }
            }}
            aria-label="Tipo de entrada"
          >
            <ToggleButton value="file">
              <FileUpload />
              Archivo
            </ToggleButton>

            <ToggleButton value="text">
              <DescriptionOutlined />
              Texto
            </ToggleButton>
          </ToggleButtonGroup>
          {inputMode === "file" && (
            <>
              <Paper
                variant="outlined"
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();

                  const file = event.dataTransfer.files[0];

                  if (file) {
                    handleFile(file);
                  }
                }}
                sx={{
                  p: 4,
                  textAlign: "center",
                  borderStyle: "dashed",
                  cursor: "pointer",
                  transition: "border-color 0.2s, background-color 0.2s",
                  "&:hover": {
                    borderColor: "primary.main",
                    bgcolor: "action.hover",
                  },
                  "&:focus-visible": {
                    outline: 2,
                    outlineColor: "primary.main",
                    outlineOffset: 2,
                  },
                }}
              >
                <input
                  ref={fileInputRef}
                  hidden
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (file) {
                      handleFile(file);
                    }
                  }}
                />

                {selectedFile ? (
                  <Stack spacing={1.5} sx={{ alignItems: "center" }}>
                    <CheckCircle color="success" sx={{ fontSize: 48 }} />

                    <Typography sx={{ fontWeight: 700 }}>
                      Archivo listo
                    </Typography>

                    <Typography>{selectedFile.name}</Typography>

                    <Typography variant="body2" color="text.secondary">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </Typography>

                    <Button
                      color="error"
                      startIcon={<DeleteOutlined />}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedFile(null);
                        setFileError(null);

                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    >
                      Remover archivo
                    </Button>
                  </Stack>
                ) : (
                  <Stack spacing={2} sx={{ alignItems: "center" }}>
                    <CloudUploadOutlined
                      sx={{
                        fontSize: 48,
                        color: "primary.main",
                      }}
                    />

                    <Box>
                      <Typography sx={{ fontWeight: 600 }}>
                        Arrastra y suelta un documento aquí
                      </Typography>
                      <Typography>o haz clic para seleccionar</Typography>

                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary", marginTop: "10px" }}
                      >
                        Formatos aceptados: PDF, JPG, JPEG, PNG, DOC, DOCX, TIFF
                        | Tamaño máximo: 10 MB
                      </Typography>
                    </Box>
                  </Stack>
                )}
              </Paper>
              {fileError && (
                <Typography color="error" variant="body2">
                  {fileError}
                </Typography>
              )}
            </>
          )}
          {inputMode === "text" && (
            <TextField
              label="Contenido del documento"
              placeholder="Ingresa o pega aquí el contenido del documento clínico..."
              value={documentText}
              onChange={(event) => setDocumentText(event.target.value)}
              multiline
              minRows={8}
              fullWidth
            />
          )}
        </Box>
        <Stack spacing={2} sx={{ marginTop: "10px" }} direction="row">
          <FormControl fullWidth required>
            <InputLabel id="origin-channel-label">Canal de origen</InputLabel>

            <Select
              labelId="origin-channel-label"
              value={originChannel}
              label="Canal de origen"
              onChange={(event) => {
                setOriginChannel(event.target.value);

                if (event.target.value !== "Otro") {
                  setCustomOriginChannel("");
                }
              }}
            >
              {ORIGIN_CHANNELS.map((channel) => (
                <MenuItem key={channel} value={channel}>
                  {channel}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {originChannel === "Otro" && (
            <TextField
              label="Especifica el canal de origen"
              value={customOriginChannel}
              onChange={(event) => setCustomOriginChannel(event.target.value)}
              required
              fullWidth
            />
          )}

          <TextField
            label="Identificador del documento (opcional)"
            placeholder="Ej. N° de solicitud, folio, ID externo..."
            value={documentId}
            onChange={(event) => setDocumentId(event.target.value)}
            helperText="Identificador del documento (opcional)"
            fullWidth
          />
        </Stack>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "flex-start" }}
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<SettingsOutlined />}
            onClick={() => {
              if (!validateForm()) {
                return;
              }
            }}
          >
            Procesar documento
          </Button>

          <Button
            variant="outlined"
            size="large"
            onClick={handleClearForm}
            startIcon={<DeleteOutlined />}
          >
            Limpiar
          </Button>
        </Stack>
        {formError && (
          <Typography color="error" variant="body2">
            {formError}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

export default ProcessingPage;
