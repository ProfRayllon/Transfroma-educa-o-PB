# Guias e tutoriais do site publico

Os dois botoes da secao **Guias Transforma**, na Home, apontam para arquivos
desta pasta. O nome tem de bater exatamente, letra por letra:

| Botao na Home | Arquivo esperado |
|---|---|
| Guia do Cursista | `GUIA_CURSISTA_TRANSFORMA_2026.pdf` |
| Tutorial de Acesso ao RIEH PB | `GUIA_RIEH_TRANSFORMA_v3.pdf` |

Tudo que esta em `frontend/public/` e copiado para a raiz do site pelo build,
entao `public/guias/X.pdf` fica em `https://transformaeducacaopb.com.br/guias/X.pdf`.

## Para trocar ou publicar um guia

1. Coloque o PDF aqui com o nome exato da tabela.
2. Commit e push na `main` -- o deploy automatico cuida do resto.

Se o nome do arquivo mudar, o `href` correspondente em
`frontend/src/pages/Home.jsx` precisa mudar junto.

## Por que o nome importa tanto

Ate agosto de 2026 esta pasta estava vazia e os botoes baixavam um arquivo
quebrado, sem nenhum erro aparente. A causa era a regra de pagina unica do
nginx: qualquer caminho inexistente caia no `index.html`, entao o PDF ausente
respondia **200 com o HTML do site**, e o navegador salvava esse HTML com o nome
do PDF. Quem baixava recebia um arquivo que nao abria.

A configuracao agora responde 404 para documento e midia que nao existam
(`frontend/deploy/nginx/default.conf`), entao arquivo faltando falha de forma
visivel. Mas nome errado continua sendo nome errado: o botao vai dar erro.

> Estes arquivos sao publicos por natureza -- ficam linkados na Home, abertos a
> qualquer visitante. Podem viver no repositorio sem problema. Nao coloque aqui
> nada com dado pessoal: este repositorio e publico.
