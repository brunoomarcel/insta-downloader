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

O endpoint usa `yt-dlp` no container para resolver e transmitir o vídeo do Instagram ou Pinterest.

O Instagram pode exigir uma sessão autorizada para liberar vídeos. Exporte os cookies da sua própria sessão no formato Netscape e escolha uma destas opções:

- local/Docker: coloque o arquivo em `cookies/instagram.txt`;
- Portainer: configure o segredo `YT_DLP_COOKIES_B64` com o conteúdo do arquivo codificado em Base64.

Nunca publique cookies nem os envie ao Git. Depois de atualizar o container, faça um novo deploy para instalar a versão atual do `yt-dlp`.

No Docker local, `compose.yaml` ativa `YT_DLP_INSECURE_TLS=true` apenas para contornar o certificado autoassinado do proxy de desenvolvimento. Remova essa variável antes de publicar na VPS.
