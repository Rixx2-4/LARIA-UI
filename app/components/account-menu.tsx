"use client"
import {
  User,
  BrainCircuit,
  ToggleLeft,
  Bell,
  Settings,
  Settings2,
  Check,
  CircleUserRound,
} from "lucide-react"
import Image from "next/image"

interface AccountMenuProps {
  isOpen: boolean
  onClose: () => void
}

export function AccountMenu({ isOpen, onClose }: AccountMenuProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Account Menu */}
      <div className="fixed bottom-20 left-4 z-50 w-80 rounded-lg border border-border bg-background shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="p-2">
          {/* Menu Items */}
          <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent rounded transition-colors">
            <User className="h-4 w-4 shrink-0" />
            <span>Cuenta</span>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent rounded transition-colors">
            <BrainCircuit className="h-4 w-4 shrink-0" />
            <span>Perfil Cognitivo</span>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent rounded transition-colors">
            <ToggleLeft className="h-4 w-4 shrink-0" />
            <span>Personalizacion</span>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent rounded transition-colors">
            <Bell className="h-4 w-4 shrink-0" />
            <span>Notificaciones</span>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent rounded transition-colors">
            <Settings className="h-4 w-4 shrink-0" />
            <span>Ajustes</span>
          </button>

          <div className="my-2 border-t border-border" />

          {/* Profile Switcher */}
          <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent rounded transition-colors group">
            <div className="relative">
              <Image
                src="/images/robot.png"
                alt="Profile"
                width={24}
                height={24}
                className="rounded-full object-cover"
              />
              <span className="absolute -bottom-1 -right-1 text-[8px] font-bold bg-primary text-primary-foreground px-1 rounded">
                pro
              </span>
            </div>
            <span className="flex-1 text-left">Ri</span>
            <Check className="h-4 w-4 text-primary shrink-0" />
          </button>

        </div>
      </div>
    </>
  )
}
