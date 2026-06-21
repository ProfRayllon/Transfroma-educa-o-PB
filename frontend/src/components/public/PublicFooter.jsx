import { Link } from 'react-router-dom'

export default function PublicFooter() {
  return (
    <footer className="bg-gradient-to-r from-[#8550e8] to-[#6f35b5] px-7 py-10 text-white">
      <div className="mx-auto grid max-w-[1180px] gap-10 text-sm md:grid-cols-[1.6fr_0.75fr]">
        <div>
          <h2 className="mb-5 text-lg font-black">Governo do Estado da Paraiba</h2>
          <p className="leading-7 text-white/90">
            <strong>Gerencia Executiva de Formacao e Desenvolvimento dos Profissionais da Educacao (GEFDP)</strong>
          </p>
          <p className="mt-2 leading-7 text-white/90">Secretaria de Estado da Educacao - SEE</p>
          <div className="mt-5 border-t border-white/20 pt-5 text-white/90">
            <p>Centro Administrativo Integrado - Bloco 01 - 3 Andar</p>
            <p>CEP: 58015-900 | Joao Pessoa/PB</p>
            <a className="font-bold hover:underline" href="http://www.paraiba.pb.gov.br" target="_blank" rel="noreferrer">
              www.paraiba.pb.gov.br
            </a>
          </div>
        </div>

        <div className="grid gap-5">
          <h2 className="text-lg font-black">Fale Conosco</h2>
          <div>
            <span className="block text-white/80">E-mail</span>
            <a className="font-bold hover:underline" href="mailto:gefdp@see.pb.gov.br">gefdp@see.pb.gov.br</a>
          </div>
          <div>
            <span className="block text-white/80">Instagram</span>
            <a className="font-bold hover:underline" href="https://instagram.com/educaformapb" target="_blank" rel="noreferrer">@educaformapb</a>
          </div>
          <div className="flex gap-3 pt-2 text-white/90">
            <Link className="hover:underline" to="/">Home</Link>
            <Link className="hover:underline" to="/catalogo-cursos">Cursos</Link>
            <Link className="hover:underline" to="/login">Login</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
