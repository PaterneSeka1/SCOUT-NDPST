'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { LABELS_BRANCHES, LABELS_ROLES, ORDRE_BRANCHES, REGLE_MOT_DE_PASSE, ROLES_ASSIGNABLES_ADMIN, ROLES_BRANCHE, motDePasseValide } from '@scout/shared'
import { useSession } from '@/lib/session-client'
import { ErreurApi } from '@/lib/api'
import { KeyRound, Pencil, Plus, Users } from '@/lib/icons'
import { useComptes, useCreerCompte, useDesactiverCompte, useModifierCompte, useReinitialiserMotDePasse, type CompteAdmin, type DonneesCompte } from '@/hooks/useComptesAdmin'
import { Badge, Button, CHAMP, DataTable, Field, FilterBar, Input, Modal, PageHeader, Pagination, SearchInput, Select, Switch, confirmer, type Colonne } from '@/components/ui'
import { PasswordInput } from '@/components/PasswordInput'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Brouillon = DonneesCompte & { id?: string; matricule: string | null }

const VIDE: Brouillon = { nom: '', prenom: '', email: null, matricule: null, telephone: null, role: '', fonction: null, brancheType: null, editeurContenu: false }

function FormulaireCompte({ initial, onFermer, onCree }: { initial: Brouillon; onFermer: () => void; onCree: (c: { nom: string; secret: string; matricule: string | null }) => void }) {
  const [v, setV] = useState(initial)
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const creer = useCreerCompte()
  const modifier = useModifierCompte()
  const edition = !!v.id
  const brancheRequise = ROLES_BRANCHE.includes(v.role)
  const maj = <K extends keyof Brouillon>(cle: K, valeur: Brouillon[K]) => setV((p) => ({ ...p, [cle]: valeur }))

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    const t: Record<string, string> = {}
    if (!v.prenom.trim()) t.prenom = 'Indiquez le prénom.'
    if (!v.nom.trim()) t.nom = 'Indiquez le nom.'
    if (!v.role) t.role = 'Choisissez un rôle.'
    if (!edition && !v.matricule?.trim()) t.matricule = 'Le matricule sert d’identifiant de connexion.'
    if (v.email && !EMAIL.test(v.email.trim())) t.email = 'Adresse e-mail invalide.'
    if (brancheRequise && !v.brancheType) t.brancheType = 'La branche est requise pour ce rôle.'
    setErreurs(t)
    if (Object.keys(t).length) return
    const commun = {
      nom: v.nom.trim(),
      prenom: v.prenom.trim(),
      email: v.email?.trim() || null,
      role: v.role,
      fonction: v.fonction?.trim() || null,
      brancheType: brancheRequise ? v.brancheType : null,
      editeurContenu: v.editeurContenu,
    }
    try {
      if (edition) {
        await modifier.mutateAsync({ id: v.id!, ...commun })
        toast.success('Compte modifié.')
        onFermer()
      } else {
        const cree = await creer.mutateAsync({ ...commun, matricule: v.matricule!.trim() })
        onCree({ nom: `${cree.prenom} ${cree.nom}`, secret: cree.motDePasseTemporaire, matricule: cree.matricule })
      }
    } catch (err) {
      setErreurs({ serveur: err instanceof ErreurApi ? err.message : 'Enregistrement impossible.' })
    }
  }

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      taille="lg"
      titre={edition ? `Modifier — ${initial.prenom} ${initial.nom}` : 'Nouveau compte'}
      description={edition ? undefined : 'Un mot de passe temporaire sera généré : la personne devra le changer à sa première connexion.'}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermer}>
            Annuler
          </Button>
          <Button type="submit" form="formulaire-compte" chargement={creer.isPending || modifier.isPending}>
            {edition ? 'Enregistrer' : 'Créer le compte'}
          </Button>
        </>
      }
    >
      <form id="formulaire-compte" onSubmit={enregistrer} noValidate className="space-y-5">
        {erreurs.serveur && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreurs.serveur}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" requis erreur={erreurs.prenom}>
            {(p) => <Input {...p} autoComplete="off" maxLength={100} value={v.prenom} onChange={(e) => maj('prenom', e.target.value)} />}
          </Field>
          <Field label="Nom" requis erreur={erreurs.nom}>
            {(p) => <Input {...p} autoComplete="off" maxLength={100} value={v.nom} onChange={(e) => maj('nom', e.target.value)} />}
          </Field>
          {!edition && (
            <Field label="Matricule" requis erreur={erreurs.matricule} aide="Identifiant de connexion.">
              {(p) => <Input {...p} autoComplete="off" maxLength={50} value={v.matricule ?? ''} onChange={(e) => maj('matricule', e.target.value)} />}
            </Field>
          )}
          <Field label="E-mail (facultatif)" erreur={erreurs.email}>
            {(p) => <Input {...p} type="email" autoComplete="off" maxLength={200} value={v.email ?? ''} onChange={(e) => maj('email', e.target.value)} />}
          </Field>
          <Field label="Rôle" requis erreur={erreurs.role}>
            {(p) => (
              <Select {...p} vide="Choisir…" value={v.role} onChange={(e) => maj('role', e.target.value)} options={ROLES_ASSIGNABLES_ADMIN.map((r) => ({ valeur: r, libelle: LABELS_ROLES[r] ?? r }))} />
            )}
          </Field>
          {brancheRequise && (
            <Field label="Branche" requis erreur={erreurs.brancheType}>
              {(p) => (
                <Select {...p} vide="Choisir…" value={v.brancheType ?? ''} onChange={(e) => maj('brancheType', e.target.value || null)} options={ORDRE_BRANCHES.map((b) => ({ valeur: b, libelle: LABELS_BRANCHES[b] }))} />
              )}
            </Field>
          )}
          <Field label="Fonction (facultatif)" aide="Précision interne, ex. « Trésorier ».">
            {(p) => <Input {...p} maxLength={120} value={v.fonction ?? ''} onChange={(e) => maj('fonction', e.target.value)} />}
          </Field>
        </div>
        <Switch
          checked={v.editeurContenu}
          onChange={(b) => maj('editeurContenu', b)}
          label="Éditeur des contenus publics"
          description="Peut publier actualités, albums photo, histoire et présentation des branches."
        />
      </form>
    </Modal>
  )
}

function ModaleSecret({ compte, onFermer }: { compte: { nom: string; secret: string; matricule: string | null }; onFermer: () => void }) {
  return (
    <Modal ouvert onFermer={onFermer} titre="Compte créé" description="Ce mot de passe temporaire ne sera plus affiché. Remettez-le en main propre." pied={<Button onClick={onFermer}>J’ai noté ces informations</Button>}>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-encre-pale">Personne</dt>
          <dd className="font-medium text-encre">{compte.nom}</dd>
        </div>
        <div>
          <dt className="text-encre-pale">Identifiant</dt>
          <dd className="font-mono text-encre">{compte.matricule}</dd>
        </div>
        <div>
          <dt className="text-encre-pale">Mot de passe temporaire</dt>
          <dd className="mt-1 flex items-center gap-2">
            <code className="rounded-md bg-papier px-3 py-2 font-mono text-base text-encre select-all">{compte.secret}</code>
            <Button
              taille="sm"
              variante="secondaire"
              onClick={() =>
                navigator.clipboard.writeText(compte.secret).then(
                  () => toast.success('Copié.'),
                  () => toast.error('Copie impossible.'),
                )
              }
            >
              Copier
            </Button>
          </dd>
        </div>
      </dl>
    </Modal>
  )
}

function ModaleMotDePasse({ compte, onFermer }: { compte: CompteAdmin; onFermer: () => void }) {
  const [mdp, setMdp] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const reinitialiser = useReinitialiserMotDePasse()
  async function valider(e: React.FormEvent) {
    e.preventDefault()
    if (!motDePasseValide(mdp)) return setErreur(REGLE_MOT_DE_PASSE)
    try {
      await reinitialiser.mutateAsync({ id: compte.id, nouveauMotDePasse: mdp })
      toast.success('Mot de passe réinitialisé. Il devra être changé à la prochaine connexion.')
      onFermer()
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : 'Réinitialisation impossible.')
    }
  }
  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre={`Réinitialiser le mot de passe — ${compte.prenom} ${compte.nom}`}
      description="Les sessions ouvertes de ce compte seront fermées."
      pied={
        <>
          <Button variante="secondaire" onClick={onFermer}>
            Annuler
          </Button>
          <Button type="submit" form="formulaire-mdp" variante="danger" chargement={reinitialiser.isPending}>
            Réinitialiser
          </Button>
        </>
      }
    >
      <form id="formulaire-mdp" onSubmit={valider} noValidate>
        <Field label="Nouveau mot de passe temporaire" requis erreur={erreur} aide={REGLE_MOT_DE_PASSE}>
          {(p) => <PasswordInput {...p} className={CHAMP} autoComplete="new-password" value={mdp} onChange={(e) => setMdp(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  )
}

function ContenuComptes() {
  const { data: session } = useSession()
  const parametres = useSearchParams()
  const router = useRouter()
  const [recherche, setRecherche] = useState('')
  const [role, setRole] = useState('')
  const [actif, setActif] = useState<'' | 'true' | 'false'>('true')
  const [page, setPage] = useState(1)
  const [edite, setEdite] = useState<Brouillon | null>(() => (parametres.get('nouveau') === '1' ? VIDE : null))
  const [cree, setCree] = useState<{ nom: string; secret: string; matricule: string | null } | null>(null)
  const [mdp, setMdp] = useState<CompteAdmin | null>(null)
  const comptes = useComptes({ page, recherche: recherche || undefined, role: role || undefined, actif: actif || undefined })
  const desactiver = useDesactiverCompte()
  const modifier = useModifierCompte()

  async function basculer(c: CompteAdmin) {
    if (c.actif) {
      if (!(await confirmer({ titre: 'Désactiver ce compte ?', description: `${c.prenom} ${c.nom} perdra immédiatement ses accès ; ses sessions seront révoquées.`, labelConfirmer: 'Désactiver', danger: true }))) return
    }
    try {
      if (c.actif) await desactiver.mutateAsync(c.id)
      else await modifier.mutateAsync({ id: c.id, actif: true })
      toast.success(c.actif ? 'Compte désactivé.' : 'Compte réactivé.')
    } catch (err) {
      toast.error(err instanceof ErreurApi ? err.message : 'Modification impossible.')
    }
  }

  const fermerEdition = () => {
    setEdite(null)
    if (parametres.get('nouveau')) router.replace('/admin/utilisateurs')
  }

  const colonnes: Colonne<CompteAdmin>[] = [
    {
      cle: 'nom',
      titre: 'Personne',
      principale: true,
      rendu: (c) => (
        <span>
          <span className="block font-medium text-encre">
            {c.prenom} {c.nom}
          </span>
          <span className="font-mono text-xs text-encre-pale">{c.matricule ?? c.telephone ?? '—'}</span>
        </span>
      ),
    },
    {
      cle: 'role',
      titre: 'Rôle',
      rendu: (c) => (
        <span className="text-sm">
          {LABELS_ROLES[c.role] ?? c.role}
          {c.brancheType && <span className="text-encre-pale"> · {LABELS_BRANCHES[c.brancheType]}</span>}
        </span>
      ),
    },
    {
      cle: 'droits',
      titre: 'Droits',
      masquee: 'md',
      rendu: (c) => (c.editeurContenu ? <Badge ton="info">Éditeur des contenus</Badge> : <span className="text-encre-pale">—</span>),
    },
    {
      cle: 'statut',
      titre: 'Statut',
      rendu: (c) =>
        !c.actif ? <Badge>Désactivé</Badge> : c.doitChangerMotDePasse ? <Badge ton="attention">Activation en attente</Badge> : <Badge ton="succes">Actif</Badge>,
    },
  ]

  return (
    <div>
      <PageHeader
        miettes={[{ libelle: 'Tableau de bord', href: '/dashboard' }, { libelle: 'Administration' }, { libelle: 'Comptes' }]}
        titre="Comptes utilisateurs"
        description="Tous les comptes de la plateforme, administrateurs compris. Les règles (poste unique, dernier administrateur) sont vérifiées par le serveur."
        actions={
          <Button icone={Plus} onClick={() => setEdite(VIDE)}>
            Nouveau compte
          </Button>
        }
      />
      <FilterBar>
        <SearchInput
          valeur={recherche}
          onChange={(r) => {
            setRecherche(r)
            setPage(1)
          }}
          label="Rechercher un compte"
          placeholder="Nom, matricule, téléphone, e-mail…"
          className="sm:w-80"
        />
        <Select
          aria-label="Filtrer par rôle"
          vide="Tous les rôles"
          value={role}
          onChange={(e) => {
            setRole(e.target.value)
            setPage(1)
          }}
          options={ROLES_ASSIGNABLES_ADMIN.map((r) => ({ valeur: r, libelle: LABELS_ROLES[r] ?? r }))}
          className="sm:w-56"
        />
        <Select
          aria-label="Filtrer par statut"
          vide="Tous les statuts"
          value={actif}
          onChange={(e) => {
            setActif(e.target.value as '' | 'true' | 'false')
            setPage(1)
          }}
          options={[
            { valeur: 'true', libelle: 'Actifs' },
            { valeur: 'false', libelle: 'Désactivés' },
          ]}
          className="sm:w-44"
        />
      </FilterBar>

      <DataTable
        legende="Comptes utilisateurs"
        colonnes={colonnes}
        lignes={comptes.data?.utilisateurs}
        cleLigne={(c) => c.id}
        chargement={comptes.isPending}
        erreur={comptes.isError ? comptes.error.message : null}
        onReessayer={() => void comptes.refetch()}
        vide={{ icone: Users, titre: recherche || role ? 'Aucun compte ne correspond aux filtres.' : 'Aucun compte.' }}
        actions={(c) => (
          <div className="flex flex-wrap justify-end gap-1">
            <Button variante="fantome" taille="sm" icone={Pencil} onClick={() => setEdite({ ...c, matricule: c.matricule })}>
              Modifier<span className="sr-only"> {c.prenom} {c.nom}</span>
            </Button>
            <Button variante="fantome" taille="sm" icone={KeyRound} onClick={() => setMdp(c)}>
              <span className="sr-only">Réinitialiser le mot de passe de {c.prenom} {c.nom}</span>
            </Button>
            {c.id !== session?.user?.id && (
              <Button variante="fantome" taille="sm" onClick={() => void basculer(c)}>
                {c.actif ? 'Désactiver' : 'Réactiver'}
                <span className="sr-only"> {c.prenom} {c.nom}</span>
              </Button>
            )}
          </div>
        )}
      />
      {comptes.data && <Pagination page={page} totalPages={comptes.data.totalPages} onPageChange={setPage} total={comptes.data.total} itemLabel="compte" />}

      {edite && (
        <FormulaireCompte
          initial={edite}
          onFermer={fermerEdition}
          onCree={(c) => {
            fermerEdition()
            setCree(c)
          }}
        />
      )}
      {cree && <ModaleSecret compte={cree} onFermer={() => setCree(null)} />}
      {mdp && <ModaleMotDePasse compte={mdp} onFermer={() => setMdp(null)} />}
    </div>
  )
}

// useSearchParams impose une frontière Suspense pour le pré-rendu.
export default function PageComptes() {
  return (
    <Suspense>
      <ContenuComptes />
    </Suspense>
  )
}
