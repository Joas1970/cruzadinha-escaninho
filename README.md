# Cruzadinha Professor Joás

Nome do projeto: `cruzadinha-professorjoas`.

Endereço personalizado planejado: `https://cruzadinha.professorjoas.com.br`.
A ativação depende da associação do subdomínio na Vercel e do registro DNS na
Netlify. Veja o roteiro em [DOMINIO.md](./DOMINIO.md).

A integração atual do Escaninho Digital e o endereço
`https://cruzadinha-escaninho.vercel.app` continuam usando o mesmo aplicativo.
O repositório GitHub e o nome do projeto de hospedagem permanecem como estão
para preservar as conexões existentes durante a ativação do domínio.

Atividades de História e Filosofia com montagem automática, editor de conteúdo,
conferência, gabarito, teclado virtual e impressão.

## Alunos e professores

O endereço público abre no **modo aluno**, sem Revelar, Gabarito ou Conteúdo.
Para preparar atividades, abra `/?modo=professor`.

Na área do professor, escolha um tema ou crie uma atividade em **Conteúdo** e
clique em **Compartilhar atividade**. O painel oferece link para a turma,
WhatsApp, compartilhamento pelo dispositivo, QR code para baixar e apresentação
para projetar na sala. O professor pode desativar o botão Conferir no link enviado.

Os temas usam `?modo=aluno&tema=grecia`. As atividades personalizadas são
comprimidas no fragmento `#atividade=...` do link, sem enviar as tentativas do
professor. Não é necessário cadastro ou banco de dados. Preserve o link completo;
editar a atividade depois não altera os links já enviados.

Tentativas de alunos e professores ficam separadas no armazenamento local.
Os modos organizam a interface; não são autenticação e não mantêm respostas em
sigilo contra inspeção técnica. A área do professor é um endereço de preparação,
não um painel administrativo protegido.

## Incorporação no Escaninho Digital

A página `/atividades/cruzadinha/` no repositório `escaninho-digital` incorpora
a aplicação da Vercel em modo aluno e aparece na coleção **Atividades e jogos**.
O link para abrir em tela inteira é uma alternativa para navegadores que bloqueiam
armazenamento em páginas incorporadas.

Para outros sites, abra **Compartilhar atividade → Incorporar em uma página do site**
e copie o código. O `iframe` inclui um título acessível; `public/embed.js` ajusta
a altura somente para mensagens provenientes da janela e origem esperadas.
Links extensos continuam disponíveis para copiar, mas o QR code é desativado
quando excede o limite definido para leitura. Encurte dicas para gerar um QR legível.

## Executar

Use Node.js 22.18 ou superior e npm:

```sh
npm ci
npm run dev
```

O servidor usa a porta 8080. `startup.sh` atende ao ambiente Linux original do
Grok; no Windows, execute o comando npm diretamente.

## Verificar

```sh
npm test
npm run test:crossword
npm run typecheck
npm run build
```

Os testes incluem o motor de cruzadinhas e a recuperação e gravação do progresso.
A configuração de publicação mantém os recursos da plataforma Grok e Vercel.

`test:crossword` verifica apenas o motor e o salvamento. A suíte geral também
inclui testes herdados da plataforma; há falhas conhecidas em expectativas de
metadados e permissões de links simbólicos no Windows.

Com o servidor iniciado e Chromium instalado para o Playwright, execute
`node scripts/crossword-qa.mjs` para verificar desktop e celular. Para verificar
a versão compilada, inicie `npm run preview` e execute
`node scripts/crossword-qa.mjs http://127.0.0.1:8081/`.
Se necessário, `QA_BROWSER_PATH` indica o executável de um Chromium existente.

## Editar atividades

Abra **Conteúdo** ou edite `src/data/puzzles.ts`. Exemplo:

```text
# Minha atividade
# Observação opcional
CASA | Lugar de morar | 1,1,H
AMOR | Afeto | 1,2,V
```

Sem coordenadas, o motor monta a grade automaticamente. H significa horizontal,
V vertical. As coordenadas começam em 1 e vão até 40. Cada resposta contém
de 3 a 16 letras; são permitidas até 20 palavras. Acentos são normalizados.
O editor informa problemas de leitura e de encaixe antes de aplicar a atividade.

## Navegação e dados

- Setas movem entre casas; letras preenchem e Backspace apaga.
- Enter avança para outra palavra e Shift+Enter volta.
- Tab e Shift+Tab permitem sair da grade.
- Clique novamente em um cruzamento para mudar a direção.
- O progresso e o histórico de ajuda são armazenados neste navegador.
- Se o armazenamento falhar, um aviso informa que a tentativa fica apenas na página.
- Limpar reinicia a tentativa atual, incluindo o histórico de ajuda.

Não há sincronização entre dispositivos. Apagar os dados do navegador remove
as tentativas e a atividade personalizada. As respostas fazem parte do código
enviado ao navegador; este projeto é uma atividade educativa, não um sistema
de avaliação com respostas sigilosas.
