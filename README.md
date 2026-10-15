# Insta Downloader

Site responsivo e instalável como PWA para baixar vídeos públicos do Instagram e Pinterest.

## Stack

- HTML, CSS e JavaScript puro
- Node.js + Fastify no endpoint `api/download`
- Sem banco de dados
- Docker opcional para testes locais

## Teste local com Docker

Com o Docker Desktop aberto, execute:

```bash
docker compose up --build
```

Abra http://localhost:8080. Para parar, use `docker compose down`.

O endpoint usa `yt-dlp` no container para resolver e transmitir o vídeo.

Se o Instagram responder `403`, exporte os cookies da sua própria sessão autorizada no formato Netscape para `cookies/instagram.txt`. Nunca publique esse arquivo nem o envie ao Git.

No Docker local, `compose.yaml` ativa `YT_DLP_INSECURE_TLS=true` apenas para contornar o certificado autoassinado do proxy de desenvolvimento. Remova essa variável antes de publicar na VPS.
