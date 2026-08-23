import { ArrowRight, ClipboardCheck, UserCheck, CheckCircle2, XCircle, Circle } from 'lucide-react'
import {
  ROTULOS_PERFIL, dataBr, iniciais, relacaoComPrazo, comCargo,
  situacaoNoCalendario, PONTOS_CALENDARIO,
} from '../../lib/atribuicoes'

/**
 * A situacao como um ponto, e nao como uma etiqueta escrita.
 *
 * E o mesmo ponto do calendario, de proposito: a pessoa aprende a cor uma vez e
 * ela vale nos dois lugares. Numa lista de dez itens, dez etiquetas "Cumprido"
 * competem com os titulos pela atencao -- o ponto informa igual e some quando
 * nao e o que se esta procurando.
 */
export function PontoSituacao({ item, tamanho = 'w-2.5 h-2.5', className = '' }) {
  const { ponto, rotulo } = PONTOS_CALENDARIO[situacaoNoCalendario(item)]
  // `block` nao e enfeite: um <span> nasce inline, e largura e altura nao valem
  // em elemento inline -- sem isso o ponto existe no HTML com tamanho zero e
  // simplesmente nao aparece. No calendario ele escapava disso por acidente,
  // por ser filho direto de um container flex, que converte o filho em bloco.
  return <span title={rotulo} className={`block rounded-full flex-shrink-0 ${tamanho} ${ponto} ${className}`} />
}

/**
 * Quem faz e quem avalia, sempre juntos.
 *
 * Aparece nas tres telas -- a lista da pessoa, a fila do avaliador e o detalhe
 * da coordenacao -- porque a duvida "quem responde por isso?" surge nas tres, e
 * antes so dava para responder abrindo o banco. Na tela da propria pessoa o
 * nome dela continua escrito por extenso em vez de virar "Você": ela costuma
 * conferir a atividade junto com quem atribuiu, e ai os dois leem a mesma coisa.
 */
export function ParDeResponsaveis({ responsavel, avaliador, compacto = false }) {
  const Pessoa = ({ pessoa, papel, icone: Icone }) => (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className={`rounded-full bg-brand-100 text-brand-800 font-bold flex items-center justify-center flex-shrink-0 ${
        compacto ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]'
      }`}>
        {iniciais(pessoa.name)}
      </span>
      <span className="min-w-0">
        <span className={`block font-medium text-gray-700 truncate ${compacto ? 'text-[11px]' : 'text-xs'}`}>
          {pessoa.name}
        </span>
        {!compacto && (
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            <Icone size={9} />
            {papel}
            {ROTULOS_PERFIL[pessoa.role] && <span className="truncate">· {ROTULOS_PERFIL[pessoa.role]}</span>}
          </span>
        )}
      </span>
    </span>
  )

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Pessoa pessoa={responsavel} papel="faz" icone={ClipboardCheck} />
      <ArrowRight size={13} className="text-gray-300 flex-shrink-0" />
      <Pessoa pessoa={avaliador} papel="avalia" icone={UserCheck} />
    </div>
  )
}

/**
 * O caminho da atividade, do nascimento ao fim.
 *
 * Tres etapas, e nao quatro: o prazo nao e um evento, e uma referencia -- entao
 * ele aparece DENTRO da etapa de execucao ("2 dias antes do prazo", "prazo
 * 22/08"), onde de fato ajuda a ler o que aconteceu, em vez de virar mais uma
 * linha na lista.
 *
 * Mostra as etapas ja cumpridas e apenas a PROXIMA pendente. Uma atividade
 * recem-atribuida rende duas linhas, nao quatro caixas vazias -- a pagina da
 * pessoa foi enxugada de proposito e um fluxo sempre completo a encheria de
 * novo.
 */
export function LinhaDoTempo({ item, titulo = 'Fluxo da atividade' }) {
  const atraso = relacaoComPrazo(item)

  const etapas = [
    {
      chave: 'criacao',
      rotulo: 'Atribuída',
      concluida: true,
      quando: dataBr(item.criadoEm),
      detalhe: item.criadoPor ? `por ${comCargo(item.criadoPor)}` : null,
      tom: 'neutro',
    },
    {
      chave: 'execucao',
      rotulo: item.checkinEm ? 'Marcada como feita' : 'Marcar como feita',
      concluida: Boolean(item.checkinEm),
      quando: item.checkinEm ? dataBr(item.checkinEm) : null,
      detalhe: item.checkinEm
        ? (atraso ? atraso.texto : `por ${comCargo(item.responsavel)}`)
        : (item.prazo ? `prazo ${dataBr(item.prazo)}` : 'sem prazo definido'),
      tom: atraso?.atrasado ? 'alerta' : 'neutro',
    },
    {
      chave: 'avaliacao',
      rotulo: item.avaliacao
        ? (item.avaliacao === 'cumprido' ? 'Avaliada: cumprida' : 'Avaliada: não cumprida')
        : 'Avaliação',
      concluida: Boolean(item.avaliadoEm),
      quando: item.avaliadoEm ? dataBr(item.avaliadoEm) : null,
      detalhe: item.avaliadoEm ? `por ${comCargo(item.avaliador)}` : `aguarda ${comCargo(item.avaliador)}`,
      tom: item.avaliacao === 'nao_cumprido' ? 'ruim' : item.avaliacao === 'cumprido' ? 'bom' : 'neutro',
    },
  ]

  const primeiraPendente = etapas.findIndex((etapa) => !etapa.concluida)
  const visiveis = primeiraPendente === -1 ? etapas : etapas.slice(0, primeiraPendente + 1)

  const cores = {
    bom: 'text-green-600',
    ruim: 'text-red-600',
    alerta: 'text-amber-600',
    neutro: 'text-brand-600',
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">{titulo}</p>
      <ol className="space-y-0">
        {visiveis.map((etapa, indice) => {
          const ultima = indice === visiveis.length - 1
          const Icone = !etapa.concluida ? Circle : etapa.tom === 'ruim' ? XCircle : CheckCircle2
          return (
            <li key={etapa.chave} className="flex gap-2.5">
              {/* O trilho e o icone: a linha so desce enquanto houver proxima
                  etapa, senao sobraria um risco apontando para o vazio. */}
              <div className="flex flex-col items-center flex-shrink-0">
                <Icone
                  size={14}
                  className={etapa.concluida ? cores[etapa.tom] : 'text-gray-300'}
                  strokeWidth={etapa.concluida ? 2.2 : 2}
                />
                {!ultima && <span className="w-px flex-1 bg-gray-200 my-0.5" />}
              </div>
              <div className={`min-w-0 ${ultima ? '' : 'pb-3'}`}>
                <p className={`text-xs font-medium leading-tight ${etapa.concluida ? 'text-gray-800' : 'text-gray-400'}`}>
                  {etapa.rotulo}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {etapa.quando && <span className="tabular-nums">{etapa.quando}</span>}
                  {etapa.quando && etapa.detalhe && <span className="text-gray-300"> · </span>}
                  {etapa.detalhe && (
                    <span className={etapa.tom === 'alerta' && etapa.concluida ? 'text-amber-700 font-medium' : ''}>
                      {etapa.detalhe}
                    </span>
                  )}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
