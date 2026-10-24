'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LABELS_BRANCHES, ROLES_BRANCHE } from '@scout/shared'
import { Button, ButtonLink, Card, CardBody, Field, Input, PageHeader, Select, Textarea } from '@/components/ui'
import { useCreerProgramme, useMaBranche } from '@/hooks/useProgrammes'
import { useSession } from '@/lib/session-client'

const OPTIONS_BRANCHES = Object.entries(LABELS_BRANCHES).map(([valeur, libelle]) => ({ valeur, libelle }))

export default function PageNouveauProgramme() {
  const router = useRouter()
  const { data: session } = useSession()
  const estBranche = ROLES_BRANCHE.includes(session?.user.role ?? '')
  const maBranche = useMaBranche(estBranche)
  const creer = useCreerProgramme()

  const [brancheChoisie, setBrancheChoisie] = useState('')
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [periodeDebut, setPeriodeDebut] = useState('')
  const [periodeFin, setPeriodeFin] = useState('')
  const [erreurs, setErreurs] = useState<{ titre?: string; periode?: string }>({})

  // L'encadrement de branche ne crée que pour sa branche (imposé aussi par l'API).
  const brancheType = estBranche ? (maBranche.data?.brancheType ?? '') : brancheChoisie

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    const nouvelles: typeof erreurs = {}
    if (!titre.trim()) nouvelles.titre = 'Le titre est obligatoire.'
    if (!periodeDebut || !periodeFin) nouvelles.periode = 'La période est obligatoire.'
    else if (new Date(periodeFin) <= new Date(periodeDebut)) nouvelles.periode = 'La date de fin doit être après la date de début.'
    setErreurs(nouvelles)
    if (Object.keys(nouvelles).length) return
    try {
      const programme = await creer.mutateAsync({
        titre: titre.trim(),
        description: description.trim() || null,
        periodeDebut: new Date(periodeDebut).toISOString(),
        periodeFin: new Date(periodeFin).toISOString(),
        brancheType: brancheType || null,
      })
      toast.success('Programme créé.')
      router.push(`/dashboard/programmes/${programme.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Création impossible.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        titre="Nouveau programme"
        miettes={[
          { libelle: 'Tableau de bord', href: '/dashboard' },
          { libelle: 'Programmes', href: '/dashboard/programmes' },
          { libelle: 'Nouveau' },
        ]}
      />
      <Card>
        <CardBody>
          <form onSubmit={soumettre} className="space-y-4">
            <Field label="Titre" requis erreur={erreurs.titre}>
              {(p) => <Input {...p} value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Programme du premier trimestre" />}
            </Field>
            <Field
              label="Branche"
              aide={estBranche ? 'Programme de votre branche.' : 'Laissez vide pour un programme du groupe (toutes branches).'}
            >
              {(p) => (
                <Select
                  {...p}
                  value={brancheType}
                  disabled={estBranche}
                  onChange={(e) => setBrancheChoisie(e.target.value)}
                  vide="Groupe (toutes branches)"
                  options={OPTIONS_BRANCHES}
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Début" requis erreur={erreurs.periode}>
                {(p) => <Input {...p} type="date" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} />}
              </Field>
              <Field label="Fin" requis>
                {(p) => <Input {...p} type="date" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} />}
              </Field>
            </div>
            <Field label="Description et objectifs">
              {(p) => <Textarea {...p} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />}
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <ButtonLink href="/dashboard/programmes" variante="secondaire">
                Annuler
              </ButtonLink>
              <Button type="submit" chargement={creer.isPending}>
                Créer le programme
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
