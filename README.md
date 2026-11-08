# WePay — aplicativo

Aplicativo Expo Router em React Native e TypeScript, com clientes para Android,
iOS e web.

## Configuração

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env` e ajuste `EXPO_PUBLIC_API_URL` para o
   endereço da API acessível pelo dispositivo. Essa variável é pública e não
   deve conter segredos.
3. Configure `EXPO_PUBLIC_EAS_PROJECT_ID` com o ID do projeto EAS para habilitar
   notificações push nativas.
4. Inicie o backend e execute `npx expo start`.

Em um celular na rede local, use o IP do computador no `EXPO_PUBLIC_API_URL`;
`localhost` aponta para o próprio celular. Em produção, use HTTPS.

Senhas novas devem ter pelo menos 12 caracteres. Senhas existentes continuam
válidas para login.

## Verificações

```bash
npm run lint
npx tsc --noEmit
npm test -- --runInBand
```

## Sessão e privacidade

No Android e iOS, os tokens de sessão são guardados no armazenamento seguro do
sistema por meio de `expo-secure-store`. Tokens existentes no AsyncStorage são
migrados para esse armazenamento na primeira leitura. Na web, onde o SecureStore
nativo não está disponível, o access token fica apenas em memória e o refresh
token é mantido em cookie `HttpOnly` pelo backend.

O cliente renova a sessão uma vez após uma resposta 401 e compartilha uma única
renovação entre requisições simultâneas. Falhas de conexão não apagam tokens que
ainda podem ser renovados.

Builds de produção exigem `EXPO_PUBLIC_API_URL`; o fallback para `127.0.0.1`
existe somente para desenvolvimento local. O build também rejeita URLs de
produção sem HTTPS ou apontadas para loopback.

O leitor envia a imagem do recibo à API, que a encaminha ao Google Gemini para
extração dos campos. Revise os dados sugeridos antes de salvar e não envie
documentos sem relação com a despesa.

## Notificações push

As notificações push de novas despesas em grupos estão disponíveis em Android e
iOS, em dispositivo físico e com um development build ou app publicado. O
registro pede a permissão do sistema somente quando a pessoa ativa notificações
em Configurações. O ID do projeto EAS é necessário para obter um Expo Push Token;
o Expo Go não substitui um build nativo para validar notificações push remotas.
As preferências de notificações e som ficam sincronizadas com a conta. A
notificação na tela bloqueada não inclui descrição nem valor da despesa.
