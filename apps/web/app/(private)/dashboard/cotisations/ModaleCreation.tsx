'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LABELS_BRANCHES, LABELS_TYPE_COTISATION, anneeScolaireCourante, formatMontantFCFA } from '@scout/shared'
import { Alert, Button, Field, Input, Modal, SearchInput, Select, Tabs } from '@/components/ui'
import { useBaremes, useCreerCotisation, useStatutsCotisation } from '@/hooks/useCotisations'
import { api, requete } from '@/lib/api'
import { dateCourte } from '@/lib/format'
import { Check, X } from '@/lib/icons'
import { OPTIONS_BRANCHES, messageErreur, optionsAnnees } from './commun'

const OPTIONS_TYPES = Object.entries(LABELS_TYPE_COTISATION).map(([valeur, libelle]) => ({ valeur, libelle }))

interface ScoutTrouve {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  brancheType: string
}

type Cible = 'scout' | 'branche'

/** Création d'une cotisation pour un scout ou pour tous les scouts actifs d'une branche. */
export function ModaleCreation({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) {
  return (
    <Modal ouvert={ouvert} onFermer={onFermer} titre="Nouvelle cotisation" description="Définit un montant dû, en FCFA." taille="lg">
      {ouvert && <Formulaire onFermer={onFermer} />}
    </Modal>
  )
}

function Formulaire({ onFermer }: { onFermer: () => void }) {
  const creer = useCreerCotisation()
  const [cible, setCible] = useState<Cible>('scout')
  const [recherche, setRecherche] = useState('')
  const [scout, setScout] = useState<ScoutTrouve | null>(null)
  const [branche, setBranche] = useState('')
  const [anneeScolaire, setAnneeScolaire] = useState(anneeScolaireCourante())
  const [type, setType] = useState('CAMP')
  const [libelle, setLibelle] = useState('')
  const [montant, setMontant] = useState('')
  const [activiteId, setActiviteId] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  const resultats = useQuery({
    queryKey: ['scouts', 'recherche-cotisation', recherche],
    queryFn: () => api<{ scouts: ScoutTrouve[] }>(`/api/scouts${requete({ recherche, limite: 8, actif: true })}`),
    enabled: cible === 'scout' && !scout && recherche.trim().length >= 2,
  })
  const scoutsBranche = useStatutsCotisation(anneeScolaire, branche || undefined, cible === 'branche' && !!branche)
  const baremes = useBaremes(anneeScolaire)
  const activites = useQuery({
    queryKey: ['activites', 'camps-cotisation'],
    queryFn: () =>
      api<{ activites: { id: string; titre: string; dateDebut: string }[] }>(`/api/activites${requete({ type: 'CAMP', limite: 100 })}`),
    enabled: type === 'CAMP',
  })

  // Barèmes applicables : même type, branche identique ou « toutes les branches ».
  const brancheCible = cible === 'scout' ? scout?.brancheType : branche
  const suggestions = (baremes.data?.baremes ?? []).filter(
    (b) => b.type === type && (!b.brancheType || b.brancheType === brancheCible),
  )

  const scoutIds = cible === 'scout' ? (scout ? [scout.id] : []) : (scoutsBranche.data?.scouts.map((s) => s.id) ?? [])

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    const valeur = Number(montant)
    if (scoutIds.length === 0) {
      setErreur(cible === 'scout' ? 'Choisissez un scout.' : 'Choisissez une branche comptant des scouts actifs.')
      return
    }
    if (montant.trim() === '' || !Number.isInteger(valeur) || valeur < 0) {
      setErreur('Saisissez un montant entier positif ou nul.')
      return
    }
    setErreur(null)
    try {
      const { cotisations } = await creer.mutateAsync({
        scoutIds,
        type,
        montant: valeur,
        libelle: libelle.trim() || null,
        anneeScolaire,
        activiteId: type === 'CAMP' && activiteId ? activiteId : null,
      })
      toast.success(cotisations.length > 1 ? `${cotisations.length} cotisations créées.` : 'Cotisation créée.')
      onFermer()
    } catch (err) {
      toast.error(messageErreur(err))
    }
  }

  return (
    <form onSubmit={soumettre} className="space-y-4">
      <Tabs
        label="Destinataires"
        actif={cible}
        onChange={(v) => {
          setCible(v)
          setErreur(null)
        }}
        onglets={[
          { valeur: 'scout', libelle: 'Un scout' },
          { valeur: 'branche', libelle: 'Toute une branche' },
        ]}
      />

      {cible === 'scout' ? (
        scout ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-sable-50 px-3 py-2 text-sm">
            <span>
              <span className="font-medium text-stone-900">
                {scout.prenom} {scout.nom}
              </span>
              <span className="text-stone-500"> · {LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}</span>
            </span>
            <Button taille="sm" variante="fantome" icone={X} onClick={() => setScout(null)}>
              Changer
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <SearchInput valeur={recherche} onChange={setRecherche} label="Rechercher un scout" placeholder="Nom, prénom ou matricule (2 caractères minimum)…" />
            {resultats.isError && <p className="text-sm text-red-600">{messageErreur(resultats.error)}</p>}
            {resultats.data && resultats.data.scouts.length === 0 && <p className="text-sm text-stone-500">Aucun scout actif trouvé.</p>}
            {resultats.data && resultats.data.scouts.length > 0 && (
              <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                {resultats.data.scouts.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => setScout(s)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-sable-50">
                      <span className="font-medium text-stone-800">
                        {s.prenom} {s.nom}
                      </span>
                      <span className="text-xs text-stone-500">
                        {LABELS_BRANCHES[s.brancheType] ?? s.brancheType}
                        {s.matricule ? ` · ${s.matricule}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      ) : (
        <Field label="Branche" requis aide={scoutsBranche.data ? `${scoutsBranche.data.scouts.length} scout(s) actif(s) recevront cette cotisation.` : undefined}>
          {(p) => <Select {...p} value={branche} onChange={(e) => setBranche(e.target.value)} vide="Choisir une branche" options={OPTIONS_BRANCHES} />}
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Année scolaire" requis>
          {(p) => <Select {...p} value={anneeScolaire} onChange={(e) => setAnneeScolaire(e.target.value)} options={optionsAnnees()} />}
        </Field>
        <Field label="Type" requis>
          {(p) => <Select {...p} value={type} onChange={(e) => setType(e.target.value)} options={OPTIONS_TYPES.filter(o => Number(anneeScolaire.slice(0, 4)) < 2026 || o.valeur !== 'ADHESION_ANNUELLE')} />}
        </Field>
      </div>

      {type === 'CAMP' && (
        <Field label="Camp concerné" aide="Facultatif.">
          {(p) => (
            <Select {...p} value={activiteId} onChange={(e) => setActiviteId(e.target.value)} vide={activites.isLoading ? 'Chargement…' : 'Aucun'}>
              {activites.data?.activites.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.titre} — {dateCourte(a.dateDebut)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      <Field label="Libellé" aide="Facultatif, utile pour le type « Autre ».">
        {(p) => <Input {...p} value={libelle} maxLength={200} onChange={(e) => setLibelle(e.target.value)} />}
      </Field>

      <Field label="Montant dû (FCFA)" requis erreur={erreur}>
        {(p) => <Input {...p} type="number" min={0} step={1} inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} />}
      </Field>

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-stone-500">Barème {anneeScolaire} :</span>
          {suggestions.map((b) => (
            <Button
              key={b.id}
              taille="sm"
              variante="secondaire"
              icone={Check}
              onClick={() => {
                setMontant(String(b.montant))
                if (b.libelle && !libelle) setLibelle(b.libelle)
              }}
            >
              {formatMontantFCFA(b.montant)}
              {b.libelle ? ` — ${b.libelle}` : ''}
              {b.brancheType ? ` (${LABELS_BRANCHES[b.brancheType] ?? b.brancheType})` : ''}
            </Button>
          ))}
        </div>
      ) : (
        baremes.data && (
          <Alert niveau="info">Aucun barème n’est défini pour ce type et cette année : saisissez le montant décidé par le groupe.</Alert>
        )
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variante="secondaire" onClick={onFermer}>
          Annuler
        </Button>
        <Button type="submit" chargement={creer.isPending}>
          {scoutIds.length > 1 ? `Créer ${scoutIds.length} cotisations` : 'Créer la cotisation'}
        </Button>
      </div>
    </form>
  )
}
