# Palavras Cruzadas

Atividades de História e Filosofia com montagem automática, editor de conteúdo,
conferência, gabarito, teclado virtual e impressão.

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
