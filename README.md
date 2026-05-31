# Conecta Rock

Chat online em tempo real feito para o desafio de Socket.IO. O projeto usa Node.js, Express, Socket.IO e frontend puro com HTML, CSS e JavaScript.

## Como executar

1. Instale o Node.js: <https://nodejs.org/>
2. Abra o terminal na pasta do projeto:

```bash
cd "%USERPROFILE%\OneDrive\Desktop\ConectaRock"
npm install
npm start
```

3. Acesse <http://localhost:3000>

No Windows, tambem da para dar duplo clique em `start.bat`.

## Deploy

O jeito mais indicado e publicar tudo junto no Render, porque o projeto usa Socket.IO/WebSocket. Tambem deixei suporte para frontend na Vercel e backend no Render.

Leia o passo a passo em [`DEPLOY.md`](DEPLOY.md).

## Recursos implementados

- Envio e recebimento de mensagens em tempo real com Socket.IO.
- Aviso quando usuarios entram e saem do chat.
- Horario em cada mensagem.
- Mensagens proprias destacadas a direita.
- Lista e contador de usuarios online.
- Indicador de "digitando...".
- Salas de conversa: Geral, Backstage e Ao vivo.
- Mensagens privadas para usuarios da mesma sala.
- Emojis e upload de imagens pequenas.
- Tema claro/escuro.
- Som de notificacao.
- Historico persistente em `data/messages.json`.

## Teste rapido do socket

Com o servidor rodando em outro terminal, execute:

```bash
npm run test:socket
```

Esse teste cria dois usuarios via Socket.IO e valida o recebimento da mesma mensagem em tempo real.

## Estrutura

```text
ConectaRock/
  server.js
  package.json
  package-lock.json
  render.yaml
  vercel.json
  DEPLOY.md
  api/config.js
  start.bat
  data/messages.json
  public/
    index.html
    style.css
    script.js
    assets/
      stage-bg.png
  tests/socket-flow.js
```

## Eventos principais

- `user joined`: identifica o usuario e avisa a sala.
- `chat message`: envia mensagens para a sala ou para um usuario privado.
- `user left`: avisa quando alguem sai.
- `typing`: mostra quem esta digitando.
- `online users`: atualiza lista, contadores e salas.
