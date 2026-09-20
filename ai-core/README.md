# MediFlow AI Core

Servicio de IA del proyecto MediFlow. Expone el procesamiento de documentos clínicos mediante una API FastAPI.

## Desarrollo local

```powershell
cd ai-core
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

La API queda disponible en `http://localhost:8000` y su estado se puede consultar en `GET /health`.

## Pruebas

```powershell
pytest
```
