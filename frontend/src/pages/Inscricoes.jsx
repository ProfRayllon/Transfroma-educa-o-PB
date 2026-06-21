import { ArrowRight, CheckCircle, ExternalLink, Mail, Phone, Users } from 'lucide-react'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'

const formUrl = 'https://forms.gle/uYrVTURKxzq6mcRV6'
const videoId = 'K7sHZjRxk9g'

const steps = [
  {
    num: '1',
    title: 'Acesse o formulario',
    desc: 'Clique em "Realizar inscricao" e preencha o formulario oficial do Programa Transforma Educacao PB 2026.',
  },
  {
    num: '2',
    title: 'Informe seus dados',
    desc: 'Preencha nome completo, CPF, escola, municipio e trilha formativa de interesse.',
  },
  {
    num: '3',
    title: 'Confirme o envio',
    desc: 'Apos enviar, voce recebera uma confirmacao. Guarde o comprovante de inscricao.',
  },
  {
    num: '4',
    title: 'Validacao do CPF',
    desc: 'Acesse o portal Transforma e valide seu CPF para liberar o acesso ao Ambiente Virtual de Aprendizagem.',
  },
  {
    num: '5',
    title: 'Acesse o AVA',
    desc: 'Com o CPF validado, entre no AVA RIEH/PB usando sua conta gov.br e inicie sua formacao.',
  },
]

const stats = [
  { value: '+13.000', label: 'Cursistas inscritos' },
  { value: '100%', label: 'Certificados emitidos para concluintes' },
  { value: '+95%', label: 'Indice de satisfacao' },
  { value: '+200h', label: 'Carga horaria disponivel' },
]

export default function Inscricoes() {
  return (
    <div className="min-h-screen bg-white text-[#111827]">
      <PublicNav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#3b1d7a] py-20 px-[22px]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(168,85,247,.25)_0%,_transparent_60%)]" />
        <div className="relative mx-auto max-w-[1180px]">
          <span className="mb-3 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.3em] text-purple-200 ring-1 ring-white/20">
            Programa 2026
          </span>
          <h1 className="mb-4 text-[48px] font-black leading-tight text-white">
            Realizacao das<br />Inscricoes
          </h1>
          <p className="max-w-2xl text-[18px] leading-relaxed text-white/70">
            Participe do maior programa de formacao continuada da Paraiba. Inscreva-se, escolha sua trilha
            e inicie sua jornada de aprendizagem.
          </p>
          <div className="mt-8">
            <a
              href={formUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-[16px] font-black text-[#6b21a8] shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl"
            >
              Realizar inscricao agora <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="bg-gradient-to-b from-[#0f0520] to-[#1a0733] px-[22px] py-14">
        <div className="mx-auto max-w-[1180px]">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-[#a855f7]/25 bg-[#a855f7]/08 p-6 text-center"
                style={{ background: 'rgba(168,85,247,.06)' }}
              >
                <p className="text-[36px] font-black leading-none text-[#c084fc]">{s.value}</p>
                <p className="mt-2 text-sm font-semibold text-white/55">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como se inscrever ── */}
      <section className="mx-auto max-w-[1180px] px-[22px] py-16">
        <span className="mb-2 inline-block rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black uppercase tracking-wider text-[#6f35b5]">
          Passo a passo
        </span>
        <h2 className="mb-10 text-[34px] font-black leading-tight">Como se inscrever</h2>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.num}
              className="relative rounded-2xl border border-[#e9d5ff] bg-gradient-to-br from-white to-[#faf5ff] p-6 shadow-[0_4px_20px_rgba(111,53,181,.07)]"
            >
              {i < steps.length - 1 && (
                <div className="absolute -right-2.5 top-8 hidden lg:block">
                  <ArrowRight size={16} className="text-[#c4a7e7]" />
                </div>
              )}
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#6f35b5] to-[#9333ea] text-sm font-black text-white shadow-md">
                {s.num}
              </span>
              <h3 className="mb-2 text-[15px] font-black text-[#1c1033]">{s.title}</h3>
              <p className="text-[13.5px] leading-relaxed text-[#566176]">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Video ── */}
      <section className="bg-[#0a0615] px-[22px] py-16">
        <div className="mx-auto max-w-[1180px]">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <span className="mb-2 inline-block text-xs font-black uppercase tracking-[0.3em] text-[#a855f7]">
                Video informativo
              </span>
              <h2 className="mb-4 text-[34px] font-black leading-tight text-white">
                Saiba tudo sobre as inscricoes
              </h2>
              <p className="mb-6 text-[16px] leading-relaxed text-white/60">
                Assista ao video explicativo e entenda como funciona o processo de inscricao, validacao
                e acesso aos cursos do Transforma Educacao PB 2026.
              </p>
              <div className="flex items-center gap-3">
                <CheckCircle size={16} className="text-[#a855f7] shrink-0" />
                <span className="text-sm text-white/70">Inscricoes abertas para profissionais da rede</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <CheckCircle size={16} className="text-[#a855f7] shrink-0" />
                <span className="text-sm text-white/70">Certificado 100% para quem concluir</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <CheckCircle size={16} className="text-[#a855f7] shrink-0" />
                <span className="text-sm text-white/70">Mais de 13 mil cursistas no programa</span>
              </div>
              <a
                href={formUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#6f35b5] px-6 py-3 text-[15px] font-black text-white transition hover:bg-[#7e22ce]"
              >
                Quero me inscrever <ArrowRight size={16} />
              </a>
            </div>

            <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 shadow-[0_16px_48px_rgba(0,0,0,.5)]">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`}
                title="Como se inscrever no Transforma Educacao PB"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Contato ── */}
      <section className="mx-auto max-w-[1180px] px-[22px] py-16">
        <div className="grid gap-6 rounded-2xl border border-[#e9d5ff] bg-gradient-to-br from-[#faf5ff] to-white p-10 md:grid-cols-3">
          <div>
            <h2 className="mb-2 text-[26px] font-black text-[#1c1033]">Ficou com duvidas?</h2>
            <p className="text-[15px] leading-relaxed text-[#566176]">
              Entre em contato com a equipe da GEFDP para suporte nas inscricoes.
            </p>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f3e8ff]">
              <Mail size={18} className="text-[#6f35b5]" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-[#a855f7]">E-mail</p>
              <a href="mailto:gefdp@see.pb.gov.br" className="text-[15px] font-bold text-[#1c1033] hover:underline">
                gefdp@see.pb.gov.br
              </a>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f3e8ff]">
              <Users size={18} className="text-[#6f35b5]" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-[#a855f7]">Instagram</p>
              <a href="https://instagram.com/educaformapb" target="_blank" rel="noreferrer" className="text-[15px] font-bold text-[#1c1033] hover:underline">
                @educaformapb
              </a>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
