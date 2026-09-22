from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.enums import InputType


class ProcessingRequest(BaseModel):
	model_config = ConfigDict(
		extra="forbid",
		str_strip_whitespace=True,
	)

	documento_id: str = Field(min_length=1)
	input_type: InputType
	mime_type: str = Field(min_length=1)
	file_name: str | None = None
	content_base64: str | None = None
	documento_texto: str | None = None
	canal_origen: str = Field(min_length=1)

	@model_validator(mode="after")
	def validate_content_by_input_type(self) -> "ProcessingRequest":
		if self.input_type == InputType.FILE and not self.content_base64:
			raise ValueError(
				"content_base64 is required when input_type is FILE"
			)

		if self.input_type == InputType.TEXT and not self.documento_texto:
			raise ValueError(
				"documento_texto is required when input_type is TEXT"
			)

		return self
