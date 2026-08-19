# Base de cursistas — modelo de importacao

Arquivo de referencia: [modelo_base_cursistas.csv](modelo_base_cursistas.csv)

## Formato

- CSV separado por **ponto e virgula** (`;`), codificado em **UTF-8**.
- A primeira linha e o cabecalho e deve ser mantida exatamente como esta no modelo.
- Uma linha por profissional.

## Colunas

| Coluna | Obrigatorio | Formato | Observacao |
|---|---|---|---|
| `cpf` | sim | 11 digitos | Aceita com ou sem pontuacao; o sistema normaliza e valida os digitos verificadores. E a chave unica do cadastro. |
| `nome_completo` | sim | texto | Nome como deve aparecer no certificado. |
| `data_nascimento` | nao | `AAAA-MM-DD` | Usado para conferencia de identidade e desempate de homonimos. |
| `email` | nao | texto | Se vazio, o cursista informa no primeiro acesso. |
| `telefone` | nao | so digitos | Com DDD. |
| `matricula` | nao | texto | Matricula funcional na rede. |
| `cargo` | nao | texto | Professor, Supervisor Escolar, Gestor etc. |
| `escola` | nao | texto | Unidade de lotacao. |
| `municipio` | nao | texto | |
| `regional` | nao | texto | Gerencia Regional de Educacao. |

## Cuidado ao gerar o arquivo pelo Excel

O Excel trata CPF como numero e **remove o zero a esquerda** — `01234567890` vira
`1234567890` e o registro passa a ter 10 digitos. Isso e a causa mais comum de
falha em importacoes de base com CPF.

Para evitar:

1. Formate a coluna do CPF como **Texto** antes de digitar ou colar, ou
2. Salve como CSV e confira num editor de texto se os CPFs que comecam com zero
   mantiveram os 11 digitos.

O importador tambem completa com zeros a esquerda quando recebe menos de 11
digitos, mas conferir na origem evita associar o registro ao CPF errado.

## O que o importador faz

- Normaliza o CPF (remove pontuacao, completa zeros a esquerda) e **valida os
  digitos verificadores** — linhas com CPF invalido sao rejeitadas e listadas.
- Rejeita CPF duplicado dentro do proprio arquivo.
- Para CPF que ja existe no sistema, **atualiza os dados cadastrais e nao mexe na
  senha** — reimportar a base nao derruba o acesso de quem ja trocou a senha.
- Registra o resultado (inseridos, atualizados, rejeitados) na trilha de auditoria.

## Primeiro acesso

Cada cursista importado entra com:

- **Login:** CPF (so digitos)
- **Senha:** o proprio CPF

No primeiro acesso o sistema **obriga a definir uma senha nova** antes de liberar
qualquer tela. A partir dai o CPF nao funciona mais como senha.

> Por isso a base so deve ser importada proximo a abertura das inscricoes: enquanto
> um cursista nao fizer o primeiro acesso, o CPF dele e a senha dele. Quanto menor
> essa janela, menor a exposicao.
