import { useRef, useState } from 'react'
import { Upload, Trash2, CheckCircle, Image, Palette, Info } from 'lucide-react'
import { useBranding } from '../context/BrandingContext'
import { useAuth } from '../context/AuthContext'

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function UploadCard({ title, description, hint, value, onChange, onRemove, accept, preview = 'image', aspectLabel }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const url = await readFileAsDataURL(file)
    onChange(url)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDrop = e => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div className="card p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
            <CheckCircle size={12} />
            Salvo
          </span>
        )}
      </div>

      {/* Preview */}
      <div
        className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer group ${
          dragging ? 'border-brand-500 bg-brand-50' : value ? 'border-gray-200' : 'border-dashed border-gray-300 hover:border-brand-400 hover:bg-brand-50/40'
        }`}
        style={{ aspectRatio: preview === 'wide' ? '16/9' : preview === 'square' ? '1/1' : '3/1' }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {value ? (
          <>
            <img
              src={value}
              alt={title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <span className="text-white text-xs font-medium flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-lg">
                <Upload size={13} /> Trocar
              </span>
            </div>
            {aspectLabel && (
              <span className="absolute bottom-2 right-2 text-[10px] text-white/70 bg-black/40 px-1.5 py-0.5 rounded">
                {aspectLabel}
              </span>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <Image size={18} className="text-gray-400" />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600">Clique ou arraste a imagem aqui</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          className="btn-secondary text-xs py-2 flex-1 flex items-center justify-center gap-1.5"
        >
          <Upload size={13} />
          {value ? 'Trocar imagem' : 'Escolher arquivo'}
        </button>
        {value && (
          <button
            onClick={onRemove}
            className="px-3 py-2 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1.5"
          >
            <Trash2 size={13} />
            Remover
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept || 'image/*'}
        className="hidden"
        onChange={e => handleFile(e.target.files[0])}
      />
    </div>
  )
}

function LogoPreview({ logo }) {
  return (
    <div className="card p-6">
      <h3 className="font-semibold text-gray-900 text-sm mb-1">Pré-visualização — Sidebar</h3>
      <p className="text-xs text-gray-500 mb-4">Como a logo aparece na barra lateral do sistema.</p>
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: 'linear-gradient(180deg, #2D1B69 0%, #4A2080 100%)' }}
      >
        {logo ? (
          <img src={logo} alt="Logo" className="h-8 object-contain" />
        ) : (
          <div className="text-white font-bold text-xl leading-none">
            <span className="font-light">Trans</span>
            <span className="font-black">FO</span>
            <span className="font-light">r</span>
            <span className="font-black">ma</span>
          </div>
        )}
      </div>
    </div>
  )
}

function LoginPreview({ loginBg, logo }) {
  return (
    <div className="card p-6">
      <h3 className="font-semibold text-gray-900 text-sm mb-1">Pré-visualização — Tela de login</h3>
      <p className="text-xs text-gray-500 mb-4">Miniatura de como ficará a tela de login.</p>
      <div className="rounded-xl overflow-hidden border border-gray-200 flex" style={{ height: 140 }}>
        {/* Left */}
        <div
          className="w-1/2 relative"
          style={loginBg
            ? { backgroundImage: `url(${loginBg})`, backgroundSize: 'cover', backgroundPosition: 'center top' }
            : { background: 'linear-gradient(135deg, #1e0a4a 0%, #2D1B69 40%, #4A2080 100%)' }
          }
        />
        {/* Right */}
        <div className="w-1/2 bg-white flex flex-col items-center justify-center gap-1.5 p-3">
          {logo
            ? <img src={logo} alt="Logo" className="h-6 object-contain" />
            : (
              <div className="text-center leading-none">
                <div className="text-xs font-black" style={{ color: '#4A1878' }}>TransFOrma</div>
                <div className="text-[7px] text-gray-400 tracking-widest">EDUCAÇÃO PB</div>
              </div>
            )
          }
          <div className="w-full mt-1 space-y-1">
            <div className="h-2 bg-gray-100 rounded w-full" />
            <div className="h-2 bg-gray-100 rounded w-full" />
            <div className="h-4 bg-brand-700 rounded w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Aparencia() {
  const { user } = useAuth()
  const { loginBg, setLoginBg, logo, setLogo } = useBranding()

  if (user?.role !== 'administrador') {
    return (
      <div className="card p-12 text-center text-gray-400">
        <Palette size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">Acesso restrito a administradores.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">Aparência</h1>
        <p className="page-subtitle">Personalize a identidade visual do sistema.</p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
        <Info size={16} className="flex-shrink-0 mt-0.5" />
        <p>As imagens são salvas localmente no navegador. Para uso em produção, configure o armazenamento no servidor.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logo upload */}
        <div className="space-y-4">
          <UploadCard
            title="Logo do sistema"
            description="Exibida na barra lateral e na tela de login."
            hint="PNG ou SVG com fundo transparente — altura ideal: 40–60 px"
            value={logo}
            onChange={setLogo}
            onRemove={() => setLogo(null)}
            preview="wide"
            aspectLabel="Logo"
          />
          <LogoPreview logo={logo} />
        </div>

        {/* Login background upload */}
        <div className="space-y-4">
          <UploadCard
            title="Imagem lateral do login"
            description="Painel esquerdo na tela de entrada do sistema."
            hint="JPG ou PNG — proporção recomendada 9:16, mín. 900×1600 px"
            value={loginBg}
            onChange={setLoginBg}
            onRemove={() => setLoginBg(null)}
            preview="wide"
            aspectLabel="Login bg"
          />
          <LoginPreview loginBg={loginBg} logo={logo} />
        </div>
      </div>
    </div>
  )
}
