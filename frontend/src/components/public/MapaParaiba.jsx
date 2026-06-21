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
    <section ref={sectionRef} className="overflow-hidden bg-[#0a0615] px-[22px] py-20">
      <div className="mx-auto max-w-[1180px]">
        {/* Header */}
        <p className="mb-2 text-xs font-black uppercase tracking-[0.3em] text-[#a855f7]">Alcance do programa</p>
        <div className="mb-12 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-[38px] font-black leading-tight text-white">
            Paraíba<br />transformada
          </h2>
          <div className="text-right">
            <span className="block text-[42px] font-black leading-none tabular-nums text-[#c084fc]">
              {totalCount.toLocaleString('pt-BR')}
            </span>
            <span className="text-sm font-semibold uppercase tracking-wider text-white/50">cursistas em todo o estado</span>
          </div>
        </div>

        {/* Mapa + painel lateral */}
        <div className="grid items-center gap-10 lg:grid-cols-[1.4fr_0.6fr]">
          {/* Mapa */}
          <div className="relative">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 5200, center: [-36.75, -7.15] }}
              style={{ width: '100%', height: 'auto' }}
              viewBox="0 0 800 560"
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
                              : '#16052e',
                            stroke: '#0a0615',
                            strokeWidth: 0.6,
                            filter: isActive
                              ? 'drop-shadow(0 0 6px #d946ef) drop-shadow(0 0 14px #a855f7)'
                              : 'none',
                            transition: 'fill 0.35s ease, filter 0.35s ease',
                            cursor: 'pointer',
                            outline: 'none',
                          },
                          hover: {
                            fill: '#d946ef',
                            filter: 'drop-shadow(0 0 5px #a855f7)',
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

          {/* Painel lateral */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#a855f7]">
              {manualActive ? 'Município selecionado' : 'Município em destaque'}
            </p>
            <h3
              key={activeCity?.municipio}
              className="text-[32px] font-black leading-tight text-white transition-all"
              style={{ animation: 'fadeSlideIn 0.4s ease' }}
            >
              {activeCity?.municipio ?? '—'}
            </h3>
            <div className="mt-2">
              <span className="block text-[64px] font-black leading-none tabular-nums text-[#c084fc]">
                {displayCount.toLocaleString('pt-BR')}
              </span>
              <span className="text-sm font-semibold uppercase tracking-wider text-white/50">cursistas</span>
            </div>

            <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-[#2d1b4e]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7336C0] to-[#e879f9] transition-all duration-700"
                style={{ width: `${((activeCity?.quantidade ?? 0) / MAX_QTD) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-white/40">
              em relação ao município com mais cursistas
            </p>

            {!manualActive && (
              <p className="mt-6 text-xs text-white/30">Clique em um município para fixar</p>
            )}
            {manualActive && (
              <button
                type="button"
                onClick={() => setManualActive(false)}
                className="mt-4 w-fit rounded-full border border-[#a855f7]/30 px-4 py-1.5 text-xs font-bold text-[#a855f7] hover:bg-[#a855f7]/10"
              >
                Retomar animação
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  )
}
