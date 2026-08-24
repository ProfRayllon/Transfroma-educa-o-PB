import { useMemo, useState } from 'react'
import {
  Users, School, GraduationCap, Eye, AlertTriangle, CheckCircle2,
  FileText, Award, Layers,
} from 'lucide-react'
import {
  Cartao, TituloDeBloco, CartaoKpi, BarrasComLinha, BarrasRotuladas,
  Rosca, LegendaDeRosca, ListaRanqueada, LinhasComIcone,
} from './graficos'

/**
 * Os blocos do dashboard.
 *
 * Duas faixas na mesma página. "Institucional" é prestação de contas -- alcance,
 * território, jornada, procura. "Operacional" é a régua da casa -- equipe,
 * produção, frequência. Continuam separadas por título porque respondem a
 * perguntas diferentes, mas moram na mesma tela: quem abre o dashboard quer o
 * retrato inteiro, e não metade dele por vez.
 *
 * Nenhum bloco busca dados. A página carrega tudo de uma vez para que os
 * números de blocos diferentes sejam do mesmo instante -- um total no topo que
 * não fecha com a soma das GREs logo abaixo destrói a confiança na tela.
 */

const ROTULOS_PERFIL = {
  administrador: 'Administrador', gerencia: 'Gerência', coordenador: 'Coordenador',
  supervisor: 'Supervisor', professor: 'Professor', tutor: 'Tutor', tecnico: 'Apoio técnico',
  gestao: 'Gestão de Pessoas', revisor: 'Revisor', supervisor_tutoria: 'Sup. de tutoria', ti: 'TI',
}
const ROTULOS_ESTAGIO = {
  producao: 'Em produção', supervisao: 'Com a supervisão',
  coordenacao: 'Com a coordenação', publicado: 'Publicado',
}

const br = (n) => Number(n || 0).toLocaleString('pt-BR')
const pct = (parte, todo) => (todo ? String(Math.round((parte / todo) * 1000) / 10).replace('.', ',') : '0')
const diaCurto = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

function TituloDaFaixa({ children, descricao }) {
  return (
    <div className="flex items-baseline gap-3 flex-wrap">
      <h2 className="text-[17px] font-bold" style={{ color: 'var(--p-texto)' }}>{children}</h2>
      {descricao && (
        <span className="text-[13px]" style={{ color: 'var(--p-texto3)' }}>{descricao}</span>
      )}
    </div>
  )
}

function Legenda({ itens }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
      {itens.map((i) => (
        <span key={i.rotulo} className="flex items-center gap-2 text-[12px]"
          style={{ color: 'var(--p-texto2)' }}>
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: i.cor }} />
          {i.rotulo}
        </span>
      ))}
    </div>
  )
}

/**
 * Variação percentual entre a primeira e a segunda metade da janela.
 *
 * O sistema não guarda fotografias de meses fechados, então "vs. mês anterior"
 * não existe como dado. Comparar as duas metades do período escolhido é a
 * variação que a base REALMENTE sustenta -- e o rótulo do cartão diz isso, em
 * vez de carimbar uma comparação que não foi feita.
 */
function variacaoDaSerie(serie, chave) {
  if (!serie?.length) return null
  const meio = Math.floor(serie.length / 2)
  const antes = serie.slice(0, meio).reduce((s, p) => s + p[chave], 0)
  const depois = serie.slice(meio).reduce((s, p) => s + p[chave], 0)
  if (!antes) return null
  return ((depois - antes) / antes) * 100
}

/* ══════════════════ Institucional ══════════════════ */

export function BlocoInstitucional({ dados, serie, dias, cursoAtivo, aoFiltrarCurso }) {
  const [ordemGre, setOrdemGre] = useState('cursistas')

  const t = dados.institucional.totais
  const funil = dados.institucional.funil
  const perfil = dados.institucional.perfil
  const gres = dados.institucional.porGre
  const escolas = dados.institucional.escolas
  const cursos = dados.institucional.inscricoes.filter((c) => c.publicado)
  const porHora = dados.institucional.porHora

  const inscricoesNoPeriodo = serie.reduce((s, p) => s + p.inscricao, 0)
  // O funil vem sempre da base inteira, então o primeiro degrau dele é o
  // denominador honesto para "que fatia da rede este curso alcançou".
  const totalDaBase = funil[0].total

  const gresOrdenadas = useMemo(() => [...gres].sort((a, b) =>
    ordemGre === 'cursistas' ? b.cursistas - a.cursistas : b.adesao - a.adesao), [gres, ordemGre])

  const base = funil[0].total
  const inscritos = funil[funil.length - 1].total
  const fatiasJornada = [
    { rotulo: 'Inscritos em curso', valor: inscritos, cor: 'var(--p-roscaA)' },
    { rotulo: 'Confirmaram, sem curso', valor: Math.max(0, funil[3].total - inscritos), cor: 'var(--p-roscaB)' },
    { rotulo: 'Ainda não confirmaram', valor: base - funil[3].total, cor: 'var(--p-trilhoForte)' },
  ]

  const totalGenero = perfil.genero.reduce((s, g) => s + g.total, 0)
  const feminino = perfil.genero.find((g) => /^f/i.test(g.chave))
  const coresGenero = ['var(--p-roscaB)', 'var(--p-roscaA)', 'var(--p-barra)']
  const fatiasGenero = perfil.genero.map((g, i) => ({
    rotulo: g.chave, valor: g.total, cor: coresGenero[i % coresGenero.length],
  }))

  const pico = porHora.reduce((a, b) => (b.total > a.total ? b : a), porHora[0])

  return (
    <section className="space-y-4">
      <TituloDaFaixa descricao="Alcance do programa na rede estadual">Institucional</TituloDaFaixa>

      {/* ─── Indicadores ─── */}
      {/* Cada cartão descreve, na linha de baixo, o PRÓPRIO número de cima.
          Antes o primeiro mostrava a base cadastrada e embaixo a variação dos
          acessos -- duas grandezas diferentes no mesmo cartão, e a leitura
          natural era tomar a variação como sendo da base. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CartaoKpi
          icone={Users}
          rotulo={cursoAtivo ? 'Inscritos neste curso' : 'Profissionais na base'}
          valor={t.cursistas}
          gradiente="azul"
          comparativo={cursoAtivo
            ? `${pct(t.cursistas, totalDaBase)}% da base oficial`
            : `${br(t.confirmados)} confirmaram o cadastro · ${pct(t.confirmados, t.cursistas)}%`}
        />

        <CartaoKpi
          icone={School}
          rotulo="Escolas alcançadas"
          valor={t.escolas}
          gradiente="ciano"
          comparativo={`${String(t.escolasPct).replace('.', ',')}% das ${br(t.escolasTotal)} escolas da base · ${t.gres} GREs`}
        />

        <CartaoKpi
          icone={GraduationCap}
          rotulo={cursoAtivo ? 'Inscrições no curso' : 'Inscrições em cursos'}
          valor={t.inscricoes}
          gradiente="roxo"
          serie={serie.map((x) => x.inscricao)}
          variacao={variacaoDaSerie(serie, 'inscricao')}
          comparativo={`${br(inscricoesNoPeriodo)} nos últimos ${dias} dias`}
        />

        <CartaoKpi
          icone={Eye}
          rotulo={`Acessaram em ${dias} dias`}
          valor={t.acessaramNaJanela}
          gradiente="rosa"
          serie={serie.map((x) => x.login + x.primeiroAcesso)}
          /* O denominador é sempre o MESMO conjunto que o numerador -- a base
             quando não há filtro, os inscritos quando há. Antes era "quem tem
             senha", e o percentual passava de 100%: quem entra com o CPF no
             primeiro acesso e nunca define senha própria conta no acesso e não
             contava no denominador. */
          comparativo={cursoAtivo
            ? `${pct(t.acessaramNaJanela, t.cursistas)}% dos inscritos no curso`
            : `${pct(t.acessaramNaJanela, t.cursistas)}% da base oficial`}
        />
      </div>

      {/* ─── Movimento, jornada e procura ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr_1fr] gap-4 items-stretch">
        <Cartao className="flex flex-col">
          <TituloDeBloco
            acao={<span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>últimos {dias} dias</span>}
          >
            {cursoAtivo ? 'Inscrições por dia' : 'Movimento diário'}
          </TituloDeBloco>

          {/* Com curso filtrado a linha de acessos desaparece: um login não
              pertence a curso nenhum, e mantê-la aqui sugeriria que aqueles
              acessos são daquele curso. Sobram as inscrições, que a tabela de
              inscrições sabe recortar por curso. */}
          <BarrasComLinha
            dados={serie}
            chaveX="dia"
            formatarX={diaCurto}
            barra={cursoAtivo
              ? { chave: 'inscricao', rotulo: 'Inscrições no curso' }
              : { chave: 'login', rotulo: 'Acessos' }}
            linha={cursoAtivo ? null : { chave: 'inscricao', rotulo: 'Inscrições' }}
            altura={268}
          />

          {/* A legenda diz de qual lado cada série lê a escala: são dois eixos,
              e sem isso o cruzamento das duas viraria uma conclusão inventada
              pelo desenho, e não pelo dado. */}
          <div className="mt-3">
            <Legenda itens={cursoAtivo
              ? [{ rotulo: `Inscrições em ${cursoAtivo.curso}`, cor: 'var(--p-barra)' }]
              : [
                { rotulo: 'Acessos (escala à esquerda)', cor: 'var(--p-barra)' },
                { rotulo: 'Inscrições (escala à direita)', cor: 'var(--p-linha)' },
              ]} />
          </div>
        </Cartao>

        <Cartao className="flex flex-col items-center justify-center gap-4">
          <TituloDeBloco
            acao={cursoAtivo
              ? <span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>rede inteira</span>
              : null}
          >
            Jornada do cadastro
          </TituloDeBloco>
          <Rosca
            tamanho={170} espessura={22} total={base}
            centroValor={`${Math.round((inscritos / base) * 100)}%`}
            centroRotulo="chegam ao curso"
            fatias={fatiasJornada}
          />
          <div className="w-full">
            <LegendaDeRosca fatias={fatiasJornada} total={base} />
          </div>
        </Cartao>

        <Cartao className="flex flex-col">
          <TituloDeBloco
            acao={
              <span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>
                {cursoAtivo ? 'clique para limpar' : 'clique para filtrar'}
              </span>
            }
          >
            Cursos mais procurados
          </TituloDeBloco>
          <ListaRanqueada
            selecionado={cursoAtivo?.id}
            aoClicar={(item) => aoFiltrarCurso(item.id)}
            itens={cursos.slice(0, 5).map((c) => ({
              id: c.id,
              rotulo: c.curso,
              valor: c.inscritos,
              nota: c.aberto ? 'inscrições abertas' : 'inscrições encerradas',
            }))}
          />
        </Cartao>
      </div>

      {/* ─── Território ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4 items-stretch">
        <Cartao className="flex flex-col">
          <TituloDeBloco
            acao={
              /* Reordenar responde a pergunta que sempre aparece: "a maior
                 regional é também a que mais aderiu?" */
              <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--p-trilho)' }}>
                {[['cursistas', 'Volume'], ['adesao', 'Adesão']].map(([chave, rotulo]) => (
                  <button
                    key={chave}
                    onClick={() => setOrdemGre(chave)}
                    className="px-3 py-1 rounded-md text-[12px] font-medium transition-colors"
                    style={{
                      background: ordemGre === chave ? 'var(--p-balao)' : 'transparent',
                      color: ordemGre === chave ? 'var(--p-texto)' : 'var(--p-texto3)',
                      boxShadow: ordemGre === chave ? '0 1px 3px rgba(15,23,42,0.10)' : 'none',
                    }}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            }
          >
            Distribuição por GRE
          </TituloDeBloco>

          <div style={{ height: 236 }}>
            <BarrasRotuladas
              dados={gresOrdenadas.map((g) => ({
                rotulo: g.gre.replace(' GRE', 'ª'),
                titulo: g.gre,
                valor: ordemGre === 'cursistas' ? g.cursistas : g.adesao,
                nota: `${g.escolas} escolas`,
              }))}
              formatarValor={(v) => (ordemGre === 'adesao' ? `${v}%` : br(v))}
            />
          </div>
        </Cartao>

        <Cartao className="flex flex-col">
          <TituloDeBloco
            acao={<span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>por profissionais</span>}
          >
            Escolas com maior alcance
          </TituloDeBloco>
          <LinhasComIcone
            linhas={escolas.slice(0, 6).map((e, i) => ({
              icone: i === 0 ? Award : School,
              cor: i === 0 ? 'var(--p-linha)' : 'var(--p-roscaA)',
              titulo: e.escola,
              detalhe: e.gre,
              valor: e.cursistas,
            }))}
          />
        </Cartao>
      </div>

      {/* ─── Perfil da rede ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
        <Cartao className="flex flex-col">
          <TituloDeBloco>Eixos tecnológicos</TituloDeBloco>
          <ListaRanqueada
            mostrarPosicao={false}
            itens={perfil.eixos.slice(0, 6).map((e) => ({ rotulo: e.chave, valor: e.total }))}
          />
        </Cartao>

        <Cartao className="flex flex-col">
          <TituloDeBloco>Faixa etária</TituloDeBloco>
          <div style={{ height: 176 }}>
            <BarrasRotuladas dados={perfil.faixaEtaria.map((f) => ({ rotulo: f.chave, valor: f.total }))} />
          </div>
        </Cartao>

        <Cartao className="flex flex-col items-center justify-center gap-3">
          <TituloDeBloco>Composição</TituloDeBloco>
          <Rosca
            tamanho={148} espessura={20} total={totalGenero}
            centroValor={feminino ? `${Math.round((feminino.total / totalGenero) * 100)}%` : '—'}
            centroRotulo="mulheres"
            fatias={fatiasGenero}
          />
          <div className="w-full">
            <LegendaDeRosca fatias={fatiasGenero} total={totalGenero} />
          </div>
        </Cartao>

        <Cartao className="flex flex-col">
          <TituloDeBloco
            acao={
              <span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>
                pico às <b style={{ color: 'var(--p-linha)' }}>{pico.hora}h</b>
              </span>
            }
          >
            Acessos por hora
          </TituloDeBloco>
          <div style={{ height: 176 }}>
            <BarrasRotuladas
              mostrarValor={false}
              dados={porHora.map((h) => ({
                // 24 rótulos lado a lado se sobrepõem: um a cada três mantém a
                // referência de horário sem virar borrão.
                rotulo: h.hora % 3 === 0 ? `${h.hora}h` : '',
                titulo: `${h.hora}h`,
                valor: h.total,
              }))}
            />
          </div>
        </Cartao>
      </div>
    </section>
  )
}

/* ══════════════════ Operacional ══════════════════ */

export function BlocoOperacional({ dados, rotuloMes }) {
  const equipe = dados.operacional.equipe
  const prod = dados.operacional.producao
  const f = dados.operacional.frequencia

  const totalEquipe = equipe.reduce((s, e) => s + e.total, 0)
  const totalModulos = prod.modulosPorEstagio.reduce((s, e) => s + e.total, 0)
  const publicados = prod.modulosPorEstagio.find((e) => e.estagio === 'publicado')?.total || 0

  const ordemEstagio = ['producao', 'supervisao', 'coordenacao', 'publicado']
  const coresEstagio = ['var(--p-roscaB)', 'var(--p-barra)', 'var(--p-barraTopo)', 'var(--p-roscaA)']
  const fatiasEstagio = ordemEstagio.map((chave, i) => ({
    rotulo: ROTULOS_ESTAGIO[chave],
    valor: prod.modulosPorEstagio.find((x) => x.estagio === chave)?.total || 0,
    cor: coresEstagio[i],
  })).filter((x) => x.valor > 0)

  const fatiasFrequencia = [
    { rotulo: 'Cumpridas', valor: f.cumpridas, cor: 'var(--p-roscaA)' },
    { rotulo: 'Aguardando avaliação', valor: f.aguardando, cor: 'var(--p-roscaB)' },
    { rotulo: 'Ainda a fazer', valor: f.aFazer, cor: 'var(--p-barra)' },
    { rotulo: 'Não cumpridas', valor: f.naoCumpridas, cor: 'var(--p-linha)' },
  ].filter((x) => x.valor > 0)

  return (
    <section className="space-y-4 pt-2">
      <TituloDaFaixa descricao={`Equipe, produção e frequência · ${rotuloMes}`}>Operacional</TituloDaFaixa>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CartaoKpi icone={Users} rotulo="Pessoas na equipe" valor={totalEquipe} gradiente="azul"
          comparativo={`${equipe.length} perfis diferentes`} />
        <CartaoKpi icone={Layers} rotulo="Módulos de curso" valor={totalModulos} gradiente="roxo"
          comparativo={`${publicados} já publicados`} />
        <CartaoKpi icone={FileText} rotulo="Materiais no ar" valor={prod.materiais.publicados} gradiente="ciano"
          comparativo={`de ${br(prod.materiais.total)} produzidos`} />
        <CartaoKpi
          icone={prod.modulosAtrasados > 0 ? AlertTriangle : CheckCircle2}
          rotulo={prod.modulosAtrasados > 0 ? 'Módulos fora do prazo' : 'Módulos no prazo'}
          valor={prod.modulosAtrasados}
          gradiente="rosa"
          comparativo={prod.modulosAtrasados > 0 ? 'passaram do prazo sem publicar' : 'nenhum atraso hoje'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
        <Cartao className="flex flex-col">
          <TituloDeBloco
            acao={<span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>{totalEquipe} pessoas</span>}
          >
            Composição da equipe
          </TituloDeBloco>
          <ListaRanqueada
            mostrarPosicao={false}
            itens={equipe.map((e) => ({
              rotulo: ROTULOS_PERFIL[e.role] || e.role,
              valor: e.total,
              nota: e.ativos < e.total ? `${e.total - e.ativos} inativo(s)` : null,
            }))}
          />
        </Cartao>

        <Cartao className="flex flex-col items-center justify-center gap-4">
          <TituloDeBloco>Onde estão os módulos</TituloDeBloco>
          <Rosca
            tamanho={168} espessura={22} total={totalModulos}
            centroValor={br(totalModulos)} centroRotulo="módulos"
            fatias={fatiasEstagio}
          />
          <div className="w-full">
            <LegendaDeRosca fatias={fatiasEstagio} total={totalModulos} />
          </div>
        </Cartao>

        <Cartao className="flex flex-col">
          <TituloDeBloco
            acao={<span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>{rotuloMes}</span>}
          >
            Frequência da equipe
          </TituloDeBloco>

          {f.total === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-8">
              <p className="text-sm font-semibold" style={{ color: 'var(--p-texto2)' }}>
                Nada atribuído em {rotuloMes}
              </p>
              <p className="text-[13px]" style={{ color: 'var(--p-texto3)' }}>
                O cumprimento aparece assim que a coordenação atribuir as atividades.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-5">
                <Rosca
                  tamanho={132} espessura={18} total={f.total}
                  centroValor={`${f.frequencia}%`} centroRotulo="cumprido"
                  fatias={fatiasFrequencia}
                />
                <div className="flex-1 min-w-0">
                  <LegendaDeRosca fatias={fatiasFrequencia} total={f.total} />
                </div>
              </div>

              <div className="grid gap-2.5 mt-4 pt-4 border-t" style={{ borderColor: 'var(--p-cartaoBorda)' }}>
                {f.porPerfil.slice(0, 4).map((p, i) => (
                  <div key={p.role}>
                    <div className="flex items-baseline justify-between text-[12px] mb-1">
                      <span style={{ color: 'var(--p-texto2)' }}>{ROTULOS_PERFIL[p.role] || p.role}</span>
                      <span className="tabular-nums" style={{ color: 'var(--p-texto3)' }}>
                        {p.cumpridas}/{p.total} · <b style={{ color: 'var(--p-texto)' }}>{p.frequencia}%</b>
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--p-trilho)' }}>
                      <div
                        className="h-full rounded-full animate-barra origin-left"
                        style={{
                          width: `${p.frequencia}%`,
                          background: p.frequencia >= 75
                            ? 'linear-gradient(90deg, var(--p-barra), var(--p-roscaA))'
                            : p.frequencia >= 50
                              ? 'linear-gradient(90deg, var(--p-roscaB), var(--p-barra))'
                              : 'linear-gradient(90deg, var(--p-linha), var(--p-negativo))',
                          animationDelay: `${i * 60}ms`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Cartao>
      </div>
    </section>
  )
}
