import { useEffect } from 'react'
import { Download, ExternalLink, X } from 'lucide-react'

/**
 * PDF em tela cheia, por cima da pagina, com a opcao de baixar.
 *
 * Usa o leitor de PDF do proprio navegador dentro de um iframe: zoom, busca e
 * paginacao vem prontos, sem biblioteca. O arquivo e do mesmo dominio e o
 * nginx nao manda X-Frame-Options para ele, entao o iframe carrega.
 *
 * No celular, alguns navegadores (o Chrome do Android, principalmente) nao
 * desenham PDF dentro de iframe. Por isso a barra sempre oferece "Baixar" e
 * "Abrir em nova aba", e o rodape avisa -- a pessoa nunca fica sem caminho.
 */
export default function VisualizadorPdf({ arquivo, titulo, aoFechar }) {
  useEffect(() => {
    if (!arquivo) return undefined
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const aoTeclar = (e) => { if (e.key === 'Escape') aoFechar() }
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.body.style.overflow = anterior
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [arquivo, aoFechar])

  if (!arquivo) return null

  const nomeDoArquivo = arquivo.split('/').pop()
  const botao = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-[60] flex flex-col bg-[#1c1033]/80 p-2 backdrop-blur-sm sm:p-4"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      onClick={(e) => { if (e.target === e.currentTarget) aoFechar() }}
    >
      <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ede7f6] bg-[#faf7ff] px-4 py-2.5">
          <h2 className="min-w-0 truncate text-base font-black text-[#1c1033]">{titulo}</h2>
          <div className="flex items-center gap-1.5">
            <a href={arquivo} download={nomeDoArquivo} className={`${botao} bg-[#6f35b5] text-white hover:bg-[#5a2b94]`}>
              <Download size={15} /> Baixar
            </a>
            <a
              href={arquivo}
              target="_blank"
              rel="noreferrer"
              className={`${botao} text-[#6f35b5] hover:bg-[#f3e8ff]`}
            >
              <ExternalLink size={15} /> Nova aba
            </a>
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar"
              className="rounded-lg p-2 text-[#566176] transition hover:bg-[#f3e8ff] hover:text-[#1c1033]"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <iframe src={`${arquivo}#view=FitH`} title={titulo} className="min-h-0 w-full flex-1 bg-[#f4f4f5]" />

        <p className="border-t border-[#ede7f6] px-4 py-2 text-center text-xs text-[#566176]">
          O documento não apareceu? Use <strong>Baixar</strong> ou abra em uma nova aba.
        </p>
      </div>
    </div>
  )
}
