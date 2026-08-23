import { useMemo } from 'react'
import { rotuloMes, situacaoNoCalendario, PONTOS_CALENDARIO } from '../../lib/atribuicoes'

const DIAS_DA_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/**
 * O mês em uma grade, com um ponto por prazo.
 *
 * Responde de relance a pergunta que a lista responde item por item: "o que
 * vence quando, e o que ja passou". Clicar num dia seleciona a atividade
 * daquele prazo, entao o calendario tambem serve de atalho para o fluxo ao
 * lado -- e nao vira mais um lugar que so mostra e nao leva a nada.
 *
 * Atividade sem prazo nao aparece na grade, e sim contada embaixo: espalhar
 * "sem prazo" por algum dia inventado faria o calendario mentir.
 */
export default function CalendarioDoMes({ mes, itens, selecionadaId, onSelecionar }) {
  const { semanas, porDia, semPrazo, hoje } = useMemo(() => {
    const [ano, numero] = mes.split('-').map(Number)
    const primeiro = new Date(ano, numero - 1, 1)
    const totalDias = new Date(ano, numero, 0).getDate()

    const mapa = new Map()
    const soltas = []
    for (const item of itens) {
      if (!item.prazo) { soltas.push(item); continue }
      const dia = Number(item.prazo.slice(8, 10))
      if (!mapa.has(dia)) mapa.set(dia, [])
      mapa.get(dia).push(item)
    }

    // A grade sempre começa no domingo: as células vazias antes do dia 1 são o
    // que mantém cada coluna alinhada ao seu dia da semana.
    const celulas = Array(primeiro.getDay()).fill(null)
    for (let dia = 1; dia <= totalDias; dia += 1) celulas.push(dia)
    while (celulas.length % 7 !== 0) celulas.push(null)

    const linhas = []
    for (let i = 0; i < celulas.length; i += 7) linhas.push(celulas.slice(i, i + 7))

    const agora = new Date()
    const ehMesCorrente = agora.getFullYear() === ano && agora.getMonth() === numero - 1

    return {
      semanas: linhas,
      porDia: mapa,
      semPrazo: soltas,
      hoje: ehMesCorrente ? agora.getDate() : null,
    }
  }, [mes, itens])

  // Só as legendas que aparecem de fato neste mês: uma legenda com cinco linhas
  // fixas ensina cores que a pessoa talvez nunca veja.
  const legendasUsadas = useMemo(() => {
    const presentes = new Set(itens.filter((i) => i.prazo).map(situacaoNoCalendario))
    return Object.entries(PONTOS_CALENDARIO).filter(([chave]) => presentes.has(chave))
  }, [itens])

  return (
    <div className="card">
      <p className="text-sm font-semibold text-gray-800 mb-3">{rotuloMes(mes)}</p>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {DIAS_DA_SEMANA.map((letra, indice) => (
          <span key={indice} className="text-[10px] font-medium text-gray-400 pb-1">{letra}</span>
        ))}

        {semanas.flat().map((dia, indice) => {
          if (!dia) return <span key={`vazio-${indice}`} />

          const doDia = porDia.get(dia) || []
          const temSelecionada = doDia.some((item) => item.id === selecionadaId)
          const clicavel = doDia.length > 0

          return (
            <button
              key={dia}
              type="button"
              disabled={!clicavel}
              onClick={() => clicavel && onSelecionar(doDia[0].id)}
              title={doDia.map((item) => item.titulo).join('\n') || undefined}
              className={`h-9 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors ${
                temSelecionada ? 'bg-brand-100 ring-1 ring-brand-300' : clicavel ? 'hover:bg-gray-100' : ''
              } ${clicavel ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className={`text-[11px] leading-none ${
                dia === hoje ? 'font-bold text-brand-700' : clicavel ? 'font-medium text-gray-700' : 'text-gray-300'
              }`}>
                {dia}
              </span>
              {doDia.length > 0 && (
                <span className="flex items-center justify-center gap-0.5 h-2">
                  {doDia.slice(0, 3).map((item) => (
                    <span
                      key={item.id}
                      className={`w-1.5 h-1.5 rounded-full ${PONTOS_CALENDARIO[situacaoNoCalendario(item)].ponto}`}
                    />
                  ))}
                  {doDia.length > 3 && <span className="text-[8px] text-gray-400 leading-none">+</span>}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {legendasUsadas.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid gap-1">
          {legendasUsadas.map(([chave, { ponto, rotulo }]) => (
            <span key={chave} className="flex items-center gap-2 text-[11px] text-gray-500">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ponto}`} />
              {rotulo}
            </span>
          ))}
        </div>
      )}

      {semPrazo.length > 0 && (
        <p className="text-[11px] text-gray-400 mt-3 pt-3 border-t border-gray-100">
          {semPrazo.length} atividade{semPrazo.length !== 1 ? 's' : ''} sem prazo — vale até o fim do mês.
        </p>
      )}
    </div>
  )
}
