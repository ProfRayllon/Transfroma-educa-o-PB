import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, TrendingUp, BarChart3, Trophy, PieChart } from 'lucide-react'

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
/**
 * As cores dos gráficos, nos dois temas.
 *
 * Tudo na família roxa da marca, para o dashboard não parecer um sistema
 * diferente colado dentro deste. Só o que é gráfico mora aqui: fundo de página
 * e caixa de card vêm da classe `.card` do próprio sistema.
 *
 * ─── Por que roxo dá certo aqui, mesmo sendo uma cor só ───
 *
 * Quase tudo neste dashboard é MAGNITUDE, não identidade: ranking de GREs,
 * inscritos por curso, faixa etária, eixos. Magnitude se codifica com um hue só
 * em intensidades diferentes -- é a forma correta, não um remendo para caber na
 * marca. Cores categóricas só apareceriam se houvesse séries sem ordem entre
 * si, e aqui existe um caso: barras de acesso contra a linha de inscrições.
 *
 * Para esse par escolhi dois roxos com distância medida, não dois vizinhos
 * quaisquer: no claro, #A855F7 e #5B21B6 dão ΔE 20,1 para visão normal e 16,1
 * para protanopia, com contraste acima de 3:1 nos dois. Trocar um deles por um
 * roxo mais próximo derruba isso rápido -- #8B5CF6 com #C084FC, por exemplo,
 * cai para ΔE 13,1 e as duas séries viram a mesma cor.
 */
export const TEMA = {
  claro: {
    texto: '#0F172A',
    texto2: '#475569',
    texto3: '#94A3B8',
    grade: 'rgba(88,28,135,0.10)',
    trilho: 'rgba(88,28,135,0.08)',
    trilhoForte: 'rgba(88,28,135,0.20)',
    cartaoBorda: 'rgba(88,28,135,0.12)',
    balao: '#FFFFFF',
    pontoBorda: '#FFFFFF',
    barra: '#A855F7',
    barraTopo: '#C4B5FD',
    linha: '#5B21B6',
    roscaA: '#7C3AED',
    roscaB: '#A78BFA',
    negativo: '#DC2626',
  },
  escuro: {
    texto: '#F1EEFB',
    texto2: 'rgba(241,238,251,0.60)',
    texto3: 'rgba(241,238,251,0.38)',
    grade: 'rgba(196,181,253,0.12)',
    trilho: 'rgba(196,181,253,0.12)',
    trilhoForte: 'rgba(196,181,253,0.26)',
    cartaoBorda: 'rgba(196,181,253,0.14)',
    balao: '#241C3D',
    pontoBorda: '#241C3D',
    barra: '#A855F7',
    barraTopo: '#C4B5FD',
    /* No escuro a linha inverte: fica MAIS clara que as barras.
     *
     * Um roxo escuro sobre fundo escuro tem contraste 2,26:1 e some. O par
     * claro-sobre-médio dá ΔE 23,6 e contraste acima de 3:1 -- passa em tudo
     * menos na faixa de luminosidade que o validador recomenda para
     * preenchimentos categóricos de mesmo peso, que não é o caso aqui: um traço
     * de 2,5px precisa de mais luz que uma barra cheia para pesar igual. */
    linha: '#D8B4FE',
    roscaA: '#A78BFA',
    roscaB: '#7C3AED',
    negativo: '#FB7185',
  },
}

/**
 * A rampa de magnitude: um roxo só, do claro ao escuro.
 *
 * Usada em tudo que é ranking ou proporção. As duas versões foram validadas
 * como rampa ordinal -- luminosidade sempre descendo, degraus separados o
 * bastante para se distinguirem, e a ponta clara ainda visível contra o fundo.
 */
export const RAMPA = {
  claro: ['#A78BFA', '#9061F9', '#7C3AED', '#6220CE', '#4C1D95'],
  escuro: ['#DDD6FE', '#C4B5FD', '#A78BFA', '#8B5CF6', '#7C3AED'],
}

export const degrau = (i, total, escuro = false) => {
  const r = escuro ? RAMPA.escuro : RAMPA.claro
  if (total <= 1) return r[Math.floor(r.length / 2)]
  return r[Math.min(r.length - 1, Math.round((i / (total - 1)) * (r.length - 1)))]
}

export const variaveisDoTema = (escuro) => {
  const t = escuro ? TEMA.escuro : TEMA.claro
  const base = Object.fromEntries(Object.entries(t).map(([k, v]) => [`--p-${k}`, v]))
  const rampa = Object.fromEntries((escuro ? RAMPA.escuro : RAMPA.claro).map((c, i) => [`--p-r${i + 1}`, c]))
  return { ...base, ...rampa }
}

/**
 * Os quatro gradientes dos cartões do topo, em profundidades diferentes do
 * mesmo roxo.
 *
 * Aqui a cor é decoração, não dado: cada cartão já se identifica pelo ícone e
 * pelo rótulo, e ninguém precisa distinguir um do outro pela cor. Por isso eles
 * podem ser variações próximas -- o que numa codificação de dados seria erro.
 *
 * Os nomes das chaves seguem sendo posicionais para não obrigar a renomear
 * cada chamada quando a paleta mudar de novo.
 */
export const GRADIENTES = {
  azul: ['#4C1D95', '#7C3AED'],
  ciano: ['#5B21B6', '#9061F9'],
  roxo: ['#6D28D9', '#A855F7'],
  rosa: ['#7E22CE', '#C084FC'],
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

export function CartaoKpi({
  icone: Icone, rotulo, valor, sufixo, variacao, comparativo,
  gradiente = 'azul', serie, duracao,
  // Taxa e nota nao sao contagem: 69% e 4,73 precisam da casa decimal que um
  // total de pessoas nunca quer.
  decimais = 0,
}) {
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
            <Contador valor={valor} sufixo={sufixo} duracao={duracao} decimais={decimais} />
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
                // Do topo claro para a base escura: a barra ganha peso onde
                // encosta no eixo, que e onde a leitura comeca.
                background: 'linear-gradient(180deg, var(--p-r2) 0%, var(--p-r4) 100%)',
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



/**
 * Os símbolos de gênero, desenhados à mão.
 *
 * A biblioteca de ícones do projeto (lucide 0.294) não traz Vênus nem Marte, e
 * o substituto natural -- um boneco genérico -- seria o mesmo desenho nos dois
 * lados, carregando a distinção só na cor. Cor sozinha não é rótulo: quem tem
 * daltonismo veria dois ícones iguais.
 *
 * São traços simples num quadro de 24x24, no mesmo peso dos ícones da lucide
 * para não destoarem do resto da tela. Ficam em <g>, e não em <svg> aninhado,
 * porque svg dentro de svg é suportado mas se comporta de formas diferentes
 * entre navegadores na hora de posicionar.
 */
const SIMBOLOS = {
  feminino: (
    <>
      <circle cx="12" cy="9" r="5" />
      <line x1="12" y1="14" x2="12" y2="22" />
      <line x1="8.5" y1="18.5" x2="15.5" y2="18.5" />
    </>
  ),
  masculino: (
    <>
      <circle cx="10" cy="14" r="5" />
      <line x1="13.6" y1="10.4" x2="20" y2="4" />
      <polyline points="14.5,4 20,4 20,9.5" />
    </>
  ),
}

function Simbolo({ nome, x, y, tamanho = 21, cor }) {
  const desenho = SIMBOLOS[nome]
  if (!desenho) return null
  const escala = tamanho / 24
  return (
    <g
      transform={`translate(${x} ${y}) scale(${escala})`}
      fill="none"
      stroke={cor}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {desenho}
    </g>
  )
}

/* ═══ Rosca com rótulo no próprio arco ═══ */

/**
 * A rosca grande, com cada fatia nomeada ao lado dela.
 *
 * Rótulo direto em vez de legenda embaixo. A legenda obriga um vaivém -- olhar
 * a cor no arco, descer, procurar a mesma cor na lista, subir de novo -- e esse
 * vaivém é justamente o que cansa em painel projetado ou lido de relance. Com o
 * nome encostado na fatia, a leitura acaba onde começou.
 *
 * Também é o que libera espaço: sem a lista embaixo, o desenho ocupa o cartão
 * inteiro, que era o pedido.
 *
 * O rótulo sai por uma cotovelada -- um traço curto saindo do arco, uma dobra e
 * o texto numa coluna fixa nas laterais. A coluna fixa é o que impede dois
 * nomes de se atropelarem quando duas fatias caem em ângulos próximos; alinhar
 * o texto no ângulo exato de cada uma seria mais bonito e ilegível na primeira
 * vez que duas fatias ficassem pequenas.
 */
export function RoscaRotulada({ fatias, total, centroValor, centroRotulo, altura = 300 }) {
  /**
   * A caixa e a coluna de texto sao calculadas, e nao chutadas.
   *
   * Texto em SVG nao quebra linha nem respeita borda: se o rotulo nao couber,
   * ele simplesmente sai da caixa e some. COLUNA precisa ser >= a largura do
   * rotulo mais longo, porque uma fatia pode cair de qualquer lado conforme os
   * dados mudam -- e o lado esquerdo e o direito tem que aguentar o pior caso
   * igualmente.
   */
  const W = 620, H = 340
  const cx = W / 2, cy = H / 2
  const raio = 105, espessura = 38
  const COLUNA = 180
  const volta = 2 * Math.PI * raio
  const soma = total ?? fatias.reduce((s, f) => s + f.valor, 0)

  let acumulado = 0
  const arcos = fatias.map((f) => {
    const fracao = soma ? f.valor / soma : 0
    const meio = acumulado + fracao / 2
    acumulado += fracao
    return { ...f, fracao, offset: acumulado - fracao, meio }
  })

  // -90° para a primeira fatia começar no topo, como todo mundo espera.
  const ponto = (fracao, r) => {
    const a = fracao * 2 * Math.PI - Math.PI / 2
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: altura }}>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={raio} fill="none" stroke="var(--p-trilho)" strokeWidth={espessura} />
        {arcos.map((a) => (
          <circle
            key={a.rotulo}
            cx={cx} cy={cy} r={raio} fill="none"
            stroke={a.cor} strokeWidth={espessura} strokeLinecap="butt"
            strokeDasharray={`${(volta * a.fracao).toFixed(2)} ${volta}`}
            strokeDashoffset={-(volta * a.offset)}
            style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.22,1,0.36,1)' }}
          />
        ))}
      </g>

      {arcos.map((a) => {
        const [x1, y1] = ponto(a.meio, raio + espessura / 2)
        const [x2, y2] = ponto(a.meio, raio + espessura / 2 + 20)
        const direita = x2 >= cx
        const xTexto = direita ? W - COLUNA : COLUNA
        const ancora = direita ? 'start' : 'end'

        return (
          <g key={`r-${a.rotulo}`}>
            <polyline
              points={`${x1},${y1} ${x2},${y2} ${xTexto + (direita ? -8 : 8)},${y2}`}
              fill="none" stroke={a.cor} strokeWidth="1.5" strokeLinejoin="round" opacity="0.65"
            />
            <circle cx={x1} cy={y1} r="2.5" fill={a.cor} />
            {a.simbolo && (
              <Simbolo
                nome={a.simbolo}
                cor={a.cor}
                x={direita ? xTexto - 28 : xTexto + 7}
                y={y2 - 21}
              />
            )}
            <text x={xTexto} y={y2 - 4} textAnchor={ancora}
              style={{ fontSize: 15, fontWeight: 600, fill: 'var(--p-texto)' }}>
              {/* O nome inteiro fica no title: texto em SVG nao quebra linha, e
                  a coluna tem largura fixa -- quem precisa do nome completo
                  passa o mouse. */}
              <title>{a.titulo || a.rotulo}</title>
              {a.rotulo}
            </text>
            <text x={xTexto} y={y2 + 15} textAnchor={ancora}
              style={{ fontSize: 14, fill: 'var(--p-texto2)' }}>
              {br(a.valor)} · {soma ? ((a.valor / soma) * 100).toFixed(1).replace('.', ',') : 0}%
            </text>
          </g>
        )
      })}

      <text x={cx} y={cy + 2} textAnchor="middle"
        style={{ fontSize: 52, fontWeight: 700, fill: 'var(--p-texto)' }}>
        {centroValor}
      </text>
      {centroRotulo && (
        <text x={cx} y={cy + 26} textAnchor="middle"
          style={{ fontSize: 14, fill: 'var(--p-texto2)' }}>
          {centroRotulo}
        </text>
      )}
    </svg>
  )
}


/* ═══ Ranking em pirulito ═══ */

/**
 * Uma escala que termina em número redondo.
 *
 * Sem isso o eixo acabaria em 3.165 e as marcas cairiam em 791, 1.582, 2.374 --
 * números que ninguém usa para estimar. A regra: sobe até a próxima potência de
 * dez arredondada para cima e, se isso deixar menos de três marcas, corta o
 * passo pela metade.
 */
function escalaRedonda(maximo) {
  if (maximo <= 0) return { topo: 1, marcas: [0, 1] }
  const base = 10 ** Math.floor(Math.log10(maximo))
  let topo = Math.ceil(maximo / base) * base
  let passo = base
  if (topo / passo < 3) passo = base / 2
  if (topo / passo > 8) passo = base * 2
  topo = Math.ceil(maximo / passo) * passo

  const marcas = []
  for (let v = 0; v <= topo + 1e-9; v += passo) marcas.push(Math.round(v))
  return { topo, marcas }
}

const compactoBr = (v) => (v >= 1000
  ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  : String(v))

/**
 * Ranking em pirulito: um traço fino até um ponto.
 *
 * Preferido à barra cheia quando os itens são muitos e os valores próximos. A
 * barra pinta uma área grande para cada linha e, empilhadas, viram um bloco de
 * cor onde a diferença entre o 3º e o 4º se perde. O pirulito concentra a
 * leitura no ponto -- o olho compara posições, que é o que ele faz melhor.
 *
 * O valor aparece escrito à direita porque estimar número em eixo custa uma ida
 * e volta; quem quer a ordem lê os pontos, quem quer a cifra lê a coluna.
 */
export function RankingPirulito({
  itens, rodape,
  // Percentual e contagem nao se escrevem igual, e o eixo de um percentual quer
  // ir ate 100 mesmo quando o maior valor e 95: sem `teto`, duas visoes do mesmo
  // cartao teriam reguas diferentes e pareceriam comparaveis.
  formatarValor = br,
  formatarEixo = compactoBr,
  teto = null,
  // O rotulo de uma linha que merece atencao. Uso parcimonioso: destacar tudo
  // e o mesmo que nao destacar nada.
  destaque = null,
}) {
  const maximo = teto || Math.max(0, ...itens.map((i) => i.valor))
  const { topo, marcas } = escalaRedonda(maximo)

  return (
    <div className="flex flex-col gap-1">
      {itens.map((item, i) => {
        const pct = topo ? (item.valor / topo) * 100 : 0
        const marcado = destaque != null && destaque === item.rotulo
        return (
          <div key={item.rotulo} className="flex items-center gap-2.5 h-9">
            <span
              className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-semibold tabular-nums shrink-0"
              style={{ background: 'var(--p-trilho)', color: 'var(--p-texto2)' }}
            >
              {i + 1}
            </span>

            <span
              className="text-[13px] truncate shrink-0 w-[38%] max-w-[210px]"
              style={{
                color: marcado ? 'var(--p-r5)' : 'var(--p-texto)',
                fontWeight: marcado ? 600 : 400,
              }}
              title={item.titulo || item.rotulo}
            >
              {item.rotulo}
            </span>

            {/* A haste e o ponto compartilham o mesmo cálculo de posição: se um
                dia forem calculados em lugares diferentes, um vai encostar no
                outro errado na primeira mudança de escala. */}
            <span className="relative flex-1 min-w-0 h-full flex items-center">
              {marcas.map((m) => (
                <span
                  key={m}
                  className="absolute inset-y-0 w-px"
                  style={{ left: `${(m / topo) * 100}%`, background: 'var(--p-grade)' }}
                />
              ))}
              <span
                className="absolute h-[2px] rounded-full origin-left animate-barra"
                style={{
                  width: `${pct}%`,
                  background: marcado ? 'var(--p-r5)' : 'var(--p-r3)',
                  animationDelay: `${i * 45}ms`,
                }}
              />
              <span
                className="absolute w-3 h-3 rounded-full animate-cena"
                style={{
                  left: `${pct}%`,
                  transform: 'translateX(-50%)',
                  background: marcado ? 'var(--p-r5)' : 'var(--p-r3)',
                  animationDelay: `${i * 45}ms`,
                }}
              />
            </span>

            <span
              className="text-[13px] font-semibold tabular-nums text-center shrink-0 w-[74px] py-1 rounded-lg"
              style={{
                background: marcado ? 'var(--p-r5)' : 'var(--p-trilho)',
                color: marcado ? '#fff' : 'var(--p-r4)',
              }}
            >
              {formatarValor(item.valor)}
            </span>
          </div>
        )
      })}

      {/* O eixo alinhado com a coluna das hastes: as mesmas larguras da linha
          acima, para as marcas caírem exatamente sobre as linhas de grade. */}
      <div className="flex items-center gap-2.5 mt-1">
        <span className="w-6 shrink-0" />
        <span className="shrink-0 w-[38%] max-w-[210px]" />
        <span className="relative flex-1 min-w-0 h-4">
          <span className="absolute inset-x-0 top-0 h-px" style={{ background: 'var(--p-grade)' }} />
          {marcas.map((m) => (
            <span
              key={m}
              className="absolute top-1 text-[11px] tabular-nums whitespace-nowrap"
              style={{
                left: `${(m / topo) * 100}%`,
                transform: m === 0 ? 'none' : 'translateX(-50%)',
                color: 'var(--p-texto3)',
              }}
            >
              {formatarEixo(m)}
            </span>
          ))}
        </span>
        <span className="w-[74px] shrink-0" />
      </div>

      {rodape && (
        <div
          className="flex items-center gap-2.5 mt-3 px-3 py-2 rounded-xl text-[12px]"
          style={{ background: 'var(--p-trilho)', color: 'var(--p-texto2)' }}
        >
          <TrendingUp size={14} style={{ color: 'var(--p-r3)' }} className="shrink-0" />
          {rodape}
        </div>
      )}
    </div>
  )
}

/** As três medidas que resumem um ranking. */
export function ResumoDoRanking({ total, maior, participacao }) {
  const itens = [
    { icone: BarChart3, valor: br(total), rotulo: 'Total' },
    { icone: Trophy, valor: br(maior), rotulo: 'Maior valor' },
    { icone: PieChart, valor: `${participacao}%`, rotulo: 'Participação do líder' },
  ]

  return (
    <div className="flex items-stretch">
      {itens.map((i, indice) => (
        <div
          key={i.rotulo}
          className={`flex-1 text-center px-3 ${indice > 0 ? 'border-l' : ''}`}
          style={{ borderColor: 'var(--p-cartaoBorda)' }}
        >
          <i.icone size={16} className="mx-auto mb-1" style={{ color: 'var(--p-r3)' }} />
          <div className="text-[17px] font-bold tabular-nums leading-none" style={{ color: 'var(--p-texto)' }}>
            {i.valor}
          </div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--p-texto3)' }}>{i.rotulo}</div>
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
                  background: 'linear-gradient(90deg, var(--p-r4) 0%, var(--p-r2) 100%)',
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


/* ═══ Carrossel de cursos ═══ */

/**
 * Um curso por vez, do mais procurado para o menos, girando sozinho.
 *
 * Substitui a lista de cinco linhas no mesmo espaço. A troca vale porque a
 * lista mostrava cinco nomes espremidos e nenhuma imagem; aqui cada curso
 * ocupa o cartão inteiro por alguns segundos -- cabe a capa, o número de
 * inscritos, a fatia que ele representa e a posição no ranking.
 *
 * Três coisas que um carrossel precisa ter para não irritar:
 *
 * 1. Para quando o mouse entra. Ninguém consegue ler algo que foge, e a
 *    intenção de ler é justamente o que o ponteiro parado sinaliza.
 * 2. Para de vez quando um curso está filtrado. Ali o cartão deixou de ser
 *    vitrine e virou o estado atual da tela -- girar seria contradizer o
 *    filtro que a pessoa acabou de aplicar.
 * 3. Não gira para quem pediu menos movimento no sistema
 *    (`prefers-reduced-motion`), que é acessibilidade e não preferência.
 */
export function CarrosselDeCursos({ itens, selecionado, aoClicar, segundos = 5 }) {
  const [indice, setIndice] = useState(0)
  const [pausado, setPausado] = useState(false)
  // Capa que nao carregou cai no degrade, em vez de deixar o icone de imagem
  // quebrada no meio do cartao. Guardado por id: a mesma capa nao e tentada de
  // novo a cada volta do carrossel.
  const [semCapa, setSemCapa] = useState(() => new Set())

  const total = itens.reduce((s, i) => s + i.valor, 0)
  const posicaoSelecionada = itens.findIndex((i) => i.id === selecionado)
  const travado = posicaoSelecionada >= 0
  const atual = itens[travado ? posicaoSelecionada : Math.min(indice, itens.length - 1)]

  const menosMovimento = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useEffect(() => {
    if (pausado || travado || menosMovimento || itens.length < 2) return
    const id = setInterval(() => setIndice((i) => (i + 1) % itens.length), segundos * 1000)
    return () => clearInterval(id)
  }, [pausado, travado, menosMovimento, itens.length, segundos])

  if (!atual) return null

  const fatia = total ? (atual.valor / total) * 100 : 0
  const posicao = itens.indexOf(atual) + 1

  return (
    <div
      className="flex flex-col h-full"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div
        onClick={aoClicar ? () => aoClicar(atual) : undefined}
        role={aoClicar ? 'button' : undefined}
        tabIndex={aoClicar ? 0 : undefined}
        onKeyDown={aoClicar ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aoClicar(atual) }
        } : undefined}
        className={`relative flex-1 min-h-0 rounded-xl overflow-hidden ${aoClicar ? 'cursor-pointer' : ''}`}
        style={{ background: 'var(--p-trilho)' }}
      >
        {/* key no indice: remonta o bloco a cada troca, e a animação de entrada
            roda de novo. Sem isso o conteúdo trocaria sem transição nenhuma. */}
        <div key={atual.id} className="absolute inset-0 animate-cena">
          {atual.imagem && !semCapa.has(atual.id) ? (
            <img
              src={atual.imagem}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setSemCapa((s) => new Set(s).add(atual.id))}
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(135deg, var(--p-roscaB) 0%, var(--p-barra) 100%)' }}
            />
          )}

          {/* Véu escuro de baixo para cima: o texto precisa de contraste sobre
              uma capa que pode ser clara, escura ou cheia de detalhe -- e não há
              como saber qual antes de a coordenação subir a imagem. */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(10,8,30,0.15) 0%, rgba(10,8,30,0.55) 45%, rgba(10,8,30,0.88) 100%)' }}
          />

          <span className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center text-[15px] font-bold text-white tabular-nums">
            {posicao}
          </span>

          {atual.aberto && (
            <span className="absolute top-4 right-3 px-2 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[10px] font-semibold text-white uppercase tracking-wide">
              inscrições abertas
            </span>
          )}

          <div className="absolute inset-x-0 bottom-0 p-4">
            <p className="text-[14px] font-semibold text-white leading-snug line-clamp-2">
              {atual.rotulo}
            </p>

            <div className="flex items-end justify-between gap-3 mt-2">
              <span className="text-[26px] font-bold text-white leading-none tabular-nums">
                {Number(atual.valor).toLocaleString('pt-BR')}
              </span>
              <span className="text-[13px] text-white/75 tabular-nums pb-0.5">
                {fatia.toFixed(1).replace('.', ',')}% das inscrições
              </span>
            </div>

            <div className="h-1.5 rounded-full bg-white/20 overflow-hidden mt-2.5">
              <div
                className="h-full rounded-full animate-barra origin-left"
                style={{ width: `${fatia}%`, background: 'var(--p-r2)' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Um traço por curso. O traço da vez é mais largo e mostra o tempo até a
          próxima virada, que é o que evita a sensação de troca aleatória. */}
      <div className="flex items-center justify-center gap-1.5 pt-3 shrink-0">
        {itens.map((item, i) => {
          const ativo = item === atual
          return (
            <button
              key={item.id}
              onClick={() => { setIndice(i); if (travado && aoClicar) aoClicar(atual) }}
              title={item.rotulo}
              className="h-1.5 rounded-full overflow-hidden transition-all"
              style={{ width: ativo ? 26 : 10, background: 'var(--p-trilho)' }}
            >
              {ativo && (
                <span
                  className="block h-full rounded-full"
                  style={{
                    background: 'var(--p-roscaA)',
                    animation: (pausado || travado || menosMovimento || itens.length < 2)
                      ? 'none'
                      : `barra ${segundos}s linear both`,
                    width: (pausado || travado || menosMovimento || itens.length < 2) ? '100%' : undefined,
                  }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
