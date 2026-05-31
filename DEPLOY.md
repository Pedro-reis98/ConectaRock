# Deploy do Conecta Rock

## Melhor escolha

Para este projeto, a melhor opcao e subir tudo junto no Render como Web Service.

Motivo: o Conecta Rock usa Express + Socket.IO. O servidor precisa ficar vivo mantendo conexoes WebSocket abertas. Render Web Services aceitam WebSockets. Vercel e otimo para frontend estatico, mas Vercel Functions nao sao ideais para manter um servidor Socket.IO persistente.

## Opcao A: Render full-stack, recomendada

Use esta opcao para entregar o desafio sem dor de cabeca.

1. Entre no Render.
2. New + Web Service ou Blueprint.
3. Conecte o repo:

```text
https://github.com/Pedro-reis98/ConectaRock
```

4. Se for Web Service manual:

```text
Runtime: Node
Build Command: npm ci
Start Command: npm start
Health Check Path: /health
```

5. Variaveis:

```text
NODE_VERSION=20
CORS_ORIGIN=*
PUBLIC_SOCKET_URL=
```

6. Depois de publicar, abra a URL do Render. O frontend e o backend rodam no mesmo dominio.

## Opcao B: backend no Render + frontend no Vercel

Use esta opcao se o professor pedir front e backend separados.

### Render

Crie o Web Service como acima. Depois de publicar, copie a URL, por exemplo:

```text
https://conecta-rock.onrender.com
```

Se ja souber a URL do Vercel, troque o CORS para:

```text
CORS_ORIGIN=https://seu-projeto.vercel.app
PUBLIC_SOCKET_URL=
```

Para facilitar durante testes, `CORS_ORIGIN=*` tambem funciona.

### Vercel

1. Importe o mesmo repo no Vercel.
2. Framework Preset: Other.
3. Build Command: vazio ou None.
4. Output Directory:

```text
public
```

5. Adicione a variavel de ambiente:

```text
SOCKET_URL=https://sua-url-do-render.onrender.com
```

6. Deploy.

Neste modo, o HTML/CSS/JS ficam na Vercel e o Socket.IO conecta no Render.

## Observacao sobre historico

O historico fica salvo em `data/messages.json`. Em hospedagem gratuita, o arquivo pode voltar ao estado do repo quando o servico reinicia ou redeploya. Para o desafio isso normalmente e suficiente. Para producao real, o ideal seria banco de dados.
