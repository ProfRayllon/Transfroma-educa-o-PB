import { ArrowRight, BookOpen, Download, ExternalLink, FileText, Layers, Target } from 'lucide-react'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'

const driveUrl = 'https://drive.google.com/drive/folders/1vZPmyZyxj5mmMBFlSwrVJKQYVAfGRHHK'

const guias = [
  {
    icon: <BookOpen size={22} />,
    tag: 'Orientacao geral',
    title: 'Guia do Cursista',
    desc: 'Todas as instrucoes para navegar no programa: como se inscrever, acessar o AVA, escolher trilhas e emitir certificado.',
    color: 'from-[#6b21a8] to-[#4c1d95]',
  },
  {
    icon: <Layers size={22} />,
    tag: 'Trilhas formativas',
    title: 'Guia das Trilhas',
    desc: 'Descricao completa de cada trilha formativa disponivel, com carga horaria, publico-alvo e estrutura dos cursos.',
    color: 'from-[#7e22ce] to-[#6b21a8]',
  },
  {
    icon: <Target size={22} />,
    tag: 'Acesso ao AVA',
    title: 'Guia do AVA RIEH/PB',
    desc: 'Como acessar o Ambiente Virtual de Aprendizagem, navegar nos cursos, entregar atividades e acompanhar seu progresso.',
    color: 'from-[#9333ea] to-[#7e22ce]',
  },
  {
    icon: <FileText size={22} />,
    tag: 'Certificacao',
    title: 'Guia de Certificacao',
    desc: 'Criterios para emissao do certificado, prazos de conclusao e como acessar seu documento ao finalizar o curso.',
    color: 'from-[#a855f7] to-[#9333ea]',
  },
]

const trilhas = [
  { label: 'Trilha Institucional', icon: '/images/icons/trilha-institucional.png' },
  { label: 'Educacao Socioemocional', icon: '/images/icons/socioemocional.png' },
  { label: 'Educacao, Ciencia e Tecnologia', icon: '/images/icons/tecnologia.png' },
  { label: 'Gestao Pedagogica', icon: '/images/icons/gestao.png' },
  { label: 'Educacao Inclusiva, Equidade e Diversidade', icon: '/images/icons/inclusiva.png' },
  { label: 'BNCC', icon: '/images/icons/bncc.png' },
]

export default function Guia() {
  return (
    <div className="min-h-screen bg-white text-[#111827]">
      <PublicNav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#0a0615] px-[22px] py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(168,85,247,.3)_0%,_transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />
        <div className="relative mx-auto max-w-[1180px]">
          <span className="mb-3 inline-block rounded-full border border-[#a855f7]/40 bg-[#a855f7]/10 px-3 py-1 text-xs font-black uppercase tracking-[0.3em] text-[#c084fc]">
            Material de apoio
          </span>
          <h1 className="mb-4 text-[48px] font-black leading-tight text-white">
            Guias<br />Transforma
          </h1>
          <p className="max-w-2xl text-[18px] leading-relaxed text-white/60">
            Acesse todos os materiais de orientacao do programa. Guias pensados para facilitar sua
            jornada de formacao do inicio ao certificado.
          </p>
          <div className="mt-8">
            <a
              href={driveUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[#a855f7]/50 bg-[#a855f7]/15 px-8 py-4 text-[16px] font-black text-white ring-1 ring-[#a855f7]/30 transition hover:bg-[#a855f7]/25 hover:-translate-y-0.5"
            >
              Acessar pasta completa no Drive <ExternalLink size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* ── Guias cards ── */}
      <section className="mx-auto max-w-[1180px] px-[22px] py-16">
        <span className="mb-2 inline-block rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black uppercase tracking-wider text-[#6f35b5]">
          Documentos disponíveis
        </span>
        <h2 className="mb-10 text-[34px] font-black leading-tight">Guias do programa</h2>

        <div className="grid gap-5 md:grid-cols-2">
          {guias.map((g) => (
            <a
              key={g.title}
              href={driveUrl}
              target="_blank"
              rel="noreferrer"
              className="group flex items-start gap-5 rounded-2xl border border-[#e9d5ff] bg-white p-6 shadow-[0_4px_20px_rgba(111,53,181,.06)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(111,53,181,.14)]"
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${g.color} text-white shadow-lg`}>
                {g.icon}
              </div>
              <div className="flex-1">
                <p className="mb-0.5 text-[10px] font-black uppercase tracking-wider text-[#a855f7]">{g.tag}</p>
                <h3 className="mb-2 text-[17px] font-black text-[#1c1033]">{g.title}</h3>
                <p className="text-[13.5px] leading-relaxed text-[#566176]">{g.desc}</p>
              </div>
              <ArrowRight size={18} className="mt-1 shrink-0 text-[#c4a7e7] transition group-hover:text-[#6f35b5] group-hover:translate-x-0.5" />
            </a>
          ))}
        </div>
      </section>

      {/* ── Trilhas ── */}
      <section className="bg-[#faf5ff] px-[22px] py-16">
        <div className="mx-auto max-w-[1180px]">
          <span className="mb-2 inline-block rounded-full bg-[#ede9fe] px-3 py-1 text-xs font-black uppercase tracking-wider text-[#6f35b5]">
            Formacao
          </span>
          <h2 className="mb-3 text-[34px] font-black leading-tight">Trilhas disponíveis</h2>
          <p className="mb-10 text-[16px] leading-relaxed text-[#566176]">
            Escolha a trilha que melhor se encaixa no seu perfil e area de atuacao.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trilhas.map((t) => (
              <div
                key={t.label}
                className="flex items-center gap-4 rounded-2xl border border-[#e9d5ff] bg-white px-5 py-4 shadow-[0_2px_12px_rgba(111,53,181,.06)]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#e9d5ff] bg-[#faf5ff]">
                  <img src={t.icon} alt="" className="h-6 w-6 object-contain" />
                </div>
                <span className="text-[14px] font-bold text-[#1c1033]">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Download ── */}
      <section className="bg-gradient-to-br from-[#3b1d7a] to-[#6b21a8] px-[22px] py-16">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-6 text-center md:flex-row md:text-left">
          <div className="flex-1">
            <h2 className="mb-2 text-[32px] font-black text-white">Acesse todos os guias</h2>
            <p className="text-[16px] text-white/65">
              Todos os materiais estao disponiveis gratuitamente na pasta do Google Drive do programa.
            </p>
          </div>
          <a
            href={driveUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-8 py-4 text-[15px] font-black text-[#6b21a8] shadow-xl transition hover:-translate-y-0.5"
          >
            <Download size={17} /> Baixar guias
          </a>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
