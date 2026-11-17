# Cruzadinha Professor Joás

Nome do projeto: `cruzadinha-professorjoas`.

Endereço canônico: `https://cruzadinha.professorjoas.com.br`.
Veja a integração com o Escaninho em [DOMINIO.md](./DOMINIO.md).

O Escaninho Digital incorpora este mesmo aplicativo na página
`/atividades/cruzadinha/`.

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
professor. Compartilhar por link não exige conta nem banco; para publicar uma
atividade na galeria permanente, o curador precisa entrar na conta autorizada.
Preserve o link completo; editar a atividade depois não altera os links já enviados.

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

## Galeria permanente

Os temas iniciais continuam em `src/data/puzzles.ts`. Novas atividades podem ser
publicadas pela área do professor em **Salvar na galeria permanente**. A galeria
é compartilhada por `cruzadinha.professorjoas.com.br` e pela página incorporada
do Escaninho. As alterações no editor só se tornam públicas depois de clicar em
**Publicar alterações**.

## Navegação e dados

- Setas movem entre casas; letras preenchem e Backspace apaga.
- Enter avança para outra palavra e Shift+Enter volta.
- Tab e Shift+Tab permitem sair da grade.
- Clique novamente em um cruzamento para mudar a direção.
- O progresso e o histórico de ajuda são armazenados neste navegador.
- Se o armazenamento falhar, um aviso informa que a tentativa fica apenas na página.
- Limpar reinicia a tentativa atual, incluindo o histórico de ajuda.

As tentativas e rascunhos locais não são sincronizados. Apagar os dados do
navegador remove esses dados, mas não remove atividades publicadas na galeria.
As respostas fazem parte do código enviado ao navegador; este projeto é uma
atividade educativa, não um sistema de avaliação com respostas sigilosas.

# Galeria permanente de cruzadinhas

As atividades da galeria permanente ficam no Postgres compartilhado do site e
são visíveis para alunos em qualquer dispositivo. Para habilitar a publicação
em produção, configure no projeto Vercel:

- `DATABASE_URL`: conexão de produção do banco Neon. A migração cria as tabelas
  de autenticação e da galeria durante o build.
- `CURATOR_EMAILS`: e-mail autorizado a administrar a galeria.
- `CURATOR_PASSWORD`: senha forte e exclusiva, com pelo menos 16 caracteres.

Não existe cadastro público. Na área do professor, entre com essas credenciais;
a sessão é protegida por cookie HttpOnly e expira após 14 dias. O servidor
confere a sessão em cada publicação, edição ou exclusão.

Depois de definir as variáveis, faça um novo deploy de produção. O servidor
valida a sessão e a lista de curadores em cada gravação. Se faltar o banco ou a
conta autorizada, a publicação falha com uma mensagem clara. O armazenamento
local do navegador continua servindo apenas para tentativas e rascunhos.
