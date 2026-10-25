'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_ROLES, ROLES_GROUPE } from '@scout/shared'
import { useSession } from '@/lib/session-client'
import { accentBranche } from '@/lib/branches-visuel'
import { ExternalLink, Eye, EyeOff, Pencil, UsersRound } from '@/lib/icons'
import { useMaitrise, useModifierProfilPublic, useProfilPublic, type MembreMaitrise, type ProfilPublic } from '@/hooks/useMaitrise'
import { Badge, Button, Drawer, EmptyState, ErrorState, Field, FileUpload, Input, PageHeader, Skeleton, Switch, Textarea } from '@/components/ui'
import { ErreurApi } from '@/lib/api'

function EditeurProfil({ membre, onFermer }: { membre: MembreMaitrise; onFermer: () => void }) {
  const profil = useProfilPublic(membre.id)
  return (
    <Drawer ouvert onFermer={onFermer} titre={`Profil public — ${membre.prenom} ${membre.nom}`} description="Ce qui apparaît sur la page « La maîtrise » du site." taille="lg">
      {profil.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-40" />
        </div>
      ) : profil.isError ? (
        <ErrorState message="Impossible de charger ce profil." onReessayer={() => void profil.refetch()} />
      ) : (
        <FormulaireProfil membre={membre} initial={profil.data} onFermer={onFermer} />
      )}
    </Drawer>
  )
}

function FormulaireProfil({ membre, initial, onFermer }: { membre: MembreMaitrise; initial: ProfilPublic; onFermer: () => void }) {
  const [v, setV] = useState(initial)
  const [erreur, setErreur] = useState<string | null>(null)
  const modifier = useModifierProfilPublic()
  const maj = <K extends keyof ProfilPublic>(cle: K, valeur: ProfilPublic[K]) => setV((p) => ({ ...p, [cle]: valeur }))
  const ordreValide = Number.isInteger(v.ordrePublic) && v.ordrePublic >= 0 && v.ordrePublic <= 9999

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    if (!ordreValide) return setErreur('L’ordre d’affichage doit être un nombre entier entre 0 et 9999.')
    try {
      await modifier.mutateAsync({
        id: membre.id,
        profilPublic: v.profilPublic,
        fonctionPublique: v.fonctionPublique?.trim() || null,
        photoPublique: v.photoPublique,
        biographie: v.biographie?.trim() || null,
        ordrePublic: v.ordrePublic,
      })
      toast.success(v.profilPublic ? 'Profil public enregistré et visible sur le site.' : 'Profil enregistré (non visible sur le site).')
      onFermer()
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : 'Enregistrement impossible. Réessayez.')
    }
  }

  return (
    <form onSubmit={enregistrer} className="space-y-5" noValidate>
      <Switch
        checked={v.profilPublic}
        onChange={(b) => maj('profilPublic', b)}
        label="Afficher sur le site public"
        description="À activer uniquement avec l’accord de la personne concernée."
      />
      <Field label="Fonction affichée" aide={`Par défaut : ${LABELS_ROLES[membre.role] ?? membre.role}. Plusieurs fonctions peuvent être indiquées (ex. « Cheftaine Louveteaux, trésorière »).`}>
        {(p) => <Input {...p} maxLength={120} value={v.fonctionPublique ?? ''} onChange={(e) => maj('fonctionPublique', e.target.value)} />}
      </Field>
      <FileUpload
        label="Portrait"
        aide="Photo de face, cadrage portrait. Sans portrait, les initiales sont affichées."
        visibilite="publique"
        valeur={v.photoPublique}
        onChange={(url) => maj('photoPublique', url)}
      />
      <Field label="Courte présentation (facultatif)" aide="2 000 caractères au plus. Aucune donnée personnelle sensible.">
        {(p) => <Textarea {...p} rows={5} maxLength={2000} value={v.biographie ?? ''} onChange={(e) => maj('biographie', e.target.value)} />}
      </Field>
      <Field label="Ordre d’affichage" aide="Dans un même rôle, les plus petits nombres apparaissent en premier." erreur={!ordreValide ? 'Nombre entier entre 0 et 9999.' : null}>
        {(p) => (
          <Input {...p} type="number" min={0} max={9999} step={1} className="w-32" value={Number.isNaN(v.ordrePublic) ? '' : v.ordrePublic} onChange={(e) => maj('ordrePublic', e.target.valueAsNumber)} />
        )}
      </Field>
      {erreur && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {erreur}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2 border-t border-ligne pt-4">
        <Button variante="secondaire" onClick={onFermer}>
          Annuler
        </Button>
        <Button type="submit" chargement={modifier.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  )
}

function Ligne({ membre, peutModifier, onModifier }: { membre: MembreMaitrise; peutModifier: boolean; onModifier: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-papier text-sm font-semibold text-encre-douce" aria-hidden>
        {membre.prenom.charAt(0)}
        {membre.nom.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-encre">
          {membre.prenom} {membre.nom}
        </p>
        <p className="text-sm text-encre-pale">{membre.fonction || LABELS_ROLES[membre.role] || membre.role}</p>
      </div>
      {membre.profilPublic ? (
        <Badge ton="succes">
          <Eye className="mr-1 h-3.5 w-3.5" aria-hidden />
          Sur le site
        </Badge>
      ) : (
        <Badge>
          <EyeOff className="mr-1 h-3.5 w-3.5" aria-hidden />
          Non publié
        </Badge>
      )}
      {peutModifier && (
        <Button variante="fantome" taille="sm" icone={Pencil} onClick={onModifier}>
          Profil public<span className="sr-only"> de {membre.prenom} {membre.nom}</span>
        </Button>
      )}
    </li>
  )
}

export default function PageMaitrise() {
  const { data: session } = useSession()
  const peutModifier = ROLES_GROUPE.includes(session?.user?.role ?? '')
  const maitrise = useMaitrise()
  const [edite, setEdite] = useState<MembreMaitrise | null>(null)

  const groupes = maitrise.data
    ? [
        { cle: 'direction', titre: 'Direction du groupe', couleur: 'var(--ca)', membres: maitrise.data.direction },
        ...maitrise.data.branches.map((b) => ({ cle: b.brancheType, titre: b.libelle, couleur: accentBranche(b.brancheType), membres: b.membres })),
      ]
    : []
  const publies = groupes.reduce((s, g) => s + g.membres.filter((m) => m.profilPublic).length, 0)
  const total = groupes.reduce((s, g) => s + g.membres.length, 0)

  return (
    <div>
      <PageHeader
        miettes={[{ libelle: 'Tableau de bord', href: '/dashboard' }, { libelle: 'Maîtrise' }]}
        titre="Maîtrise"
        description={
          maitrise.data ? `${total} membre${total > 1 ? 's' : ''} actif${total > 1 ? 's' : ''} · ${publies} présenté${publies > 1 ? 's' : ''} sur le site public` : 'Organigramme de l’encadrement du groupe.'
        }
        actions={
          <>
            <Link href="/notre-equipe" target="_blank" className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 hover:bg-stone-50">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Voir la page publique<span className="sr-only"> (nouvel onglet)</span>
            </Link>
            {peutModifier && (
              <Link href="/dashboard/utilisateurs/nouveau" className="inline-flex h-10 items-center rounded-lg bg-primaire px-4 text-sm font-medium text-white hover:brightness-110">
                Ajouter un membre
              </Link>
            )}
          </>
        }
      />

      {maitrise.isPending ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : maitrise.isError ? (
        <ErrorState message={maitrise.error.message} onReessayer={() => void maitrise.refetch()} className="rounded-lg border border-ligne bg-white" />
      ) : total === 0 ? (
        <EmptyState icon={UsersRound} title="Aucun membre de la maîtrise n’est enregistré." className="rounded-lg border border-ligne bg-white" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {groupes.map((g) => (
            <section key={g.cle} aria-labelledby={`groupe-${g.cle}`} className="rounded-lg border border-ligne bg-white" style={{ borderTop: `4px solid ${g.couleur}` }}>
              <header className="flex items-baseline justify-between gap-3 px-5 pt-4">
                <h2 id={`groupe-${g.cle}`} className="font-semibold text-encre">
                  {g.titre}
                </h2>
                <span className="text-sm text-encre-pale">
                  {g.membres.length} membre{g.membres.length > 1 ? 's' : ''}
                </span>
              </header>
              {g.membres.length === 0 ? (
                <p className="px-5 pt-2 pb-5 text-sm text-encre-pale">Aucun encadrant affecté pour le moment.</p>
              ) : (
                <ul className="divide-y divide-ligne px-5 pb-2">
                  {g.membres.map((m) => (
                    <Ligne key={`${m.id}-${m.role}-${m.brancheType ?? 'groupe'}`} membre={m} peutModifier={peutModifier} onModifier={() => setEdite(m)} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {edite && <EditeurProfil membre={edite} onFermer={() => setEdite(null)} />}
    </div>
  )
}
