from fastapi import FastAPI


app = FastAPI(title="MediFlow AI Core")


@app.get("/health")
def health() -> dict[str, str]:
	return {"status": "ok"}
