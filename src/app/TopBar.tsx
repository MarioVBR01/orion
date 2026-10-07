import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Bell, Menu, X } from 'lucide-react'
import { Logo } from '@/components/ui'
import { useAuth, useMe } from '@/features/auth/AuthProvider'
import { useUnreadCount } from '@/features/messages/useUnread'
import { badgeCount } from '@/lib/format'
import { can } from '@/lib/permissions'

export function TopBar() {
  const me = useMe()
  const { logout } = useAuth()
  const unread = useUnreadCount(me.id)
  const [open, setOpen] = useState(false)

  const links = [
    { to: '/proyectos', label: 'Proyectos', show: true },
    { to: '/mensajes', label: 'Mensajes', show: true, badge: unread },
    { to: '/usuarios', label: 'Usuarios', show: can.manageUsers(me) },
    { to: '/testers', label: 'Testers', show: can.manageUsers(me) },
  ].filter((l) => l.show)

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `relative inline-flex items-center gap-1 text-[15px] ${isActive ? 'text-brand' : 'text-gray-700 hover:text-gray-900'}`

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-[72px] max-w-[1400px] items-center gap-6 px-4 sm:px-6">
        <Link to="/proyectos" className="flex items-center gap-2" aria-label="Inicio ORION">
          <Logo />
          <span className="text-xl font-bold tracking-tight">
            ORION <span className="text-brand">Manager</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 md:flex" aria-label="Principal">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={navClass}>
              {l.label}
              {!!l.badge && (
                <span className="ml-0.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white">
                  {badgeCount(l.badge)}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-4 md:flex">
          <Link to="/mensajes" aria-label="Notificaciones" className="relative text-gray-600 hover:text-gray-900">
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-600" />}
          </Link>
          <span className="text-[15px] text-gray-800">
            {me.name} <span className="text-xs text-gray-400">({me.globalRole})</span>
          </span>
          <Link to="/cambiar-contrasena" className="text-[15px] text-gray-700 hover:text-gray-900">
            Cambiar contraseña
          </Link>
          <button onClick={logout} className="btn-outline">Cerrar sesión</button>
        </div>

        <button className="ml-auto rounded-lg p-2 text-gray-700 md:hidden" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen((o) => !o)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-gray-100 px-4 pb-4 md:hidden" onClick={() => setOpen(false)}>
          <nav className="flex flex-col gap-3 pt-3" aria-label="Principal móvil">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={navClass}>
                {l.label}
                {!!l.badge && <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">{badgeCount(l.badge)}</span>}
              </NavLink>
            ))}
            <NavLink to="/cambiar-contrasena" className={navClass}>Cambiar contraseña</NavLink>
          </nav>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm">{me.name} <span className="text-xs text-gray-400">({me.globalRole})</span></span>
            <button onClick={logout} className="btn-outline">Cerrar sesión</button>
          </div>
        </div>
      )}
    </header>
  )
}
