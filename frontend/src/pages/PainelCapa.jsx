import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, BarChart3, MonitorSmartphone, ArrowRight, GraduationCap, Star } from 'lucide-react'
import api from '../lib/api'

/**
 * A capa do Dashboard.
 *
 * Três painéis, três perguntas diferentes: quem concluiu, como os cursos estão
 * andando, e o que o próprio sistema registra. Antes tudo isso morava numa tela
 * só, e a consequência era previsível -- quem entrava para ver a conclusão
 * passava por dez gráficos que não tinham a ver com a pergunta dele.
 *
 * O número em cada cartão vem do banco, e não de um texto fixo. Um cartão de
 * entrada com número errado é pior do que um cartão sem número: ele é o
 * primeiro dado que a pessoa lê, e é o que ela repete na reunião seguinte.
 */

const CORES = {
  roxo: {
    faixa: 'from-brand-50 to-brand-100/60 dark:from-brand-950/40 dark:to-brand-900/20',
    borda: 'border-brand-200/70 dark:border-brand-800/50',
    icone: 'bg-gradient-to-br from-brand-600 to-brand-500',
    botao: 'bg-gradient-to-r from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700',
    numero: 'text-brand-400 dark:text-brand-500',
    destaque: 'text-brand-700 dark:text-brand-300',
    rodape: 'text-brand-700/70 dark:text-brand-400/70',
    figura: 'text-brand-500',
  },
  azul: {
    faixa: 'from-blue-50 to-sky-100/60 dark:from-blue-950/40 dark:to-sky-900/20',
    borda: 'border-blue-200/70 dark:border-blue-800/50',
    icone: 'bg-gradient-to-br from-blue-600 to-blue-500',
    botao: 'bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700',
    numero: 'text-blue-400 dark:text-blue-500',
    destaque: 'text-blue-700 dark:text-blue-300',
    rodape: 'text-blue-700/70 dark:text-blue-400/70',
    figura: 'text-blue-500',
  },
  verde: {
    faixa: 'from-emerald-50 to-teal-100/60 dark:from-emerald-950/40 dark:to-teal-900/20',
    borda: 'border-emerald-200/70 dark:border-emerald-800/50',
    icone: 'bg-gradient-to-br from-emerald-700 to-emerald-600',
    botao: 'bg-gradient-to-r from-emerald-800 to-emerald-700 hover:from-emerald-900 hover:to-emerald-800',
    numero: 'text-emerald-500 dark:text-emerald-500',
    destaque: 'text-emerald-800 dark:text-emerald-300',
    rodape: 'text-emerald-800/70 dark:text-emerald-400/70',
    figura: 'text-emerald-600',
  },
}

const br = (n) => Number(n || 0).toLocaleString('pt-BR')
const virgula = (n, casas = 1) => Number(n || 0)
  .toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/**
 * A ilustração do cartão.
 *
 * Procura o arquivo em /images/painel/. Se ele ainda não foi enviado, o
 * `onError` troca por uma figura desenhada em SVG -- a capa nasce funcionando e
 * melhora sozinha quando os arquivos aparecerem na pasta, sem tocar no código.
 */
function Figura({ arquivo, alt, cores, children }) {
  const [faltou, setFaltou] = useState(false)

  if (faltou) {
    return (
      <div className={`flex items-end justify-center h-full w-full ${cores.figura}`} aria-hidden="true">
        {children}
      </div>
    )
  }

  return (
    <img
      src={`/images/painel/${arquivo}`}
      alt={alt}
      onError={() => setFaltou(true)}
      className="max-h-full max-w-full object-contain"
    />
  )
}

/* Figuras de reserva: traços simples, no lugar do desenho definitivo. */

function FiguraCapelo() {
  return (
    <svg viewBox="0 0 200 150" className="w-full h-full" fill="none">
      <path d="M20 55 L100 25 L180 55 L100 85 Z" fill="currentColor" opacity="0.9" />
      <path d="M55 70 L55 105 Q100 125 145 105 L145 70" stroke="currentColor" strokeWidth="7"
        opacity="0.45" strokeLinecap="round" />
      <path d="M180 55 L180 95" stroke="currentColor" strokeWidth="5" opacity="0.6" strokeLinecap="round" />
      <circle cx="180" cy="100" r="7" fill="currentColor" opacity="0.6" />
    </svg>
  )
}

function FiguraBarras() {
  return (
    <svg viewBox="0 0 200 150" className="w-full h-full" fill="none">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={18 + i * 30} y={130 - (18 + i * 19)} width="20" height={18 + i * 19}
          rx="5" fill="currentColor" opacity={0.35 + i * 0.11} />
      ))}
      <path d="M28 96 Q100 74 178 22" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
      <path d="M162 22 L180 20 L176 38" stroke="currentColor" strokeWidth="4"
        strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.85" />
    </svg>
  )
}

function FiguraTela() {
  return (
    <svg viewBox="0 0 200 150" className="w-full h-full" fill="none">
      <rect x="26" y="24" width="148" height="94" rx="9" stroke="currentColor" strokeWidth="6" opacity="0.75" />
      <path d="M14 130 H186" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.55" />
      <path d="M46 96 L74 68 L98 84 L126 50 L152 62" stroke="currentColor" strokeWidth="5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      {[[74, 68], [98, 84], [126, 50]].map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r="5" fill="currentColor" opacity="0.9" />
      ))}
    </svg>
  )
}

function Cartao({ painel, carregando }) {
  const c = CORES[painel.cor]

  return (
    <Link
      to={painel.para}
      className={`group relative flex flex-col rounded-2xl border bg-gradient-to-b p-6 overflow-hidden
                  transition-shadow hover:shadow-card-hover animate-cena
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
                  ${c.faixa} ${c.borda}`}
      style={{ animationDelay: `${painel.ordem * 90}ms` }}
    >
      <div className="flex items-start justify-between">
        <span className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-card ${c.icone}`}>
          <painel.icone size={26} className="text-white" />
        </span>
        <span className={`text-lg font-semibold tabular-nums ${c.numero}`}>
          {String(painel.ordem).padStart(2, '0')}
        </span>
      </div>

      <h2 className="text-2xl font-bold mt-5 leading-tight text-gray-900 dark:text-gray-50 text-balance">
        {painel.titulo}
      </h2>
      <p className="text-[14.5px] leading-relaxed mt-2 text-gray-600 dark:text-gray-400">
        {painel.descricao}
      </p>

      {/* A ilustração e o indicador dividem a mesma faixa: a figura ao fundo, o
          número numa placa sobre ela. É o número que a pessoa veio buscar, e ele
          precisa continuar legível quando a figura mudar. */}
      <div className="relative mt-6 mb-6 h-[168px]">
        <div className="absolute inset-0 flex items-center justify-center px-2 opacity-90">
          <Figura arquivo={painel.imagem} alt="" cores={c}>
            <painel.figura />
          </Figura>
        </div>

        <div className="absolute bottom-0 right-0 flex items-center gap-2.5 pl-3 pr-4 py-2.5
                        rounded-xl bg-white/95 dark:bg-gray-900/90 backdrop-blur-sm shadow-card">
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.icone}`}>
            <painel.iconeIndicador size={15} className="text-white" />
          </span>
          <span className="min-w-0">
            <span className={`block text-[19px] font-bold leading-none tabular-nums ${c.destaque}`}>
              {carregando ? '—' : painel.valor}
            </span>
            <span className="block text-[11.5px] mt-0.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {painel.rotulo}
            </span>
          </span>
        </div>
      </div>

      <span className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-xl
                        text-white font-semibold text-[15px] transition-colors ${c.botao}`}>
        Acessar painel
        <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
      </span>

      <span className={`block text-center text-[11px] font-semibold tracking-[0.14em] uppercase mt-4 ${c.rodape}`}>
        {painel.lema}
      </span>
    </Link>
  )
}

export default function PainelCapa() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    // A mesma rota do dashboard, com o mesmo cache de um minuto no servidor:
    // abrir a capa e entrar num painel não paga a consulta duas vezes.
    api.get('/painel')
      .then(({ data }) => setDados(data))
      .catch(() => setErro(true))
  }, [])

  const paineis = useMemo(() => {
    const I = dados?.institucional
    const R = I?.resultados
    const temConclusao = (R?.conclusao?.base || 0) > 0
    const temAvaliacao = (R?.nota?.respostas || 0) > 0

    return [
      {
        ordem: 1,
        cor: 'roxo',
        para: '/painel/concluintes',
        icone: Users,
        iconeIndicador: GraduationCap,
        figura: FiguraCapelo,
        imagem: 'concluintes.png',
        titulo: 'Docentes Concluintes',
        descricao: 'Quantos profissionais concluíram cada curso, com o recorte por regional e por curso.',
        // Concluintes, e não a base inteira: são coisas diferentes, e a base é
        // o denominador -- não o resultado.
        valor: temConclusao ? br(R.conclusao.concluintes) : '—',
        rotulo: temConclusao ? 'Concluíram' : 'Aguardando planilha',
        lema: 'Valorizando quem transforma o ensino',
      },
      {
        ordem: 2,
        cor: 'azul',
        para: '/painel/progresso',
        icone: BarChart3,
        iconeIndicador: Star,
        figura: FiguraBarras,
        imagem: 'progresso.png',
        titulo: 'Consolidado do Curso',
        descricao: 'Procura, inscrições e a avaliação que os cursistas fizeram de cada curso.',
        valor: temAvaliacao ? virgula(R.nota.media, 2) : '—',
        rotulo: temAvaliacao ? 'Nota geral, de 5' : 'Aguardando planilha',
        lema: 'Acompanhando evoluções, construindo resultados',
      },
      {
        ordem: 3,
        cor: 'verde',
        para: '/painel/sistema',
        icone: MonitorSmartphone,
        iconeIndicador: Users,
        figura: FiguraTela,
        imagem: 'sistema.png',
        titulo: 'Dados do Sistema',
        descricao: 'O que a própria plataforma registra: base de profissionais, acessos e perfil da rede.',
        valor: I ? br(I.totais.cursistas) : '—',
        rotulo: 'Profissionais na base',
        lema: 'Dados confiáveis para melhores decisões',
      },
    ]
  }, [dados])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Três painéis, três perguntas. Escolha por onde começar.
        </p>
      </div>

      {erro && (
        <div className="card text-[13px] text-gray-600 dark:text-gray-400">
          Os painéis abrem normalmente, mas não consegui buscar os números de resumo agora.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {paineis.map((p) => (
          <Cartao key={p.para} painel={p} carregando={!dados} />
        ))}
      </div>
    </div>
  )
}
