import { useState, type FormEvent } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Menu, Settings as SettingsIcon, X } from 'lucide-react'
import { Logo, Modal } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { useSettings, useUpdateSettings } from '@/lib/api'
import { badgeCount } from '@/lib/format'

export function TopBar() {
  const { data: settings } = useSettings()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)

  const links = [
    { to: '/proyectos', label: 'Proyectos', badge: 0 },
  ]

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
              {l.badge > 0 && (
                <span className="ml-0.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white">
                  {badgeCount(l.badge)}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-4 md:flex">
          <span className="text-[15px] text-gray-800">{settings?.userName ?? '…'}</span>
          <button className="btn-outline" onClick={() => setEditing(true)}>
            <SettingsIcon className="h-4 w-4" /> Ajustes
          </button>
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
              </NavLink>
            ))}
          </nav>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm">{settings?.userName}</span>
            <button className="btn-outline" onClick={() => setEditing(true)}>Ajustes</button>
          </div>
        </div>
      )}

      {editing && <SettingsModal onClose={() => setEditing(false)} current={settings?.userName ?? ''} />}
    </header>
  )
}

function SettingsModal({ onClose, current }: { onClose: () => void; current: string }) {
  const toast = useToast()
  const update = useUpdateSettings()
  const [name, setName] = useState(current)

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await update.mutateAsync({ userName: name })
      toast.success('Ajustes guardados.')
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Ajustes"
      footer={
        <>
          <button className="btn-outline" type="button" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" type="submit" form="settings-form" disabled={update.isPending}>Guardar</button>
        </>
      }
    >
      <form id="settings-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="s-name">Tu nombre</label>
          <input id="s-name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <p className="mt-1 text-xs text-gray-500">Se usa como autor de tarjetas, comentarios y observaciones.</p>
        </div>
      </form>
    </Modal>
  )
}
