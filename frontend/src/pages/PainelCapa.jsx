import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Settings } from 'lucide-react'

/**
 * A capa do Dashboard.
 *
 * Três painéis, três perguntas diferentes: quem concluiu, como os cursos estão
 * andando, e o que o próprio sistema registra. Antes tudo isso morava numa tela
 * só, e a consequência era previsível -- quem entrava para ver a conclusão
 * passava por dez gráficos que não tinham a ver com a pergunta dele.
 *
 * Cada cartão é a arte inteira, e o clique é na arte: título, texto, número e
 * botão vêm desenhados dentro da imagem. Foi a escolha da coordenação, para a
 * tela ficar idêntica à referência aprovada.
 *
 * O que isso custa, para quem mexer aqui depois saber:
 *   - o número dentro da arte é fixo. Ele não acompanha o banco, e fica velho
 *     em silêncio -- trocar exige refazer a imagem;
 *   - o texto não é texto: não é lido por leitor de tela nem encontrado por
 *     busca. Por isso o `alt` de cada imagem repete o que está escrito nela,
 *     que é o que dá nome ao link;
 *   - a arte é clara nos três. No modo escuro ela continua clara, porque é uma
 *     imagem e não um componente que responde ao tema.
 */

const PAINEIS = [
  {
    slug: 'concluintes',
    para: '/painel/concluintes',
    titulo: 'Docentes Concluintes',
    // O alt é o nome do link para quem navega por leitor de tela. Descreve o
    // destino, e não a figura: "capelo roxo com barras" não ajudaria ninguém a
    // decidir se é ali que quer entrar.
    alt: 'Docentes Concluintes — quantos profissionais concluíram cada curso, com o recorte por regional e por curso.',
  },
  {
    slug: 'progresso',
    para: '/painel/progresso',
    titulo: 'Consolidado do Curso',
    alt: 'Consolidado do Curso — procura, inscrições e a avaliação que os cursistas fizeram de cada curso.',
  },
  {
    slug: 'sistema',
    para: '/painel/sistema',
    titulo: 'Dados do Sistema',
    alt: 'Dados do Sistema — base de profissionais, acessos e perfil da rede, direto da plataforma.',
  },
]

/* As artes foram exportadas neste tamanho; declarar aqui evita a tela pular
   quando elas terminam de baixar. */
const LARGURA = 1060
const ALTURA = 1413

function Cartao({ painel, ordem }) {
  const [semArte, setSemArte] = useState(false)

  return (
    <Link
      to={painel.para}
      className="group block rounded-3xl animate-cena transition-transform duration-300
                 hover:-translate-y-1 focus:outline-none focus-visible:ring-2
                 focus-visible:ring-brand-500 focus-visible:ring-offset-4
                 dark:focus-visible:ring-offset-gray-900"
      style={{ animationDelay: `${ordem * 90}ms` }}
    >
      {semArte ? (
        /* A arte não carregou. Um cartão de texto no lugar mantém a capa
           utilizável -- três ícones de imagem quebrada não levariam a lugar
           nenhum. */
        <span className="card flex flex-col items-start justify-between gap-6 h-full min-h-[280px]">
          <span>
            <span className="block text-xl font-bold text-gray-900 dark:text-gray-50">
              {painel.titulo}
            </span>
            <span className="block text-sm mt-2 text-gray-600 dark:text-gray-400">
              {painel.alt.split('—')[1]?.trim()}
            </span>
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
            Acessar painel <ArrowRight size={16} />
          </span>
        </span>
      ) : (
        <picture>
          {/* WebP primeiro: a mesma arte pesa cerca de um décimo do PNG, e a
              capa carrega as três de uma vez. O PNG fica de reserva. */}
          <source srcSet={`/images/painel/${painel.slug}.webp`} type="image/webp" />
          <img
            src={`/images/painel/${painel.slug}.png`}
            alt={painel.alt}
            width={LARGURA}
            height={ALTURA}
            onError={() => setSemArte(true)}
            /* A arte cresce com a coluna e para antes de forçar rolagem: ela é
               retrato 3:4, e três delas em largura cheia passariam da altura da
               tela -- e aí a centralização vertical não teria o que centrar.
               A sombra é drop-shadow, e não box-shadow: os cantos da arte são
               transparentes, e a sombra de caixa apareceria como um retângulo
               por trás do cartão arredondado. */
            className="w-auto max-w-full mx-auto h-auto max-h-[calc(100vh-15rem)]
                       transition-[filter] duration-300
                       drop-shadow-sm group-hover:drop-shadow-xl"
          />
        </picture>
      )}
    </Link>
  )
}

export default function PainelCapa() {
  return (
    /* A capa ocupa a altura útil inteira -- 100vh menos o p-6 do Layout -- para
       que as artes tenham onde se centrar verticalmente. Sem isso a coluna teria
       exatamente a altura do conteúdo, e centrar na vertical não moveria nada. */
    <div className="animate-fade-in flex flex-col min-h-[calc(100vh-3rem)]">
      {/* Cabeçalho encostado à esquerda; as artes é que ficam centradas. Os dois
          centrados deixariam a página inteira simétrica e sem entrada -- o olho
          precisa de um canto por onde começar. */}
      <div className="mb-8 shrink-0 relative">
        {/* A engrenagem leva ao envio das planilhas. Discreta, no canto: é
            ferramenta de quem alimenta o painel, não parte do que o painel mostra. */}
        <Link
          to="/painel/planilhas"
          title="Planilhas dos painéis"
          aria-label="Planilhas dos painéis"
          className="absolute right-0 top-0 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                     text-gray-500 hover:text-brand-700 hover:border-brand-300 dark:hover:text-brand-300
                     transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Settings size={17} />
        </Link>
        <p className="text-[11.5px] font-semibold tracking-[0.18em] uppercase pr-12
                      text-brand-600 dark:text-brand-400">
          Dados que impulsionam a educação
        </p>
        <h1 className="text-[34px] sm:text-[40px] font-bold leading-tight mt-1.5 text-balance
                       text-gray-900 dark:text-gray-50">
          Painéis de Acompanhamento
        </h1>
        <p className="text-[15px] mt-2 max-w-2xl text-gray-600 dark:text-gray-400">
          Escolha por onde deseja visualizar os dados e tenha insights para fortalecer a formação.
        </p>
      </div>

      {/* flex-1 + items-center: as artes ficam no meio do que sobrou depois do
          cabeçalho, na vertical, e o mx-auto da grade as centra na horizontal. */}
      <div className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-[1500px] mx-auto">
          {PAINEIS.map((p, i) => (
            <Cartao key={p.slug} painel={p} ordem={i + 1} />
          ))}
        </div>
      </div>
    </div>
  )
}
