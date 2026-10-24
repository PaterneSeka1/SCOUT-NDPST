'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { televerser } from '@/lib/api'
import { ImageOff, Loader2, Upload, X } from '@/lib/icons'

const TAILLE_MAX = 5 * 1024 * 1024

/**
 * Téléversement d'un fichier vers /api/upload. Le type réel est revérifié par
 * l'API (signature des octets) ; ce contrôle n'est qu'un confort.
 */
export function FileUpload({
  valeur,
  onChange,
  visibilite,
  accept = 'image/jpeg,image/png,image/webp',
  label,
  aide,
  apercu = true,
}: {
  valeur: string | null
  onChange: (url: string | null) => void
  visibilite: 'privee' | 'publique' | 'galerie'
  accept?: string
  label: string
  aide?: string
  apercu?: boolean
}) {
  const champ = useRef<HTMLInputElement>(null)
  const [envoi, setEnvoi] = useState(false)

  async function choisir(fichier: File | undefined) {
    if (!fichier) return
    if (fichier.size > TAILLE_MAX) {
      toast.error('Fichier trop volumineux (5 Mo maximum).')
      return
    }
    setEnvoi(true)
    try {
      onChange(await televerser(fichier, visibilite))
      toast.success('Fichier téléversé.')
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : 'Téléversement impossible.')
    } finally {
      setEnvoi(false)
      if (champ.current) champ.current.value = ''
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-stone-700">{label}</p>
      <div className="flex items-center gap-4">
        {apercu && (
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-sable-50">
            {valeur ? (
              <Image src={valeur} alt="" fill unoptimized className="object-cover" />
            ) : (
              <ImageOff className="h-6 w-6 text-stone-300" aria-hidden />
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={envoi}
            onClick={() => champ.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {valeur ? 'Remplacer' : 'Choisir un fichier'}
          </button>
          {valeur && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-stone-600 hover:bg-stone-100"
            >
              <X className="h-4 w-4" /> Retirer
            </button>
          )}
        </div>
      </div>
      {aide && <p className="mt-1 text-xs text-stone-500">{aide}</p>}
      <input ref={champ} type="file" accept={accept} className="sr-only" tabIndex={-1} aria-label={label} onChange={(e) => choisir(e.target.files?.[0])} />
    </div>
  )
}
