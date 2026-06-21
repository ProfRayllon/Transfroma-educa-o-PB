import { useRef, useState } from 'react'
import { User, Mail, Hash, Shield, Briefcase, Calendar, Lock, CheckCircle, Edit2, Eye, EyeOff, Camera, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAvatar } from '../context/AvatarContext'
import api, { getApiErrorMessage } from '../lib/api'

const ROLE_LABELS = {
  administrador: 'Administrador',
  coordenador: 'Coordenador',
  supervisor: 'Supervisor',
  professor: 'Professor',
  tutor: 'Tutor',
  tecnico: 'Apoio tecnico',
  gestao: 'Gestao de Pessoas',
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-brand-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-500">{label}</div>
        <div className="text-sm font-medium text-gray-800 mt-0.5">{value || '-'}</div>
      </div>
    </div>
  )
}

function ChangePasswordSection() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!form.current) { setError('Informe a senha atual.'); return }
    if (form.next !== form.confirm) { setError('As senhas nao coincidem.'); return }
    if (form.next.length < 8) { setError('A nova senha deve ter ao menos 8 caracteres.'); return }

    try {
      setSaving(true)
      await api.patch('/auth/me/password', {
        currentPassword: form.current,
        newPassword: form.next,
      })
      setSuccess(true)
      setForm({ current: '', next: '', confirm: '' })
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Nao foi possivel alterar a senha.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {['current', 'next', 'confirm'].map((field, i) => {
        const show = i === 0 ? showCurrent : showNext
        const setShow = i === 0 ? setShowCurrent : setShowNext
        const labels = ['Senha atual', 'Nova senha', 'Confirmar nova senha']

        return (
          <div key={field}>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{labels[i]}</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                name={field}
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))}
                type={show ? 'text' : 'password'}
                className="input-field pl-9 pr-9"
                placeholder={i === 0 ? 'Senha atual' : 'Minimo de 8 caracteres'}
              />
              {i < 2 && (
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              )}
            </div>
          </div>
        )
      })}
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <CheckCircle size={14} />
          Senha alterada com sucesso.
        </div>
      )}
      <button type="submit" className="btn-primary" disabled={saving}>
        <Lock size={14} />
        {saving ? 'Alterando...' : 'Alterar senha'}
      </button>
    </form>
  )
}

export default function Perfil() {
  const { user } = useAuth()
  const { photo, setPhoto, saving: photoSaving, error: photoError } = useAvatar()
  const inputRef = useRef(null)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' })
  const [saved, setSaved] = useState(false)
  const [photoSaved, setPhotoSaved] = useState(false)

  const initials = user?.name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'U'

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = async e => {
      try {
        await setPhoto(e.target.result)
        setPhotoSaved(true)
        setTimeout(() => setPhotoSaved(false), 3000)
      } catch {
        setPhotoSaved(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = async () => {
    try {
      await setPhoto(null)
      setPhotoSaved(false)
    } catch {
      setPhotoSaved(false)
    }
  }

  const handleSave = () => {
    setSaved(true)
    setEditMode(false)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title">Meu Perfil</h1>
        <p className="page-subtitle">Gerencie suas informacoes pessoais e configuracoes de conta.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <div className="card">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-5">
              <div className="relative group">
                {photo ? (
                  <img
                    src={photo}
                    alt={user?.name}
                    className="w-20 h-20 rounded-2xl object-cover ring-2 ring-brand-200"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-brand-700 text-white text-2xl font-bold flex items-center justify-center ring-2 ring-brand-200">
                    {initials}
                  </div>
                )}
                <button
                  onClick={() => inputRef.current?.click()}
                  className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Camera size={20} className="text-white" />
                </button>
              </div>

              <div>
                <h2 className="text-lg font-bold text-gray-900">{user?.name}</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700 border border-brand-200 mt-1">
                  <Shield size={11} />
                  {ROLE_LABELS[user?.role] || user?.role}
                </span>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => inputRef.current?.click()}
                    disabled={photoSaving}
                    className="text-xs font-medium text-brand-700 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Camera size={12} />
                    {photoSaving ? 'Salvando...' : photo ? 'Trocar foto' : 'Adicionar foto'}
                  </button>
                  {photo && (
                    <button
                      onClick={handleRemovePhoto}
                      disabled={photoSaving}
                      className="text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={12} />
                      Remover
                    </button>
                  )}
                  {photoSaved && (
                    <span className="text-xs text-green-700 flex items-center gap-1">
                      <CheckCircle size={12} />
                      Foto salva!
                    </span>
                  )}
                  {photoError && (
                    <span className="text-xs text-red-600">
                      {photoError}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button onClick={() => setEditMode(!editMode)} className="btn-secondary text-sm">
              <Edit2 size={14} />
              {editMode ? 'Cancelar' : 'Editar'}
            </button>
          </div>

          {saved && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2 mt-4">
              <CheckCircle size={14} />
              Perfil atualizado com sucesso.
            </div>
          )}

          {editMode ? (
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome completo</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">E-mail</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" className="input-field" />
              </div>
              <button onClick={handleSave} className="btn-primary">
                <CheckCircle size={14} />
                Salvar alteracoes
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <InfoRow icon={User} label="Nome completo" value={user?.name} />
              <InfoRow icon={Mail} label="E-mail" value={user?.email} />
              <InfoRow icon={Hash} label="Matricula" value={user?.registration} />
              <InfoRow icon={Shield} label="Perfil de acesso" value={ROLE_LABELS[user?.role]} />
              <InfoRow icon={Briefcase} label="Atuacao" value={user?.function} />
              <InfoRow icon={Briefcase} label="Area" value={user?.area} />
              <InfoRow icon={Calendar} label="Membro desde" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : null} />
            </div>
          )}

          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
        </div>

        <div className="space-y-5">
          <div className="card">
            <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Lock size={16} className="text-brand-700" />
              Alterar senha
            </h2>
            <ChangePasswordSection />
          </div>

          <div className="card bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center">
                <Calendar size={16} className="text-brand-700" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Ultimo acesso</div>
                <div className="text-sm font-medium text-gray-700">
                  {user?.lastAccess
                    ? new Date(user.lastAccess).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
                    : 'Primeiro acesso'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
