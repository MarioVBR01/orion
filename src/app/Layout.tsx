import { Outlet } from 'react-router-dom'
import { ServerOff } from 'lucide-react'
import { useSettings } from '@/lib/api'
import { Spinner } from '@/components/ui'
import { TopBar } from './TopBar'

export function AppLayout() {
  const { isPending, isError, error, refetch } = useSettings()

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
        <ServerOff className="h-10 w-10 text-gray-400" />
        <h1 className="text-xl font-semibold">Servidor local no disponible</h1>
        <p className="max-w-md text-sm text-gray-500">{error.message}</p>
        <button className="btn-outline" onClick={() => refetch()}>Reintentar</button>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <TopBar />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
