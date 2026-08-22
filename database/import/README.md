# Base de cursistas — formato de importacao

Tela: **Cursistas → Importar base (.xlsx)**, no painel administrativo.

## Formato

Um arquivo **.xlsx** com duas abas, exatamente como a base
`BASE_SISTEMA_LOGIN_DOCENTES` sai da origem:

| Aba | Papel |
|---|---|
| `USUARIOS` | uma linha por profissional: quem e e se pode entrar |
| `PERFIL_DOCENTE` | dados funcionais e escolas, ligados pelo `USUARIO_ID` |

O importador foi escrito a partir do arquivo real. **Nao converta, nao renomeie
colunas e nao apague nada antes de enviar** — envie a planilha como ela vem.

### Colunas que o importador le

Ele procura estes nomes no cabecalho. **Coluna que nao esteja nesta lista e
simplesmente ignorada**, entao a planilha pode ter quantas colunas a mais tiver.

Na aba `USUARIOS`:

| Coluna | Obrigatoria | O que faz |
|---|---|---|
| `CPF` | **sim** | Chave unica do cadastro e login. Aceita com ou sem pontuacao; o sistema valida os digitos verificadores. |
| `NOME_COMPLETO` | **sim** | Nome como vai no certificado. |
| `USUARIO_ID` | nao | Segunda chave unica, usada para ligar as duas abas. |
| `ATIVO` | nao | `1`/`sim` libera a conta; qualquer outro valor a desativa. Ver "Coluna ATIVO" abaixo. |
| `QTDE_VINCULOS` | nao | Reserva, quando a aba de perfil nao traz o numero. |

Na aba `PERFIL_DOCENTE`:

| Coluna | O que faz |
|---|---|
| `USUARIO_ID`, `CPF` | Ligacao com a aba `USUARIOS` (o `CPF` e a reserva se o `USUARIO_ID` vier vazio). |
| `FUNCAO`, `COMPONENTE_CURRICULAR`, `EIXO_TECNOLOGICO`, `CURSO_TECNICO` | Dados funcionais, somente leitura para o cursista. |
| `FORMACAO_ENCONTRADA`, `QTDE_VINCULOS`, `DATA_INICIO_REDE_ESTADUAL` | Idem. |
| `EMAIL_INSTITUCIONAL`, `EMAIL_PESSOAL`, `GENERO`, `DATA_NASCIMENTO` | Contato. O cursista completa o que faltar no primeiro acesso. |
| `INEP_1..4`, `GRE_1..4`, `ESCOLA_1..4` | Ate **quatro** escolas por pessoa. Preenche em sequencia: a quinta e ignorada. |

Datas podem vir como `AAAA-MM-DD`, `DD/MM/AAAA` ou numero serial do Excel.

### O que a planilha NAO controla

`PRIMEIRO_ACESSO`, `CADASTRO_CONFIRMADO`, `STATUS_ACESSO` e `STATUS_CADASTRO`
existem no arquivo de origem e sao **ignorados de proposito**. Quem manda no
estado de acesso e o que o cursista ja fez neste sistema, nao o que a base diz.

## A importacao soma, nao substitui

Esta e a duvida que mais aparece, entao vale ser exato. A importacao e **por
CPF**: ela toca apenas as linhas que estao no arquivo.

- **Quem nao esta no arquivo nao e tocado.** Importar um lote de 20 sobre uma
  base de 13 mil mexe em 20 registros e deixa os outros 12.980 exatamente como
  estavam.
- **Ninguem e excluido.** Nao existe importacao que remova cadastro. Quem entrou
  numa carga anterior e sumiu da planilha nova continua no sistema.
- Roda numa **transacao unica**: ou entra tudo, ou nao entra nada.

Para o CPF que **ja existe** no sistema, a importacao atualiza o cadastro:

| | |
|---|---|
| **Nunca toca** | senha, `cadastro_confirmado`, telefone, datas de acesso, origem |
| **Nao apaga** | data de nascimento e genero preenchidos pelo cursista |
| **So troca se a planilha trouxer valor** | funcao, componente, eixo, curso tecnico, e-mails, inicio na rede |
| **Sempre sobrescreve** | nome (a planilha sempre traz) |
| **Regrava do zero, se a planilha trouxer escolas** | os vinculos — a base oficial e a fonte da verdade da lotacao |

Ou seja: reimportar atualiza o cadastro e **nunca derruba o acesso** de quem ja
entrou.

> **Por que "so troca se trouxer valor".** Um lote parcial montado apenas com a
> aba `USUARIOS` chega sem nenhum dado funcional. Se a planilha vazia mandasse,
> aquelas linhas perderiam funcao, componente e eixo em silencio — justamente as
> pessoas que se queria corrigir. Consequencia: a planilha **nao limpa** esses
> campos, so os troca. Limpar e trabalho da tela de edicao, onde a acao e
> explicita e fica na auditoria.

### Lote parcial

Para carregar 20 pessoas sobre a base ja existente, monte o arquivo no mesmo
formato — as duas abas, os mesmos cabecalhos — contendo so as linhas
desejadas. **Mantenha a aba `PERFIL_DOCENTE`** mesmo num lote pequeno: sem ela
as escolas e os dados funcionais dessas linhas nao sao atualizados (embora,
pela regra acima, tambem nao sejam apagados).

## Manutencao pontual, sem reimportar

Corrigir um CPF digitado errado na origem nao exige mexer na planilha inteira.
Na tela **Cursistas**, cada linha tem:

- **Editar** — nome, CPF, dados funcionais e escolas, alem dos campos de contato.
  Fora do alcance da edicao, de proposito: senha, se o cadastro foi confirmado e
  as datas de acesso. Isso e registro do que aconteceu, nao dado cadastral.
- **Resetar senha** — devolve a conta ao primeiro acesso.
- **Excluir** — apaga o cadastro e libera o CPF. Quando a pessoa tem inscricoes,
  o sistema recusa a primeira tentativa e informa quantas seriam apagadas junto:
  elas caem por CASCATA e **nao voltam**. A trilha de auditoria permanece.

O botao **Novo cursista** cria um cadastro a mao, para quem ficou fora da base.
Ele nasce com `origem = manual` e o filtro **"Criado a mao"** separa esses
registros dos importados — e assim que se acha, no meio de treze mil, o que a
coordenacao criou para teste e quer desfazer.

Trocar o CPF troca o **login**: a pessoa passa a entrar com o numero novo, com a
mesma senha. A tela avisa antes de salvar, e a troca fica na auditoria como acao
propria (`cpf_alterado_admin`), com os dois valores mascarados.

### Coluna ATIVO

Quando a planilha tem a coluna `ATIVO`, ela decide quem pode entrar — inclusive
desativando quem estava ativo. Quando a coluna **nao** vem, o status de quem ja
existe e preservado, para uma base incompleta nao reativar em silencio contas que
a coordenacao desativou.

## Limites

| | |
|---|---|
| Registros por arquivo | 20.000 |
| Tamanho do arquivo | 8 MB (limite do nginx, nas duas camadas) |
| Importacoes por hora | 5 |

Referencia medida com 13.000 linhas nas duas abas: **1,6 MB** de arquivo, 0,4 s
de leitura e validacao no Node, 26 lotes gravados no banco.

## Linhas rejeitadas

O resultado da importacao traz o total e uma amostra de ate 50 linhas com o
motivo. Sao quatro:

- **CPF invalido** — digito verificador nao fecha;
- **NOME_COMPLETO vazio**;
- **CPF repetido** dentro do proprio arquivo;
- **USUARIO_ID repetido**, no arquivo ou ja pertencente a outro CPF no sistema —
  gravar sobrescreveria o cadastro de outra pessoa.

Uma linha rejeitada nao derruba a importacao: as demais entram normalmente.

### O zero a esquerda que o Excel come

O Excel trata CPF como numero e remove o zero inicial — `01234567890` vira
`1234567890`. E a causa mais comum de falha em base com CPF. O importador
completa com zeros a esquerda, mas conferir na origem evita associar o registro
ao CPF errado: formate a coluna como **Texto** antes de salvar.

## Primeiro acesso

Cada cursista importado entra com:

- **Login:** CPF (so digitos)
- **Senha:** o valor de `CURSISTA_SENHA_PADRAO`, igual para toda a base

> **O valor nao esta escrito neste repositorio, e nao deve ser.** Ele vive
> apenas em `backend/.env` no servidor, e a coordenacao o comunica aos cursistas
> por canal interno. Este repositorio e publico: qualquer valor escrito aqui
> esta publicado para sempre, inclusive no historico do git.

No primeiro acesso o sistema **obriga a definir uma senha pessoal** antes de
liberar qualquer tela, e em seguida **exige completar o cadastro** (data de
nascimento, telefone e e-mail) antes de liberar as inscricoes. Definida a senha
propria, a padrao deixa de funcionar naquela conta.

A senha padrao **nao e um segredo forte**: precisa chegar a ~13 mil pessoas,
entao circula em e-mail, grupo de mensagens e material impresso. O que protege a
conta e a troca obrigatoria na primeira entrada, nao o sigilo do valor -- mas
nao publica-la reduz quem a alcanca sem esforco nenhum.

> Consequencia pratica: enquanto um cursista nao fizer o primeiro acesso, quem
> souber o CPF dele e a senha padrao entra na conta. **Importe a base proxima a
> abertura das inscricoes** -- quanto menor essa janela, menor a exposicao.

Para trocar a senha padrao (por edicao, ou se ela vazar), altere
`CURSISTA_SENHA_PADRAO` em `backend/.env` no servidor e reinicie a API. Quem ja
definiu senha propria nao e afetado.
