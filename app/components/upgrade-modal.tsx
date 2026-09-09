"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, Heart } from "lucide-react"

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
}

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const [customAmount, setCustomAmount] = useState("")

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-background animate-in fade-in duration-300 overflow-y-auto">
      <button
        onClick={onClose}
        className="fixed right-6 top-6 text-muted-foreground hover:text-foreground transition-colors z-10"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-3xl">
          <h2 className="text-2xl font-bold text-center mb-2">Contribuye</h2>
          <p className="text-sm text-muted-foreground text-center mb-10">
            Gracias por tu apoyo. Tu donación nos ayuda a seguir mejorando.
          </p>

          <div className="grid md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Donación $2 */}
            <div className="border border-border rounded-xl p-6 bg-card flex flex-col items-center text-center">
              <Heart className="h-8 w-8 text-primary mb-4" />
              <span className="text-3xl font-bold mb-2">$2</span>
              <p className="text-sm text-muted-foreground mb-6">
                Gracias por tu apoyo
              </p>
              <Button className="w-full bg-primary hover:bg-primary/90">Contribuir $2</Button>
            </div>

            {/* Donación $5 */}
            <div className="border border-border rounded-xl p-6 bg-card flex flex-col items-center text-center">
              <Heart className="h-8 w-8 text-primary mb-4" />
              <span className="text-3xl font-bold mb-2">$5</span>
              <p className="text-sm text-muted-foreground mb-6">
                Gracias por tu apoyo
              </p>
              <Button className="w-full bg-primary hover:bg-primary/90">Contribuir $5</Button>
            </div>

            {/* Donación personalizada */}
            <div className="border border-border rounded-xl p-6 bg-card flex flex-col items-center text-center">
              <Heart className="h-8 w-8 text-primary mb-4" />
              <span className="text-3xl font-bold mb-2">Otro</span>
              <p className="text-sm text-muted-foreground mb-6">
                Gracias por tu apoyo
              </p>
              <input
                type="number"
                min="1"
                placeholder="Monto"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full px-3 py-2 mb-3 border border-border rounded-md text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button className="w-full bg-primary hover:bg-primary/90" disabled={!customAmount || Number(customAmount) < 1}>
                Contribuir
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
