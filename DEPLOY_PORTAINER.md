# Deploy da VPS pelo Portainer

Use o arquivo `compose.portainer.yaml` como Stack de produção.

## Se o projeto estiver no GitHub

1. Envie este repositório para o GitHub.
2. No Portainer, abra **Stacks > Add stack**.
3. Escolha **Repository**.
4. Informe a URL do repositório.
5. Em **Compose path**, use `compose.portainer.yaml`.
6. Clique em **Deploy the stack**.

## Se o repositório for privado

Use um GitHub access token somente no Portainer ou faça upload dos arquivos da aplicação para a VPS. Não coloque tokens ou cookies no repositório.

Após o deploy, a aplicação ficará na porta `3000`. Configure o proxy reverso do domínio/subdomínio para `127.0.0.1:3000` e ative HTTPS.

O compose de produção não usa `YT_DLP_INSECURE_TLS=true`.
