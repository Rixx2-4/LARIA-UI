# Backend Endpoint: GET /documents/{id}/content

## Descripción

Endpoint para descargar el contenido binario de un documento subido. Permite al frontend mostrar previews de archivos (imágenes, PDFs, texto) y descargarlos.

## Endpoint

```
GET /api/v1/documents/{id}/content
```

## Autenticación

Requiere header `Authorization: Bearer <token>`. Solo el dueño del documento puede acceder a su contenido.

## Parámetros

| Parámetro | Tipo   | Descripción                          |
|-----------|--------|--------------------------------------|
| `id`      | string | UUID del documento (path parameter)  |

## Response

### Éxito (200 OK)

El contenido del archivo con el `Content-Type` apropiado:

- **Imágenes:** `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- **PDFs:** `application/pdf`
- **Texto:** `text/plain`
- **JSON:** `application/json`
- **XML:** `text/xml`
- **Código:** `text/plain` (para .py, .js, .ts, etc.)
- **Otros:** `application/octet-stream`

**Headers importantes:**
```
Content-Type: <mime-type del archivo>
Content-Length: <tamaño en bytes>
Content-Disposition: inline; filename="<nombre original>"
Cache-Control: private, max-age=3600
```

### Error (404 Not Found)

```json
{
  "detail": "Documento no encontrado"
}
```

### Error (403 Forbidden)

```json
{
  "detail": "No tienes permiso para acceder a este documento"
}
```

### Error (401 Unauthorized)

```json
{
  "detail": "Token inválido o expirado"
}
```

## Ejemplo de Implementación (FastAPI)

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import mimetypes

router = APIRouter()

@router.get("/documents/{document_id}/content")
async def get_document_content(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Buscar el documento
    document = db.query(Document).filter(Document.id == document_id).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    
    # 2. Verificar que el usuario es el dueño
    if document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso para acceder a este documento")
    
    # 3. Obtener el content type
    content_type, _ = mimetypes.guess_type(document.filename)
    if not content_type:
        content_type = "application/octet-stream"
    
    # 4. Retornar el archivo
    # Asumiendo que el archivo está en disco o en un bucket
    file_path = get_file_path(document)  # Función que retorna la ruta del archivo
    
    def iter_file():
        with open(file_path, "rb") as f:
            while chunk := f.read(8192):
                yield chunk
    
    return StreamingResponse(
        iter_file(),
        media_type=content_type,
        headers={
            "Content-Length": str(document.file_size),
            "Content-Disposition": f'inline; filename="{document.filename}"',
            "Cache-Control": "private, max-age=3600",
        }
    )
```

## Notas para el Desarrollador

1. **Almacenamiento:** El endpoint debe leer el archivo del mismo almacenamiento donde se guarda al subir (disco local, S3, GCS, etc.)

2. **Seguridad:** Verificar que el `owner_id` del documento coincida con el usuario autenticado

3. **MIME Type:** Usar `mimetypes.guess_type()` o similar para detectar el tipo correcto

4. **Streaming:** Para archivos grandes, usar streaming en vez de cargar todo en memoria

5. **Cache:** El header `Cache-Control: private, max-age=3600` permite cachear 1 hora por usuario

6. **CORS:** Asegurar que el endpoint permita CORS desde el frontend

## Frontend - Uso

El frontend ya está implementado para usar este endpoint:

```typescript
// En file-viewer.tsx
const API_BASE_URL = process.env.NEXT_PUBLIC_LARIA_API_URL
const token = localStorage.getItem("laria_token")

// Para imágenes
<img src={`${API_BASE_URL}/documents/${documentId}/content`} />

// Para PDFs
<iframe src={`${API_BASE_URL}/documents/${documentId}/content`} />

// Para texto
const response = await fetch(`${API_BASE_URL}/documents/${documentId}/content`, {
  headers: { Authorization: `Bearer ${token}` }
})
const text = await response.text()
```

## Testing

```bash
# Obtener token
TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/token \
  -d "username=user@example.com&password=password" \
  -H "Content-Type: application/x-www-form-urlencoded" | jq -r '.access_token')

# Descargar contenido de un documento
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/documents/{document_id}/content \
  --output archivo.pdf

# Verificar Content-Type
curl -I -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/documents/{document_id}/content
```
