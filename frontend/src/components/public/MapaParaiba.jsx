import { useEffect, useRef, useState, useCallback } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import gresPB from '../../data/gresPB'

const GEO_URL =
  'https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-25-mun.json'

const norm = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['']/g, "'").trim()

// Lookup pré-computado: normName → índice da GRE (0-15)
const normToGRE = {}
gresPB.forEach((gre, gi) => {
  gre.municipios.forEach((m) => {
    const k = norm(m)
    if (!(k in normToGRE)) normToGRE[k] = gi
  })
})

const BRAND = '#7336C1'
const GRAY  = '#dcd8eb'
const NEON  = `drop-shadow(0 0 5px ${BRAND}) drop-shadow(0 0 12px rgba(115,54,193,0.55))`

function approxLabel(n) {
  if (!n) return '+0'
  const round = n >= 2000 ? 1000 : n >= 400 ? 100 : 50
  return '+' + (Math.round(n / round) * round).toLocaleString('pt-BR')
}

export default function MapaParaiba() {
  const sectionRef  = useRef(null)
  const intervalRef = useRef(null)
  const [activeGRE, setActiveGRE] = useState(-1)

  const startLoop = useCallback(() => {
    if (intervalRef.current) return
    let gi = 0
    setActiveGRE(gi)
    intervalRef.current = setInterval(() => {
      gi = (gi + 1) % gresPB.length
      setActiveGRE(gi)
    }, 1500)
  }, [])

  // Limpa intervalo ao desmontar
  useEffect(() => () => clearInterval(intervalRef.current), [])

  // Inicia quando a seção entra na viewport
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) startLoop() },
      { threshold: 0.2 },
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [startLoop])

  const gre = activeGRE >= 0 ? gresPB[activeGRE] : null

  return (
    <section ref={sectionRef} className="overflow-hidden bg-white px-[22px] pb-16 pt-14">
      <div className="mx-auto max-w-[1240px]">
        {/* Título */}
        <div className="mb-8">
          <p className="mb-1 text-xs font-black uppercase tracking-[0.3em] text-[#7336C1]">
            Alcance do programa
          </p>
          <h2 className="text-[38px] font-black leading-tight text-[#1c1033]">
            Paraíba transformada
          </h2>
        </div>

        {/* Mapa + painel */}
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_240px]">
          {/* Mapa — fundo transparente, somente GRE ativa acende */}
          <div style={{ overflow: 'visible' }}>
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 10500, center: [-36.75, -7.25] }}
              style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
              viewBox="30 60 840 440"
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const key      = norm(geo.properties.name || geo.properties.NM_MUN || '')
                    const isActive = normToGRE[key] === activeGRE
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        style={{
                          default: {
                            fill:        isActive ? BRAND : GRAY,
                            stroke:      isActive ? BRAND : GRAY,
                            strokeWidth: 0.3,
                            filter:      isActive ? NEON : 'none',
                            transition:  'fill 0.55s ease, stroke 0.55s ease, filter 0.55s ease',
                            outline:     'none',
                          },
                          hover:   { fill: '#5b1fa8', stroke: '#5b1fa8', outline: 'none' },
                          pressed: { fill: '#4a1882', stroke: '#4a1882', outline: 'none' },
                        }}
                      />
                    )
                  })
                }
              </Geographies>
            </ComposableMap>
          </div>

          {/* Painel lateral */}
          <div className="flex min-h-[200px] flex-col justify-center gap-3">
            {gre ? (
              <>
                <p
                  key={activeGRE + '-label'}
                  className="text-[13px] font-black uppercase tracking-[0.3em] text-[#7336C1]"
                  style={{ animation: 'fadeUp 0.3s ease both' }}
                >
                  {gre.gre}
                </p>
                <h3
                  key={activeGRE + '-sede'}
                  className="text-[42px] font-black leading-tight text-[#1c1033]"
                  style={{ animation: 'fadeUp 0.4s ease both' }}
                >
                  {gre.sede}
                </h3>
                <div key={activeGRE + '-val'} style={{ animation: 'fadeUp 0.5s ease both' }}>
                  <span className="block text-[76px] font-black leading-none tabular-nums text-[#7336C1]">
                    {approxLabel(gre.total)}
                  </span>
                  <span className="text-[13px] font-semibold uppercase tracking-wider text-gray-400">
                    inscrições
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7336C1]" />
                <span className="text-[11px] text-gray-400">carregando…</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  )
}
