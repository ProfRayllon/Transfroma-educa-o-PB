import { Link } from 'react-router-dom'

export default function PublicFooter() {
  return (
    <footer className="border-t border-brand-100 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 text-sm text-slate-600 md:grid-cols-[1.3fr_0.7fr_0.7fr] lg:px-8">
        <div>
          <p className="text-lg font-black text-brand-950">Transforma Educacao PB 2026</p>
          <p className="mt-3 max-w-xl leading-6">
            Formacao continuada para apoiar professores, equipes escolares e gestores na producao de
            experiencias de aprendizagem conectadas a BNCC.
          </p>
        </div>
        <div>
          <p className="font-bold text-slate-900">Navegacao</p>
          <div className="mt-3 flex flex-col gap-2">
            <Link className="hover:text-brand-800" to="/">Home</Link>
            <Link className="hover:text-brand-800" to="/catalogo-cursos">Cursos</Link>
            <Link className="hover:text-brand-800" to="/login">Login</Link>
          </div>
        </div>
        <div>
          <p className="font-bold text-slate-900">Realizacao</p>
          <p className="mt-3 leading-6">Secretaria de Estado da Educacao da Paraiba.</p>
        </div>
      </div>
    </footer>
  )
}
