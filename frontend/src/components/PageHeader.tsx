import { Box, Typography } from "@mui/material";

type PageHeaderProps = {
  title: string;
  description?: string;
};

function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="h5"
        component="h1"
        sx={{ fontWeight: 600, letterSpacing: "-0.01em" }}
      >
        {title}
      </Typography>

      {description && (
        <Typography
          variant="body1"
          sx={{ mt: 1, maxWidth: "80ch", color: "text.secondary", textWrap: "pretty" }}
        >
          {description}
        </Typography>
      )}
    </Box>
  );
}

export default PageHeader;
