import { useState } from 'react'
import { Bell, CheckCircle, AlertTriangle, Info, XCircle, Check, Trash2, Filter } from 'lucide-react'
import { mockNotifications } from '../data/mockData'

const typeConfig = {
  success: { icon: CheckCircle, bg: 'bg-green-50', border: 'border-green-200', iconColor: 'text-green-600', dot: 'bg-green-500' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50', border: 'border-amber-200', iconColor: 'text-amber-600', dot: 'bg-amber-500' },
  info: { icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', iconColor: 'text-blue-600', dot: 'bg-blue-500' },
  danger: { icon: XCircle, bg: 'bg-red-50', border: 'border-red-200', iconColor: 'text-red-600', dot: 'bg-red-500' },
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d atrás`
  if (h > 0) return `${h}h atrás`
  if (m > 0) return `${m}min atrás`
  return 'Agora'
}

export default function Notificacoes() {
  const [notifications, setNotifications] = useState(mockNotifications)
  const [filter, setFilter] = useState('all')

  const unread = notifications.filter(n => !n.readAt)
  const filtered = filter === 'unread' ? unread : filter === 'read' ? notifications.filter(n => n.readAt) : notifications

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
  }

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })))
  }

  const remove = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Notificações</h1>
          <p className="page-subtitle">{unread.length > 0 ? `${unread.length} notificação(ões) não lida(s)` : 'Todas as notificações lidas'}</p>
        </div>
        {unread.length > 0 && (
          <button onClick={markAllRead} className="btn-secondary text-sm">
            <Check size={14} />
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-0">
        {[
          { id: 'all', label: `Todas (${notifications.length})` },
          { id: 'unread', label: `Não lidas (${unread.length})` },
          { id: 'read', label: 'Lidas' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all ${
              filter === tab.id ? 'border-brand-700 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="space-y-3">
        {filtered.map(n => {
          const cfg = typeConfig[n.type] || typeConfig.info
          const Icon = cfg.icon
          const isUnread = !n.readAt

          return (
            <div
              key={n.id}
              className={`card border transition-all ${cfg.border} ${isUnread ? cfg.bg : 'bg-white opacity-75'}`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isUnread ? 'bg-white shadow-sm' : 'bg-gray-100'}`}>
                  <Icon size={18} className={isUnread ? cfg.iconColor : 'text-gray-400'} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isUnread && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />}
                      <h3 className={`text-sm font-semibold ${isUnread ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</h3>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className={`text-sm mt-1 ${isUnread ? 'text-gray-700' : 'text-gray-500'}`}>{n.message}</p>

                  <div className="flex items-center gap-2 mt-2.5">
                    {isUnread && (
                      <button
                        onClick={() => markAsRead(n.id)}
                        className="text-xs text-brand-700 hover:text-brand-900 font-medium flex items-center gap-1"
                      >
                        <Check size={11} />
                        Marcar como lida
                      </button>
                    )}
                    <button
                      onClick={() => remove(n.id)}
                      className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 ml-auto"
                    >
                      <Trash2 size={11} />
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="card text-center py-16">
            <Bell size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhuma notificação</p>
            <p className="text-gray-400 text-sm mt-1">Você está em dia!</p>
          </div>
        )}
      </div>
    </div>
  )
}
