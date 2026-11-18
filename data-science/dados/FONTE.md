# Fonte de `sessoes_telecentro.csv`

**Base simulada.** O arquivo é gerado por `../gerar_dados.py` com a semente fixa 2026: rodar de novo dá o mesmo arquivo, byte a byte. A base tem 1 247 sessões de 420 pessoas fictícias e **nenhum dado pessoal real**.

| parte | origem |
|---|---|
| distância a pé até o telecentro mais próximo (`distancia_m`, `minutos_caminhada`) | **Real.** As ruas do centro de São Paulo (recorte da Paulista ao Centro) vêm do OpenStreetMap: © OpenStreetMap contributors, licença ODbL, https://www.openstreetmap.org/copyright. A distância é a menor caminhada pelas ruas, calculada pelo Dijkstra multi-fonte do planejador de Programação Dinâmica da equipe. A casa de cada pessoa é um cruzamento sorteado do mapa. |
| `lab`, `handbook`, `minutos_estimados` | **Real.** É o catálogo do OpenLabs (https://github.com/CabriniJr/open-labs), com os mesmos minutos da tabela `T_LAB` do banco de dados da equipe. |
| telecentros | **Simulado.** São quatro pontos de acesso fictícios, junto a lugares conhecidos do mapa (Praça da República, Liberdade, Bixiga e Estação da Luz). |
| idade, internet em casa, período, tempo no lab, uso do showcase, nota e retorno | **Simulado**, pelas regras escritas em `gerar_dados.py`. São hipóteses da equipe, não medições. |
| idades faltando (~3%) e cronômetros ligados (~1%) | Inseridos de propósito, para a etapa de preparação dos dados. |

## Por que simulado

A GS pede que não se usem dados pessoais reais. Dados de alunos reais de telecentros, com nota e retorno, não são públicos. O caminho para dados reais é o banco que a equipe projetou na disciplina de Database Design: as tabelas `T_PROGRESSO` e `T_TENTATIVA` guardam exatamente estas medidas, e a análise pode ser refeita com elas, coletadas com consentimento.
