import { useEffect, useRef, useState, useMemo } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import municipiosPB from '../../data/municipiosPB'

const GEO_URL =
  'https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-25-mun.json'

const TOTAL = municipiosPB.reduce((s, m) => s + m.quantidade, 0)
const MAX_QTD = municipiosPB[0].quantidade // já está ordenado desc

// Normaliza nome para comparação (remove acentos, lower)
const norm = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['']/g, "'")
    .trim()

// Mapeia nome normalizado → dados
const dataMap = Object.fromEntries(municipiosPB.map((m) => [norm(m.municipio), m]))

// Cor roxa baseada na quantidade (gradiente de intensidade)
function purpleFor(quantidade) {
  const ratio = Math.sqrt(quantidade / MAX_QTD)
  const r = Math.round(80 + ratio * 100)
  const g = Math.round(20 + ratio * 30)
  const b = Math.round(160 + ratio * 80)
  return `rgb(${r},${g},${b})`
}

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target === 0) { setValue(0); return }
    let raf
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * ease))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

export default function MapaParaiba() {
  const sectionRef = useRef(null)
  const [litSet, setLitSet] = useState(new Set())
  const [activeCity, setActiveCity] = useState(municipiosPB[0])
  const [manualActive, setManualActive] = useState(false)
  const started = useRef(false)

  // Ordem de animação: maior → menor
  const animOrder = useMemo(() => [...municipiosPB].sort((a, b) => b.quantidade - a.quantidade), [])

  // Inicia animação quando seção entra na viewport
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          let i = 0
          const STEP = 55 // ms entre cada município

          const tick = () => {
            if (i >= animOrder.length) return
            const city = animOrder[i]
            setLitSet((prev) => new Set([...prev, norm(city.municipio)]))
            if (!manualActive) setActiveCity(city)
            i++
            setTimeout(tick, STEP)
          }
          tick()
        }
      },
      { threshold: 0.2 },
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [animOrder, manualActive])

  const displayCount = useCountUp(activeCity?.quantidade ?? 0)
  const totalCount = useCountUp(litSet.size > 0 ? TOTAL : 0, 12000)

  return (
    <section ref={sectionRef} className="overflow-hidden bg-[#0a0615] px-[22px] pb-16 pt-14">
      <div className="mx-auto max-w-[1240px]">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-black uppercase tracking-[0.3em] text-[#a855f7]">Alcance do programa</p>
            <h2 className="text-[38px] font-black leading-tight text-white">
              Paraíba transformada
            </h2>
          </div>
          <div className="text-right">
            <span className="block text-[48px] font-black leading-none tabular-nums text-[#c084fc]">
              {totalCount.toLocaleString('pt-BR')}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">cursistas em todo o estado</span>
          </div>
        </div>

        {/* Mapa + painel lateral */}
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_320px]">
          {/* Mapa — ocupa quase toda a largura */}
          <div className="relative overflow-hidden rounded-2xl border border-[#2d1b4e] bg-[#0e0425]"
               style={{ boxShadow: '0 0 60px rgba(168,85,247,.18)' }}>
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 10500, center: [-36.75, -7.2] }}
              style={{ width: '100%', height: 'auto', display: 'block' }}
              viewBox="0 0 900 620"
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const geoName = geo.properties.name || geo.properties.NM_MUN || ''
                    const key = norm(geoName)
                    const isLit = litSet.has(key)
                    const isActive = norm(activeCity?.municipio ?? '') === key
                    const cityData = dataMap[key]

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onClick={() => {
                          if (cityData) {
                            setActiveCity(cityData)
                            setManualActive(true)
                          }
                        }}
                        style={{
                          default: {
                            fill: isActive
                              ? '#e879f9'
                              : isLit
                              ? purpleFor(cityData?.quantidade ?? 1)
                              : '#1a0535',
                            stroke: '#0a0615',
                            strokeWidth: 0.5,
                            filter: isActive
                              ? 'drop-shadow(0 0 8px #d946ef) drop-shadow(0 0 20px #a855f7)'
                              : 'none',
                            transition: 'fill 0.3s ease, filter 0.3s ease',
                            cursor: 'pointer',
                            outline: 'none',
                          },
                          hover: {
                            fill: '#d946ef',
                            filter: 'drop-shadow(0 0 6px #a855f7)',
                            outline: 'none',
                          },
                          pressed: { fill: '#c026d3', outline: 'none' },
                        }}
                      />
                    )
                  })
                }
              </Geographies>
            </ComposableMap>
          </div>

          {/* Painel lateral — fixo à direita */}
          <div className="flex flex-col gap-3 rounded-2xl border border-[#2d1b4e] bg-[#0e0425] p-7"
               style={{ boxShadow: '0 0 40px rgba(168,85,247,.12)' }}>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#a855f7]">
              {manualActive ? 'Selecionado' : 'Em destaque'}
            </p>
            <h3
              key={activeCity?.municipio}
              className="text-[28px] font-black leading-tight text-white"
              style={{ animation: 'fadeSlideIn 0.35s ease' }}
            >
              {activeCity?.municipio ?? '—'}
            </h3>

            <div className="mt-1">
              <span className="block text-[58px] font-black leading-none tabular-nums text-[#c084fc]">
                {displayCount.toLocaleString('pt-BR')}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-white/50">cursistas</span>
            </div>

            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#1a0535]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7336C0] to-[#e879f9] transition-all duration-700"
                style={{ width: `${((activeCity?.quantidade ?? 0) / MAX_QTD) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-white/35">vs maior município do estado</p>

            <div className="mt-4 border-t border-[#2d1b4e] pt-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-white/30">Total no estado</p>
              <span className="text-[22px] font-black tabular-nums text-[#7c3aed]">
                {totalCount.toLocaleString('pt-BR')}
              </span>
              <span className="ml-1 text-xs text-white/40">cursistas</span>
            </div>

            {!manualActive ? (
              <p className="mt-2 text-[10px] text-white/25">Clique em um município para fixar</p>
            ) : (
              <button
                type="button"
                onClick={() => setManualActive(false)}
                className="mt-3 w-fit rounded-full border border-[#a855f7]/30 px-4 py-1.5 text-[11px] font-bold text-[#a855f7] hover:bg-[#a855f7]/10 transition"
              >
                Retomar animação
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  )
}
