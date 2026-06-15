export default function StatCard({ icon: Icon, iconBg, iconColor, value, label, sublabel, loading = false }) {
  if (loading) {
    return (
      <div className="card flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl skeleton" />
        <div className="flex-1 space-y-2">
          <div className="h-7 w-16 skeleton" />
          <div className="h-4 w-28 skeleton" />
        </div>
      </div>
    )
  }

  return (
    <div className="card flex items-center gap-4 hover:shadow-card-hover transition-shadow">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon size={22} className={iconColor} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-sm font-medium text-gray-700 mt-0.5">{label}</div>
        {sublabel && <div className="text-xs text-gray-400 mt-0.5">{sublabel}</div>}
      </div>
    </div>
  )
}
