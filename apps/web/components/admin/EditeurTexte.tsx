'use client'

import { useId, useRef, useState } from 'react'
import { ContenuRiche } from '@/components/contenu/ContenuRiche'
import { Tabs } from '@/components/ui'
import { ClipboardList, FileText, Quote } from '@/lib/icons'

type Insertion = 'titre' | 'liste' | 'citation'

const MODELES: Record<Insertion, { libelle: string; texte: string; selection: [number, number] }> = {
  titre: { libelle: 'Titre', texte: '## Titre de section', selection: [3, 19] },
  liste: { libelle: 'Liste', texte: '- Premier élément\n- Deuxième élément', selection: [2, 17] },
  citation: { libelle: 'Citation', texte: '> Texte de la citation', selection: [2, 22] },
}

const ICONES: Record<Insertion, typeof Quote> = { titre: FileText, liste: ClipboardList, citation: Quote }

/**
 * Éditeur du texte éditorial structuré (« ## Titre », « ### », « - liste »,
 * « > citation ») avec boutons d'insertion et aperçu fidèle (ContenuRiche).
 * Aperçu côte à côte sur grand écran, onglet « Aperçu » sur mobile.
 */
export function EditeurTexte({
  label,
  valeur,
  onChange,
  erreur,
  aide,
  max,
  requis,
  lignes = 14,
  apercu = 'cote',
}: {
  label: string
  valeur: string
  onChange: (valeur: string) => void
  erreur?: string | null
  aide?: string
  max?: number
  requis?: boolean
  lignes?: number
  /** « cote » : aperçu à droite (grand écran) ; « dessous » : aperçu repliable sous le champ. */
  apercu?: 'cote' | 'dessous'
}) {
  const id = useId()
  const zone = useRef<HTMLTextAreaElement>(null)
  const [onglet, setOnglet] = useState<'redaction' | 'apercu'>('redaction')
  const [apercuOuvert, setApercuOuvert] = useState(false)

  function inserer(type: Insertion) {
    const champ = zone.current
    const modele = MODELES[type]
    const debut = champ?.selectionStart ?? valeur.length
    const fin = champ?.selectionEnd ?? valeur.length
    const avant = valeur.slice(0, debut)
    const apres = valeur.slice(fin)
    // Un bloc commence toujours sur une ligne isolée (ligne vide avant et après).
    const prefixe = avant.length === 0 || avant.endsWith('\n\n') ? '' : avant.endsWith('\n') ? '\n' : '\n\n'
    const suffixe = apres.startsWith('\n\n') || apres.length === 0 ? '' : apres.startsWith('\n') ? '\n' : '\n\n'
    const nouveau = `${avant}${prefixe}${modele.texte}${suffixe}${apres}`
    onChange(nouveau)
    const position = avant.length + prefixe.length
    requestAnimationFrame(() => {
      if (!zone.current) return
      zone.current.focus()
      zone.current.setSelectionRange(position + modele.selection[0], position + modele.selection[1])
    })
  }

  const idAide = `${id}-aide`
  const idErreur = `${id}-erreur`
  const depasse = max !== undefined && valeur.length > max

  const champ = (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-stone-300 bg-stone-50 px-2 py-1.5" role="toolbar" aria-label="Mise en forme">
        {(Object.keys(MODELES) as Insertion[]).map((type) => {
          const Icone = ICONES[type]
          return (
            <button
              key={type}
              type="button"
              onClick={() => inserer(type)}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-stone-700 hover:bg-white hover:shadow-sm"
            >
              <Icone className="h-3.5 w-3.5" aria-hidden />
              {MODELES[type].libelle}
            </button>
          )
        })}
        {max !== undefined && (
          <span className={`ml-auto text-xs tabular-nums ${depasse ? 'font-medium text-red-600' : 'text-stone-500'}`} aria-live="polite">
            {valeur.length.toLocaleString('fr-FR')} / {max.toLocaleString('fr-FR')}
          </span>
        )}
      </div>
      <textarea
        ref={zone}
        id={id}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        rows={lignes}
        required={requis}
        aria-invalid={erreur || depasse ? true : undefined}
        aria-describedby={[idAide, erreur ? idErreur : ''].filter(Boolean).join(' ')}
        className="block w-full rounded-b-lg border border-stone-300 bg-white px-3 py-2 font-mono text-sm leading-relaxed text-stone-900 shadow-sm focus:border-primaire focus:ring-2 focus:ring-primaire/20 focus:outline-none aria-[invalid=true]:border-red-500"
      />
      <p id={idAide} className="mt-1 text-xs text-stone-500">
        {aide ? `${aide} ` : ''}Syntaxe : « ## » titre, « ### » sous-titre, « - » élément de liste, « &gt; » citation ; une ligne vide sépare les
        paragraphes. Aucun code HTML n&apos;est interprété.
      </p>
      {erreur && (
        <p id={idErreur} className="mt-1 text-xs text-red-600">
          {erreur}
        </p>
      )}
    </div>
  )

  const rendu = (
    <div className="min-h-32 rounded-lg border border-dashed border-stone-300 bg-white p-4">
      {valeur.trim() ? <ContenuRiche texte={valeur} /> : <p className="text-sm text-stone-400">L&apos;aperçu s&apos;affichera ici.</p>}
    </div>
  )

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-stone-700">
        {label}
        {requis && (
          <span className="ml-0.5 text-red-600" aria-hidden>
            *
          </span>
        )}
      </label>
      {apercu === 'cote' ? (
        <>
          <div className="mb-2 lg:hidden">
            <Tabs
              label={`Mode d'édition : ${label}`}
              actif={onglet}
              onChange={setOnglet}
              onglets={[
                { valeur: 'redaction', libelle: 'Rédaction' },
                { valeur: 'apercu', libelle: 'Aperçu' },
              ]}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={onglet === 'apercu' ? 'hidden lg:block' : ''}>{champ}</div>
            <div className={onglet === 'redaction' ? 'hidden lg:block' : ''}>
              <p className="mb-1.5 hidden text-xs font-medium tracking-wide text-stone-500 uppercase lg:block">Aperçu</p>
              {rendu}
            </div>
          </div>
        </>
      ) : (
        <>
          {champ}
          <button
            type="button"
            onClick={() => setApercuOuvert((o) => !o)}
            aria-expanded={apercuOuvert}
            className="mt-2 text-xs font-medium text-primaire hover:underline"
          >
            {apercuOuvert ? "Masquer l'aperçu" : "Afficher l'aperçu"}
          </button>
          {apercuOuvert && <div className="mt-2">{rendu}</div>}
        </>
      )}
    </div>
  )
}
