import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'

/**
 * Os gráficos do painel institucional.
 *
 * SVG escrito à mão, sem biblioteca. Num painel projetado, espessura de traço,
 * tamanho de rótulo e ritmo de animação são a diferença entre legível e
 * ilegível a três metros -- e são exatamente as coisas que uma lib de gráfico
 * decide por você, com o visual dela e não o da marca.
 *
 * ─── Tema ───
 * Tudo pinta por variável CSS (`--p-*`), nunca por cor literal. É o que faz o
 * modo claro ser uma troca de paleta em um lugar só, em vez de uma reescrita:
 * quem define os valores é o TEMA abaixo, e o painel os aplica na raiz.
 */

/**
 * As cores dos gráficos, nos dois temas.
 *
 * Só o que é gráfico mora aqui. Fundo de página e caixa de card vêm da classe
 * `.card` do próprio sistema, para o dashboard acompanhar o claro/escuro do
 * resto sem manter uma segunda definição de superfície que uma hora divergiria.
 */
export const TEMA = {
  claro: {
    texto: '#0F172A',
    texto2: '#475569',
    texto3: '#94A3B8',
    grade: 'rgba(15,23,42,0.07)',
    trilho: 'rgba(15,23,42,0.06)',
    trilhoForte: 'rgba(15,23,42,0.16)',
    cartaoBorda: 'rgba(15,23,42,0.08)',
    balao: '#FFFFFF',
    pontoBorda: '#FFFFFF',
    // As duas séries do gráfico principal: ΔE 14.7 para deutan e 28.1 para
    // visão normal. Trocar uma delas pede validar de novo -- azul e roxo, por
    // exemplo, colidem em ΔE 1.3 e ficam iguais para quem tem daltonismo.
    barra: '#3B82F6',
    barraTopo: '#60A5FA',
    linha: '#DB2777',
    roscaA: '#0891B2',
    roscaB: '#7C3AED',
    negativo: '#DC2626',
  },
  escuro: {
    texto: '#F1EEFB',
    texto2: 'rgba(241,238,251,0.60)',
    texto3: 'rgba(241,238,251,0.36)',
    grade: 'rgba(255,255,255,0.08)',
    trilho: 'rgba(255,255,255,0.09)',
    trilhoForte: 'rgba(255,255,255,0.20)',
    cartaoBorda: 'rgba(255,255,255,0.10)',
    balao: '#241C3D',
    pontoBorda: '#241C3D',
    barra: '#4EA3F7',
    barraTopo: '#7DC0FF',
    linha: '#EC4899',
    roscaA: '#22D3EE',
    roscaB: '#A78BFA',
    negativo: '#FB7185',
  },
}

export const variaveisDoTema = (escuro) => {
  const t = escuro ? TEMA.escuro : TEMA.claro
  return Object.fromEntries(Object.entries(t).map(([chave, valor]) => [`--p-${chave}`, valor]))
}

/** Os quatro gradientes dos cartões do topo. */
export const GRADIENTES = {
  azul: ['#1D4ED8', '#3B82F6'],
  ciano: ['#0E7490', '#06B6D4'],
  roxo: ['#6D28D9', '#9333EA'],
  rosa: ['#BE185D', '#EC4899'],
}

const br = (n) => Number(n || 0).toLocaleString('pt-BR')

/* ═══ Cartão ═══ */

export function Cartao({ children, className = '' }) {
  // `card` e do sistema: e o que faz o dashboard herdar o claro/escuro do resto
  // em vez de manter a propria definicao de superficie.
  return <div className={`card ${className}`}>{children}</div>
}

export function TituloDeBloco({ children, acao }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <p className="text-[14px] font-semibold" style={{ color: 'var(--p-texto)' }}>{children}</p>
      {acao}
    </div>
  )
}

/* ═══ Número que conta ═══ */

/**
 * Conta de zero até o valor na entrada da cena.
 *
 * `ease-out` cúbico: o número desacelera no fim, o que dá a quem olha de longe
 * a chance de ler o valor final em vez de vê-lo parar de repente.
 */
export function Contador({ valor, duracao = 1000, sufixo = '', decimais = 0 }) {
  const [atual, setAtual] = useState(0)
  const quadro = useRef(null)

  useEffect(() => {
    const alvo = Number(valor) || 0
    const inicio = performance.now()
    cancelAnimationFrame(quadro.current)

    const passo = (agora) => {
      const t = Math.min(1, (agora - inicio) / duracao)
      setAtual(alvo * (1 - Math.pow(1 - t, 3)))
      if (t < 1) quadro.current = requestAnimationFrame(passo)
    }
    quadro.current = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro.current)
  }, [valor, duracao])

  return (
    <span className="tabular-nums">
      {decimais
        ? atual.toLocaleString('pt-BR', { minimumFractionDigits: decimais, maximumFractionDigits: decimais })
        : br(Math.round(atual))}
      {sufixo}
    </span>
  )
}

/* ═══ Sparkline ═══ */

/**
 * O fiozinho dentro do cartão do topo.
 *
 * Sem eixo, sem rótulo, de propósito: ele responde "está subindo ou descendo",
 * e não "quanto". Um eixo aqui pediria espaço que o cartão não tem e competiria
 * com o número grande, que é o que a pessoa veio ler.
 */
export function Sparkline({ pontos, cor = 'rgba(255,255,255,0.9)', largura = 150, altura = 42 }) {
  const d = useMemo(() => {
    if (!pontos?.length) return ''
    const min = Math.min(...pontos)
    const max = Math.max(...pontos)
    const faixa = max - min || 1
    const passo = pontos.length > 1 ? largura / (pontos.length - 1) : 0

    // Curva suave por Catmull-Rom simplificado: o traço reto revela o ruído do
    // dado diário, e a leitura que interessa aqui é a tendência.
    const xy = pontos.map((v, i) => [i * passo, altura - ((v - min) / faixa) * (altura - 6) - 3])
    return xy.reduce((acc, [x, y], i) => {
      if (!i) return `M${x.toFixed(1)},${y.toFixed(1)}`
      const [px, py] = xy[i - 1]
      const cx = (px + x) / 2
      return `${acc} C${cx.toFixed(1)},${py.toFixed(1)} ${cx.toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`
    }, '')
  }, [pontos, largura, altura])

  if (!d) return null

  return (
    <svg width={largura} height={altura} className="overflow-visible shrink-0">
      <path d={d} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="animate-traco" />
    </svg>
  )
}

/* ═══ Cartão de indicador ═══ */

export function CartaoKpi({ icone: Icone, rotulo, valor, sufixo, variacao, comparativo, gradiente = 'azul', serie, duracao }) {
  const [de, para] = GRADIENTES[gradiente] || GRADIENTES.azul
  const subiu = (variacao ?? 0) >= 0

  return (
    <div
      className="relative rounded-2xl p-5 overflow-hidden animate-cena"
      style={{ background: `linear-gradient(135deg, ${de} 0%, ${para} 100%)` }}
    >
      {/* Brilho no canto: dá volume ao bloco chapado sem depender de sombra,
          que num fundo escuro praticamente não aparece. */}
      <div className="absolute -top-16 -right-10 w-44 h-44 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }} />

      <div className="relative flex items-start gap-3">
        <span className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Icone size={20} className="text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-white/85 leading-snug">{rotulo}</p>
          <div className="text-[34px] font-bold text-white leading-none mt-1.5">
            <Contador valor={valor} sufixo={sufixo} duracao={duracao} />
          </div>
        </div>
      </div>

      <div className="relative flex items-end justify-between gap-3 mt-4">
        <div className="min-w-0">
          {variacao != null && (
            <p className="flex items-center gap-1 text-[13px] font-semibold"
              style={{ color: subiu ? '#6EE7B7' : '#FDA4AF' }}>
              {subiu ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
              {Math.abs(variacao).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
            </p>
          )}
          {comparativo && <p className="text-[12px] text-white/60 mt-0.5">{comparativo}</p>}
        </div>
        {serie && <Sparkline pontos={serie} cor="rgba(255,255,255,0.85)" largura={130} altura={38} />}
      </div>
    </div>
  )
}

/* ═══ Barras + linha, com cursor e balão ═══ */

/**
 * Volume em barras e uma segunda série em linha, sobrepostas.
 *
 * São DOIS eixos y: barras à esquerda, linha à direita. Vale registrar por que,
 * porque é uma escolha e não um descuido -- num eixo só, a linha de inscrições
 * (dezenas por dia) ficaria colada no zero contra as barras de acesso
 * (milhares), e o gráfico não mostraria nada dela.
 *
 * O preço é que o ponto onde a linha "cruza" as barras não significa nada: ele
 * depende das duas escalas, não do dado. A defesa é deixar isso à vista -- cada
 * eixo é rotulado NA COR da sua série, e a legenda diz qual lado é de quem.
 */
export function BarrasComLinha({
  dados, chaveX, barra, linha, altura = 300, formatarX,
}) {
  const [ativo, setAtivo] = useState(null)
  // Sem segunda serie, o eixo da direita nao existe e a area toda volta para as
  // barras -- e o caso do filtro por curso, onde login nao tem recorte possivel.
  const temLinha = Boolean(linha)
  const L = 54, R = temLinha ? 56 : 14, T = 16, B = 28
  const W = 1000
  const H = altura
  const alturaUtil = H - T - B

  const maxBarra = Math.max(1, ...dados.map((d) => d[barra.chave]))
  const maxLinha = temLinha ? Math.max(1, ...dados.map((d) => d[linha.chave])) : 1

  const passo = (W - L - R) / dados.length
  const cx = (i) => L + passo * (i + 0.5)
  const yB = (v) => T + alturaUtil * (1 - v / maxBarra)
  const yL = (v) => T + alturaUtil * (1 - v / maxLinha)
  const larguraBarra = Math.max(4, Math.min(24, passo * 0.5))

  const caminho = temLinha
    ? dados.map((d, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${yL(d[linha.chave]).toFixed(1)}`).join(' ')
    : ''

  const compacto = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.0', '').replace('.', ',')}K` : String(v))
  const niveis = [0, 0.25, 0.5, 0.75, 1]
  const salto = Math.max(1, Math.ceil(dados.length / 8))
  const marcas = dados.map((d, i) => ({ d, i })).filter(({ i }) => i % salto === 0 || i === dados.length - 1)

  const aoMover = (evento) => {
    const caixa = evento.currentTarget.getBoundingClientRect()
    const x = ((evento.clientX - caixa.left) / caixa.width) * W
    const i = Math.round((x - L) / passo - 0.5)
    setAtivo(i >= 0 && i < dados.length ? i : null)
  }

  return (
    <div className="relative w-full" style={{ height: altura }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none"
        onMouseMove={aoMover} onMouseLeave={() => setAtivo(null)}>
        <defs>
          <linearGradient id="grad-barra" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--p-barraTopo)" />
            <stop offset="100%" stopColor="var(--p-barra)" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="grad-area-linha" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--p-linha)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--p-linha)" stopOpacity="0" />
          </linearGradient>
          <filter id="brilho-linha" x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {niveis.map((f) => (
          <line key={`g${f}`} x1={L} y1={T + alturaUtil * (1 - f)} x2={W - R} y2={T + alturaUtil * (1 - f)}
            stroke="var(--p-grade)" strokeWidth="1" />
        ))}

        {/* Eixo das barras, na cor das barras */}
        {niveis.map((f) => (
          <text key={`e${f}`} x={L - 10} y={T + alturaUtil * (1 - f) + 4} textAnchor="end"
            style={{ fontSize: 12, fill: 'var(--p-barra)' }}>
            {compacto(Math.round(maxBarra * f))}
          </text>
        ))}

        {/* Eixo da linha, na cor da linha */}
        {temLinha && niveis.map((f) => (
          <text key={`d${f}`} x={W - R + 10} y={T + alturaUtil * (1 - f) + 4}
            style={{ fontSize: 12, fill: 'var(--p-linha)' }}>
            {compacto(Math.round(maxLinha * f))}
          </text>
        ))}

        {dados.map((d, i) => (
          <rect
            key={`r${i}`}
            x={cx(i) - larguraBarra / 2}
            y={yB(d[barra.chave])}
            width={larguraBarra}
            height={Math.max(1, T + alturaUtil - yB(d[barra.chave]))}
            rx="4"
            fill="url(#grad-barra)"
            opacity={ativo == null || ativo === i ? 1 : 0.45}
            className="animate-coluna"
            style={{ transformOrigin: `${cx(i)}px ${T + alturaUtil}px`, animationDelay: `${i * 14}ms` }}
          />
        ))}

        {temLinha && (
          <>
            <path d={`${caminho} L${cx(dados.length - 1)},${T + alturaUtil} L${cx(0)},${T + alturaUtil} Z`}
              fill="url(#grad-area-linha)" />
            <path d={caminho} fill="none" stroke="var(--p-linha)" strokeWidth="2.5"
              strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
              filter="url(#brilho-linha)" className="animate-traco" />
            {dados.map((d, i) => (
              <circle key={`p${i}`} cx={cx(i)} cy={yL(d[linha.chave])} r={ativo === i ? 5 : 3}
                fill="var(--p-linha)" stroke="var(--p-pontoBorda)" strokeWidth="1.5" />
            ))}
          </>
        )}

        {ativo != null && (
          <line x1={cx(ativo)} y1={T} x2={cx(ativo)} y2={T + alturaUtil}
            stroke="var(--p-texto3)" strokeWidth="1" strokeDasharray="3 3" />
        )}

        {marcas.map(({ d, i }) => (
          <text key={`x${i}`} x={cx(i)} y={H - 8} textAnchor="middle"
            style={{ fontSize: 12, fill: 'var(--p-texto3)' }}>
            {formatarX ? formatarX(d[chaveX]) : d[chaveX]}
          </text>
        ))}
      </svg>

      {ativo != null && (
        <div
          className="absolute pointer-events-none rounded-xl px-3 py-2 text-[12px] whitespace-nowrap z-10"
          style={{
            left: `${(cx(ativo) / W) * 100}%`,
            top: 6,
            transform: `translateX(${ativo > dados.length * 0.68 ? '-105%' : '12px'})`,
            background: 'var(--p-balao)',
            border: '1px solid var(--p-cartaoBorda)',
            boxShadow: '0 10px 30px rgba(15,23,42,0.18)',
          }}
        >
          <p className="font-semibold mb-1.5" style={{ color: 'var(--p-texto)' }}>
            {formatarX ? formatarX(dados[ativo][chaveX]) : dados[ativo][chaveX]}
          </p>
          {[[barra, 'var(--p-barra)'], temLinha && [linha, 'var(--p-linha)']].filter(Boolean).map(([serie, cor]) => (
            <p key={serie.chave} className="flex items-center gap-2" style={{ color: 'var(--p-texto2)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: cor }} />
              {serie.rotulo}
              <b className="ml-3 tabular-nums" style={{ color: 'var(--p-texto)' }}>
                {br(dados[ativo][serie.chave])}
              </b>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══ Barras verticais com rótulo em cima ═══ */

export function BarrasRotuladas({ dados, altura = '100%', formatarValor, mostrarValor = true }) {
  const maximo = Math.max(1, ...dados.map((d) => d.valor))

  return (
    <div className="flex items-end gap-2 w-full" style={{ height: altura }}>
      {dados.map((d, i) => {
        const alturaPct = (d.valor / maximo) * 100
        return (
          <div key={d.rotulo} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1.5 group">
            {/* Com muitas barras o rotulo em cima de cada uma vira uma tarja
                ilegivel: quem chama passa mostrarValor={false} e o valor fica
                so no balao ao passar o mouse. */}
            {mostrarValor && (
              <span className="text-[12px] font-semibold tabular-nums shrink-0"
                style={{ color: 'var(--p-texto2)' }}>
                {formatarValor ? formatarValor(d.valor) : br(d.valor)}
              </span>
            )}
            <div
              className="w-full rounded-t-md animate-coluna origin-bottom transition-opacity group-hover:opacity-80"
              style={{
                height: `${Math.max(2, alturaPct)}%`,
                background: 'linear-gradient(180deg, var(--p-roscaA) 0%, var(--p-barra) 100%)',
                animationDelay: `${i * 35}ms`,
              }}
              title={`${d.titulo || d.rotulo}: ${br(d.valor)}${d.nota ? ` · ${d.nota}` : ''}`}
            />
            <span className="text-[11px] shrink-0 truncate max-w-full"
              style={{ color: 'var(--p-texto3)' }}>
              {d.rotulo}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ═══ Rosca ═══ */

export function Rosca({ fatias, total, centroValor, centroRotulo, tamanho = 190, espessura = 26 }) {
  const raio = (tamanho - espessura) / 2
  const volta = 2 * Math.PI * raio
  const soma = total ?? fatias.reduce((s, f) => s + f.valor, 0)

  let acumulado = 0
  const arcos = fatias.map((f) => {
    const fracao = soma ? f.valor / soma : 0
    const arco = { ...f, fracao, offset: acumulado }
    acumulado += fracao
    return arco
  })

  return (
    <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} className="-rotate-90">
        <circle cx={tamanho / 2} cy={tamanho / 2} r={raio} fill="none"
          stroke="var(--p-trilho)" strokeWidth={espessura} />
        {arcos.map((a) => (
          <circle
            key={a.rotulo}
            cx={tamanho / 2} cy={tamanho / 2} r={raio} fill="none"
            stroke={a.cor} strokeWidth={espessura} strokeLinecap="butt"
            strokeDasharray={`${(volta * a.fracao).toFixed(2)} ${volta}`}
            strokeDashoffset={-(volta * a.offset)}
            style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.22,1,0.36,1)' }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none text-center px-4">
        <span className="text-[38px] font-bold" style={{ color: 'var(--p-texto)' }}>{centroValor}</span>
        {centroRotulo && (
          <span className="text-[12px] mt-1.5" style={{ color: 'var(--p-texto2)' }}>{centroRotulo}</span>
        )}
      </div>
    </div>
  )
}

export function LegendaDeRosca({ fatias, total }) {
  const soma = total ?? fatias.reduce((s, f) => s + f.valor, 0)
  return (
    <div className="grid gap-2.5">
      {fatias.map((f) => (
        <div key={f.rotulo} className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.cor }} />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] leading-tight" style={{ color: 'var(--p-texto)' }}>{f.rotulo}</span>
            <span className="block text-[12px] tabular-nums" style={{ color: 'var(--p-texto2)' }}>
              {br(f.valor)} ({soma ? ((f.valor / soma) * 100).toFixed(1).replace('.', ',') : 0}%)
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

/* ═══ Lista ranqueada ═══ */

export function ListaRanqueada({ itens, sufixo = '', mostrarPosicao = true, aoClicar, selecionado }) {
  const maximo = Math.max(1, ...itens.map((i) => i.valor))

  return (
    <div className="grid gap-2.5">
      {itens.map((item, i) => (
        /* Clicar filtra o dashboard inteiro. Vira <button> so quando ha o que
           fazer: um item clicavel que nao faz nada e pior do que texto. */
        <div
          key={item.rotulo}
          onClick={aoClicar ? () => aoClicar(item) : undefined}
          role={aoClicar ? 'button' : undefined}
          tabIndex={aoClicar ? 0 : undefined}
          onKeyDown={aoClicar ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aoClicar(item) } } : undefined}
          className={`flex items-center gap-3 rounded-lg transition-colors ${
            aoClicar ? 'cursor-pointer -mx-2 px-2 py-1' : ''
          }`}
          style={selecionado === item.id
            ? { background: 'var(--p-trilho)', boxShadow: 'inset 2px 0 0 var(--p-roscaA)' }
            : undefined}
        >
          {mostrarPosicao && (
            <span className="w-5 text-[13px] tabular-nums shrink-0 text-center"
              style={{ color: 'var(--p-texto3)' }}>
              {i + 1}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] truncate" style={{ color: 'var(--p-texto)' }} title={item.rotulo}>
                {item.rotulo}
              </span>
              <span className="text-[12px] tabular-nums shrink-0" style={{ color: 'var(--p-texto2)' }}>
                {br(item.valor)}{sufixo}
              </span>
            </div>
            <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: 'var(--p-trilho)' }}>
              <div
                className="h-full rounded-full animate-barra origin-left"
                style={{
                  width: `${(item.valor / maximo) * 100}%`,
                  background: 'linear-gradient(90deg, var(--p-roscaB) 0%, var(--p-roscaA) 100%)',
                  animationDelay: `${i * 50}ms`,
                }}
              />
            </div>
            {item.nota && (
              <p className="text-[11px] mt-1" style={{ color: 'var(--p-texto3)' }}>{item.nota}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═══ Linhas com ícone (lista de registros) ═══ */

export function LinhasComIcone({ linhas }) {
  return (
    <div className="grid gap-1">
      {linhas.map((l, i) => (
        <div key={`${l.titulo}-${i}`} className="flex items-center gap-3 py-1.5">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${l.cor}22`, color: l.cor }}>
            <l.icone size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] truncate" style={{ color: 'var(--p-texto)' }}>{l.titulo}</span>
            <span className="block text-[11px] truncate" style={{ color: 'var(--p-texto3)' }}>{l.detalhe}</span>
          </span>
          {l.valor != null && (
            <span className="text-[13px] font-semibold tabular-nums shrink-0"
              style={{ color: 'var(--p-texto)' }}>
              {l.valor}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
