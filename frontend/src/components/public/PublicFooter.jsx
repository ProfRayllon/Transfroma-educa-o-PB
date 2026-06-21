import { Link } from 'react-router-dom'

export default function PublicFooter() {
  return (
    <footer className="border-t border-[#e9d5ff] bg-white px-7 py-12 text-[#1c1033]">
      <div className="mx-auto grid max-w-[1180px] gap-10 text-sm md:grid-cols-[1.6fr_0.75fr]">
        <div>
          <h2 className="mb-4 text-base font-black text-[#1c1033]">Governo do Estado da Paraíba</h2>
          <p className="leading-7 text-[#374151]">
            <strong className="text-[#1c1033]">Gerência Executiva de Formação e Desenvolvimento dos Profissionais da Educação (GEFDP)</strong>
          </p>
          <p className="mt-1 leading-7 text-[#566176]">Secretaria de Estado da Educação - SEE</p>
          <div className="mt-5 border-t border-[#e9d5ff] pt-5 text-[#566176]">
            <p>Centro Administrativo Integrado - Bloco 01 - 3 Andar</p>
            <p>CEP: 58015-900 | João Pessoa/PB</p>
            <a className="font-bold text-[#7336C0] hover:underline" href="http://www.paraiba.pb.gov.br" target="_blank" rel="noreferrer">
              www.paraiba.pb.gov.br
            </a>
          </div>
        </div>

        <div className="grid gap-5">
          <h2 className="text-base font-black text-[#1c1033]">Fale Conosco</h2>
          <div>
            <span className="block text-xs font-black uppercase tracking-wider text-[#a855f7]">E-mail</span>
            <a className="font-bold text-[#1c1033] hover:text-[#7336C0] hover:underline" href="mailto:gefdp@see.pb.gov.br">gefdp@see.pb.gov.br</a>
          </div>
          <div>
            <span className="block text-xs font-black uppercase tracking-wider text-[#a855f7]">Instagram</span>
            <a className="font-bold text-[#1c1033] hover:text-[#7336C0] hover:underline" href="https://instagram.com/educaformapb" target="_blank" rel="noreferrer">@educaformapb</a>
          </div>
          <div className="flex gap-4 pt-1 text-[#566176]">
            <Link className="hover:text-[#7336C0] hover:underline" to="/">Home</Link>
            <Link className="hover:text-[#7336C0] hover:underline" to="/catalogo-cursos">Cursos</Link>
            <Link className="hover:text-[#7336C0] hover:underline" to="/inscricoes">Inscrições</Link>
            <Link className="hover:text-[#7336C0] hover:underline" to="/guia">Guia</Link>
            <Link className="hover:text-[#7336C0] hover:underline" to="/login">Login</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-[1180px] border-t border-[#e9d5ff] pt-6 text-center text-xs text-[#9ca3af]">
        © 2026 Transforma Educação PB · GEFDP · Secretaria de Estado da Educação
      </div>
    </footer>
  )
}
