# Domínio da Cruzadinha Professor Joás

## Objetivo

Um único aplicativo, com dois acessos:

- Escaninho Digital: https://www.escaninhodigital.com.br/atividades/cruzadinha/
- Subdomínio solicitado: https://cruzadinha.professorjoas.com.br

O segundo endereço ainda precisa ser configurado. Não é necessário duplicar
o código, criar um segundo projeto de hospedagem ou transferir o domínio.

## Configuração identificada em 15/10/2026

- Projeto Vercel: `cruzadinha-escaninho`.
- ID: `prj_I3C0evS5B8b1J2xWHhF03aQT3HGD`.
- Equipe: `joas-alvess-projects`.
- Aplicativo atual: https://cruzadinha-escaninho.vercel.app
- DNS de `professorjoas.com.br`: administrado na Netlify, conforme o SOA público.
- `cruzadinha.professorjoas.com.br`: sem registro DNS na consulta realizada.

A conexão da Vercel listou o projeto, mas a consulta detalhada e a tentativa de
associar o domínio retornaram `404 Project not found`. Não houve confirmação
de inclusão do domínio. Não há autenticação local do CLI da Vercel nem acesso
conectado à administração de DNS da Netlify neste ambiente.

## Ativação

1. Abra o projeto `cruzadinha-escaninho` na equipe `joas-alvess-projects`, na Vercel.
2. Em **Settings → Domains → Add Domain**, adicione
   `cruzadinha.professorjoas.com.br` ao ambiente de produção, sem redirecioná-lo
   para outro site.
3. Copie o registro CNAME exato indicado pela Vercel para esse projeto.
4. Na zona DNS de `professorjoas.com.br`, na Netlify, crie:

   | Tipo | Nome | Valor |
   | --- | --- | --- |
   | CNAME | `cruzadinha` | Destino informado pela Vercel no passo anterior |

5. Aguarde a Vercel confirmar o DNS e disponibilizar o HTTPS.
6. Verifique o modo aluno em `/` e o modo professor em `/?modo=professor`.

Não há um destino CNAME confirmado pela Vercel neste atendimento. Use o valor
exibido no painel, em vez de presumir um endereço genérico.

## Integração existente

O Escaninho continua incorporando a aplicação pelo endereço Vercel já funcional.
Quando o subdomínio estiver ativo, os links, a incorporação e a validação de
origem das mensagens podem ser atualizados juntos no repositório
`Joas1970/escaninho-digital`. Não altere somente o `src` do iframe: o evento de
ajuste de altura também confere a origem da aplicação.

O compartilhamento usa a origem pela qual a aplicação foi aberta. Assim, os
links e QR codes gerados no novo domínio já usarão o novo endereço. O progresso
fica no armazenamento de cada origem: tentativas salvas no endereço Vercel não
são transferidas automaticamente ao subdomínio.

Referências: [Vercel — adicionar domínio](https://vercel.com/docs/domains/working-with-domains/add-a-domain),
[Netlify — DNS](https://docs.netlify.com/manage/domains/manage-domains/manage-dns-records/).
