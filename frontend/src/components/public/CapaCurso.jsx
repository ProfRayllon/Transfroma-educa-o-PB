import { useState } from 'react'
import { nomeTrilha } from '../../lib/curso'

// Acima desta diferenca de proporcao, preencher o quadro cortaria tanto da arte
// que o resultado deixa de ser reconhecivel. 1.6 cobre o caso real: um banner
// 1920x758 (proporcao 2,53) perderia 60% das laterais num quadrado.
const LIMITE_PROPORCAO = 1.6

/**
 * Capa do curso.
 *
 * A area e quadrada porque a arte dos cursos e quadrada, e assim ela entra
 * praticamente sem corte. Mas o cadastro aceita qualquer imagem, e ja existem
 * banners deitados cadastrados -- num quadro quadrado eles virariam um pedaco
 * do meio, sem logo e sem rosto.
 *
 * Por isso o encaixe e decidido depois que a imagem carrega, comparando a
 * proporcao real com a do quadro: arte proxima do quadrado preenche (cover),
 * imagem muito fora aparece inteira (contain) sobre o roxo do tema. Nenhuma
 * capa fica irreconhecivel, seja qual for o formato enviado.
 */
export default function CapaCurso({ curso, className = '' }) {
  const [falhou, setFalhou] = useState(false)
  const [encaixe, setEncaixe] = useState('cover')

  const aoCarregar = (evento) => {
    const { naturalWidth: largura, naturalHeight: altura } = evento.currentTarget
    if (!largura || !altura) return
    const proporcao = largura / altura
    const distancia = proporcao > 1 ? proporcao : 1 / proporcao
    if (distancia > LIMITE_PROPORCAO) setEncaixe('contain')
  }

  if (!curso.hasImage || falhou) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-[#4A238A] via-[#6f35b5] to-[#a855f7] p-5 ${className}`}>
        <span className="text-center text-[13px] font-black uppercase leading-tight tracking-wider text-white/85">
          {nomeTrilha(curso.trail)}
        </span>
      </div>
    )
  }

  // O `?v=` faz a URL mudar quando a capa muda. A rota da imagem manda cache de
  // 24h e o endereco depende so do id do curso: sem isto, quem ja visitou o site
  // continuaria vendo a capa antiga por um dia, servida do proprio cache.
  const src = `/api/publico/cursos/${curso.id}/imagem${curso.imageVersion ? `?v=${curso.imageVersion}` : ''}`

  return (
    <div className={`h-full w-full ${encaixe === 'contain' ? 'bg-[#f6f2fc]' : ''} ${className}`}>
      <img
        src={src}
        alt=""
        loading="lazy"
        onLoad={aoCarregar}
        onError={() => setFalhou(true)}
        className={`h-full w-full transition duration-500 group-hover:scale-[1.03] ${
          encaixe === 'contain' ? 'object-contain' : 'object-cover object-top'
        }`}
      />
    </div>
  )
}
