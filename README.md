# Distrito Financeiro

Aplicação financeira da Barbearia Distrito com frontend Vite e autenticação
centralizada em uma API Node.

## Desenvolvimento

Requer Node.js 22.13 ou superior.

1. Entre em `distrito-financeiro`.
2. Copie `.env.example` para `.env` e defina a conta administrativa inicial.
3. Execute `npm install`.
4. Execute `npm run dev`.

O frontend fica disponível na porta informada pelo Vite e encaminha `/api` para
o servidor local na porta `8787`. Outros dispositivos na mesma rede devem abrir
o endereço de rede exibido pelo Vite; todos usarão a mesma conta armazenada em
`data/distrito.sqlite`.

As variáveis `ADMIN_EMAIL` e `ADMIN_PASSWORD` são utilizadas somente quando o
banco ainda não contém a conta administrativa. Depois disso, e-mail e senha são
alterados pela tela Configurações e persistidos no banco.

## Produção e nuvem

Execute `npm run build` e `npm start`, ou construa o `Dockerfile`. Em nuvem:

- configure `NODE_ENV=production`;
- defina `ADMIN_EMAIL` e uma `ADMIN_PASSWORD` com pelo menos 8 caracteres;
- mantenha `COOKIE_SECURE=true` e publique usando HTTPS;
- monte um volume persistente no caminho configurado em `DATABASE_PATH`;
- ajuste `CORS_ORIGIN` somente se frontend e API estiverem em domínios distintos.

O servidor entrega o frontend compilado e a API no mesmo domínio, evitando
exposição de tokens ao JavaScript e simplificando a publicação.

> Nesta etapa, a conta administrativa está centralizada. Lançamentos, despesas,
> catálogo e configurações financeiras ainda usam IndexedDB e permanecem locais
> em cada navegador; essa camada deverá ser migrada para a API quando a
> sincronização financeira em nuvem for implementada.
