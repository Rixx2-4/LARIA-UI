# Backend Endpoint: POST /chats/generate-title

## Descripcion

Endpoint para generar automaticamente un titulo corto y representativo para una conversacion, usando IA.

## Endpoint

```
POST /api/v1/chats/generate-title
```

## Autenticacion

Requiere header `Authorization: Bearer <token>`.

## Request Body

```json
{
  "messages": [
    { "role": "user", "content": "Que es la fotosintesis?" },
    { "role": "assistant", "content": "La fotosintesis es el proceso..." }
  ]
}
```

| Campo      | Tipo   | Descripcion                           |
|------------|--------|---------------------------------------|
| messages   | array  | Lista de mensajes de la conversacion  |

## Response

### Exito (200 OK)

```json
{
  "title": "Fotosintesis vegetal"
}
```

### Error (401 Unauthorized)

```json
{ "detail": "Token invalido o expirado" }
```

### Error (422 Validation Error)

```json
{ "detail": "Se requiere al menos un mensaje" }
```

## Reglas de Generacion (Prompt para IA)

El backend debe usar un prompt como este:

```
Genera un titulo corto para esta conversacion siguiendo estas reglas:

1. El titulo debe tener entre 2 y 7 palabras.
2. Debe describir el tema principal, no resumir toda la conversacion.
3. Evita palabras genericas como: Chat, Conversacion, Pregunta, Ayuda, Nueva conversacion.
4. Usa nombres especificos cuando sean importantes: marcas, modelos, videojuegos, lenguajes de programacion, proyectos, lugares.
5. No cambies el titulo si el usuario cambia de tema posteriormente.
6. Evita titulos demasiado largos o explicativos.
7. No incluyas comillas, emojis, hashtags ni puntuacion innecesaria.
8. Manten el titulo en el mismo idioma predominante de la conversacion.
9. Si existen varios temas, selecciona el que tenga mayor relevancia o que haya iniciado la conversacion.

Mensajes:
{messages}

Titulo:
```

## Ejemplo de Implementacion (FastAPI)

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from openai import OpenAI

router = APIRouter()

class GenerateTitleRequest(BaseModel):
    messages: list[dict]

class TitleResponse(BaseModel):
    title: str

@router.post("/chats/generate-title", response_model=TitleResponse)
async def generate_title(
    request: GenerateTitleRequest,
    current_user: User = Depends(get_current_user)
):
    if not request.messages:
        raise HTTPException(status_code=422, detail="Se requiere al menos un mensaje")
    
    client = OpenAI()
    
    messages_text = "\n".join([
        f"{m['role']}: {m['content']}" 
        for m in request.messages[:5]
    ])
    
    prompt = f"""Genera un titulo corto para esta conversacion siguiendo estas reglas:

1. El titulo debe tener entre 2 y 7 palabras.
2. Debe describir el tema principal, no resumir toda la conversacion.
3. Evita palabras genericas como: Chat, Conversacion, Pregunta, Ayuda, Nueva conversacion.
4. Usa nombres especificos cuando sean importantes: marcas, modelos, videojuegos, lenguajes de programacion, proyectos, lugares.
5. No cambies el titulo si el usuario cambia de tema posteriormente.
6. Evita titulos demasiado largos o explicativos.
7. No incluyas comillas, emojis, hashtags ni puntuacion innecesaria.
8. Manten el titulo en el mismo idioma predominante de la conversacion.
9. Si existen varios temas, selecciona el que tenga mayor relevancia o que haya iniciado la conversacion.

Mensajes:
{messages_text}

Titulo:"""
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=20,
        temperature=0.3
    )
    
    title = response.choices[0].message.content.strip()
    title = title.strip('"\'')
    if len(title) > 50:
        title = title[:50].rsplit(' ', 1)[0] + "..."
    
    return TitleResponse(title=title)
```

## Testing

```bash
TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/token \
  -d "username=user@example.com&password=password" \
  -H "Content-Type: application/x-www-form-urlencoded" | jq -r '.access_token')

curl -X POST http://localhost:8000/api/v1/chats/generate-title \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Que es Python?"}]}'
```
