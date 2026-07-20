'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { confirmer } from '@/app/components/ConfirmDialog'

const COLONNES_ATTENDUES = [
  'nom', 'prenom', 'dateNaissance', 'sexe', 'brancheType', 'matricule',
  'contactNom', 'contactPrenom', 'contactTelephone', 'contactRelation',
]

const LIGNE_EXEMPLE = {
  nom: 'Kouassi', prenom: 'Jean', dateNaissance: '2015-03-20', sexe: 'MASCULIN',
  brancheType: 'LOUVETEAUX', matricule: '',
  contactNom: 'Kouassi', contactPrenom: 'Marie', contactTelephone: '0712345678', contactRelation: 'Mère',
}

interface LigneCsv {
  [colonne: string]: string
}

interface ResultatLigne {
  ligne: number
  succes: boolean
  erreur?: string
  nom?: string
  prenom?: string
}

function telechargerModele() {
  const csv = Papa.unparse([LIGNE_EXEMPLE], { columns: COLONNES_ATTENDUES })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'modele-import-scouts.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function PageImporterScouts() {
  const router = useRouter()
  const [lignes, setLignes] = useState<LigneCsv[]>([])
  const [nomFichier, setNomFichier] = useState('')
  const [erreurFichier, setErreurFichier] = useState('')
  const [soumission, setSoumission] = useState(false)
  const [resultats, setResultats] = useState<ResultatLigne[] | null>(null)

  const handleFichier = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setErreurFichier('')
    setResultats(null)
    setNomFichier(fichier.name)

    Papa.parse<LigneCsv>(fichier, {
      header: true,
      skipEmptyLines: true,
      complete: (resultat) => {
        if (resultat.errors.length > 0) {
          setErreurFichier(`Erreur de lecture du fichier : ${resultat.errors[0].message}`)
          setLignes([])
          return
        }
        if (resultat.data.length === 0) {
          setErreurFichier('Le fichier ne contient aucune ligne exploitable')
          setLignes([])
          return
        }
        setLignes(resultat.data)
      },
      error: (err) => setErreurFichier(err.message),
    })
  }

  const importer = async () => {
    if (lignes.length === 0) return
    const ok = await confirmer({
      titre: `Importer ${lignes.length} scout${lignes.length > 1 ? 's' : ''} ?`,
      description: `${lignes.length} scout${lignes.length > 1 ? 's' : ''} du fichier "${nomFichier}" ${lignes.length > 1 ? 'seront' : 'sera'} créé${lignes.length > 1 ? 's' : ''}.`,
      labelConfirmer: 'Importer',
    })
    if (!ok) return
    setSoumission(true)
    setResultats(null)
    try {
      const res = await fetch('/api/scouts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scouts: lignes }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Erreur lors de l'import"); return }

      setResultats(data.resultats)
      if (data.nbSucces > 0) toast.success(`${data.nbSucces} scout${data.nbSucces > 1 ? 's' : ''} importé${data.nbSucces > 1 ? 's' : ''}.`)
      if (data.nbEchecs > 0) toast.error(`${data.nbEchecs} ligne${data.nbEchecs > 1 ? 's' : ''} en échec — voir le détail ci-dessous.`)
    } catch {
      toast.error('Erreur réseau. Veuillez réessayer.')
    } finally {
      setSoumission(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/scouts" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        ← Retour à la liste
      </Link>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Importer des scouts</h1>
        <p className="text-sm text-gray-500 mt-0.5">Inscription en masse depuis un fichier CSV, utile lors d&apos;une rentrée scoute.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={telechargerModele}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            📥 Télécharger le modèle CSV
          </button>
          <label className="bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium cursor-pointer text-center">
            📄 Choisir un fichier CSV
            <input type="file" accept=".csv,text/csv" onChange={handleFichier} className="hidden" />
          </label>
          {nomFichier && <span className="text-sm text-gray-500 truncate">{nomFichier}</span>}
        </div>

        <p className="text-xs text-gray-400">
          Colonnes attendues : {COLONNES_ATTENDUES.join(', ')}. Le matricule et le prénom/relation du contact sont optionnels, le reste est obligatoire.
        </p>

        {erreurFichier && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erreurFichier}</div>}

        {lignes.length > 0 && !resultats && (
          <>
            <div className="border-t border-gray-100 pt-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-2">Aperçu ({lignes.length} ligne{lignes.length > 1 ? 's' : ''})</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-100">
                      {COLONNES_ATTENDUES.map((c) => <th key={c} className="pr-4 py-1.5 whitespace-nowrap">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.slice(0, 10).map((ligne, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        {COLONNES_ATTENDUES.map((c) => <td key={c} className="pr-4 py-1.5 text-gray-700 whitespace-nowrap">{ligne[c] || '—'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {lignes.length > 10 && <p className="text-xs text-gray-400 mt-2">… et {lignes.length - 10} autre(s) ligne(s)</p>}
              </div>
            </div>

            <button
              onClick={importer}
              disabled={soumission}
              className="bg-[#1a4731] text-white px-5 py-2.5 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60"
            >
              {soumission ? 'Import en cours…' : `Importer ${lignes.length} scout${lignes.length > 1 ? 's' : ''}`}
            </button>
          </>
        )}

        {resultats && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Résultat de l&apos;import</h2>
            <div className="space-y-1.5">
              {resultats.map((r) => (
                <div key={r.ligne} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${r.succes ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <span className="flex-shrink-0">{r.succes ? '✅' : '❌'}</span>
                  <span className="flex-shrink-0 font-medium">Ligne {r.ligne}</span>
                  <span className="truncate">{r.succes ? `${r.prenom} ${r.nom} créé(e)` : r.erreur}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setLignes([]); setResultats(null); setNomFichier('') }}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Importer un autre fichier
              </button>
              <button
                onClick={() => router.push('/dashboard/scouts')}
                className="bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium"
              >
                Voir la liste des scouts
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
