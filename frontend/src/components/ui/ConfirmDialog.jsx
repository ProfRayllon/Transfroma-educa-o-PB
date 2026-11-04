import Modal from './Modal'
import { AlertTriangle, Play } from 'lucide-react'

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', variant = 'danger' }) {
  const btnClass = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : variant === 'success'
      ? 'bg-green-600 hover:bg-green-700 text-white'
      : 'bg-brand-800 hover:bg-brand-900 text-white'
  // Publicar nao e alerta: a variante de sucesso troca o triangulo vermelho
  // por um "play" verde.
  const sucesso = variant === 'success'

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${sucesso ? 'bg-green-100' : 'bg-red-100'}`}>
          {sucesso ? <Play size={18} className="text-green-600" /> : <AlertTriangle size={18} className="text-red-600" />}
        </div>
        <p className="text-sm text-gray-600 pt-2">{message}</p>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={() => { onConfirm(); onClose() }} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${btnClass}`}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
