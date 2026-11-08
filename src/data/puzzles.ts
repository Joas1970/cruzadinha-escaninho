/**
 * Para trocar o assunto, edite o texto de cada cruzadinha
 * ou use o botão Conteúdo na própria atividade.
 *
 * Uma linha por resposta:
 *   PALAVRA | Dica que o aluno lê
 * Acentos não entram na grade: Razão vira RAZAO.
 * Posição travada (opcional): PALAVRA | Dica | linha,coluna,H
 */

export type PuzzleDoc = {
  id: string;
  source: string;
};

export const PUZZLES: PuzzleDoc[] = [
  {
    id: "iluminismo",
    source: `# O Iluminismo
# Século XVIII. A razão como critério para criticar privilégios e poder.

ILUMINISMO | Movimento que confiou na razão para reformar a sociedade
RAZAO | Faculdade que os iluministas tomaram como guia do conhecimento
VOLTAIRE | Francês que defendeu a liberdade de expressão e combateu o fanatismo
ROUSSEAU | Autor de O contrato social e crítico da desigualdade
LOCKE | Inglês dos direitos naturais e dos limites ao governante
ENCICLOPEDIA | Obra coletiva que organizou o saber iluminista
LIBERDADE | Direito de pensar, crer e falar sem arbítrio
TOLERANCIA | Defesa da convivência entre crenças e opiniões diferentes
CONTRATO | Acordo que, para alguns filósofos, funda a autoridade política
CENSURA | Controle que impede a circulação de ideias
IGUALDADE | Ideia de que ninguém nasce submetido a privilégio de sangue
DIREITOS | O que, para Locke, pertence à pessoa mesmo antes do Estado
`,
  },
  {
    id: "grecia",
    source: `# Grécia antiga
# Pólis, democracia e o nascimento da filosofia.

DEMOCRACIA | Governo em que cidadãos decidem os rumos da pólis
FILOSOFIA | Busca racional pelo saber, nascida nas cidades gregas
SOCRATES | Ateniense que interrogava para revelar a própria ignorância
PLATAO | Discípulo de Sócrates e autor de A República
ARISTOTELES | Filósofo da ética, da política e da lógica
POLIS | Cidade-Estado grega, comunidade política autônoma
AGORA | Praça pública onde se debatia e se comerciava
ATENAS | Pólis ligada à democracia, ao teatro e à filosofia
ESPARTA | Pólis militarizada do Peloponeso
CIDADAO | Homem livre com participação na vida política
ACADEMIA | Escola fundada por Platão nos arredores de Atenas
PERICLES | Nome associado ao apogeu democrático ateniense
HELENISMO | Cultura grega espalhada após as conquistas de Alexandre
MITO | Narrativa tradicional sobre deuses, heróis e origens
`,
  },
  {
    id: "guerra",
    source: `# A Primeira Guerra
# 1914–1918. Causas, alianças e o cotidiano das trincheiras.

IMPERIALISMO | Disputa entre potências por colônias e mercados
NACIONALISMO | Exaltação da nação que acirrou rivalidades europeias
TRIPLICE | Aliança que reuniu Alemanha, Áustria-Hungria e Itália
ENTENTE | Aproximação entre França, Rússia e Reino Unido
SARAJEVO | Cidade do atentado contra o arquiduque Francisco Ferdinando
TRINCHEIRA | Vala de combate típica da frente ocidental
VERSALHES | Tratado de 1919 que impôs duras condições à Alemanha
ARMISTICIO | Fim dos combates, em novembro de 1918
PROPAGANDA | Discurso oficial usado para mobilizar a população
ALIANCA | Compromisso militar entre Estados
BALCANICA | Região cuja crise ajudou a detonar o conflito
GUERRA | Nome do enfrentamento que durou mais de quatro anos
`,
  },
  {
    id: "teorias-raciais",
    source: `# Teorias Raciais e Imperialismo Europeu
# Século XIX. As ideias de superioridade racial e a expansão do domínio europeu na África e na Ásia.

IMPERIALISMO | Política de expansão e domínio econômico e político de uma potência sobre outros territórios.
TEORIASRACIAIS | Ideias que classificavam os seres humanos em supostas raças superiores e inferiores.
DARWINISMO | Apropriação distorcida da seleção natural para justificar desigualdades entre grupos humanos.
DETERMINISMO | Concepção segundo a qual raça, ambiente e condições naturais determinariam o destino das sociedades.
EUROPEIA | Origem das potências que ampliaram seu domínio sobre territórios africanos e asiáticos.
AFRICA | Continente que sofreu a expansão colonial europeia durante o século XIX.
ASIA | Continente que também foi alvo da expansão imperialista europeia.
MISSAO | Palavra utilizada pelos europeus para apresentar a dominação colonial como uma obrigação civilizadora.
MATERIASPRIMAS | Recursos naturais retirados das colônias para atender às necessidades econômicas europeias.
MERCADOS | Espaços consumidores procurados pelas potências europeias para comercializar seus produtos.
AUTONOMIA | Capacidade de um povo de governar a si mesmo, perdida por diversas sociedades colonizadas.
EXPLORACAO | Utilização dos recursos naturais e da mão de obra dos territórios dominados em benefício das potências coloniais.
`,
  },
];

export const CUSTOM_ID = "custom";
