# FastAPI joblib bridge

HTTP inference service for `.joblib` / `.pkl` models. Java Spring Boot calls this API; it does not load joblib itself.

## Setup

```powershell
cd C:\Users\jainv\Projects\fastapi-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Put trained files in `models/`, for example:

- `models/credit_risk.joblib`
- `models/churn.pkl`

The API name is the file stem (`credit_risk`, `churn`).

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness + loaded model names |
| GET | `/models` | List loaded models |
| POST | `/predict` | Run `predict` (and `predict_proba` when available) |

Example body:

```json
{
  "model": "credit_risk",
  "features": [0.12, 1, 34.5]
}
```

Named features (sklearn `ColumnTransformer` / pandas-trained models):

```json
{
  "model": "credit_risk",
  "features": { "age": 34, "income": 72000, "score": 0.81 }
}
```

## Spring Boot

```java
@Service
public class InferenceClient {
    private final RestClient http = RestClient.create();

    public JsonNode predict(String model, Object features) {
        return http.post()
            .uri("http://localhost:8000/predict")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("model", model, "features", features))
            .retrieve()
            .body(JsonNode.class);
    }
}
```

Keep this process running on a known host/port. Point Spring Boot at that URL with a property such as `inference.base-url=http://localhost:8000`.
