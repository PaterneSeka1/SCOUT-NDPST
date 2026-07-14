'use client'

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  ResponsiveContainer,
} from 'recharts'
import { formatMontantFCFA } from '@/lib/cotisations'

// Encre/grille reprises de la charte du dashboard — hairline, jamais en pointillés.
const GRIDLINE = '#e1e0d9'
const AXE = '#c3c2b7'
const TEXTE_AXE = '#898781'
const TEXTE_CATEGORIE = '#374151'

const CLS_CARTE = 'bg-white rounded-xl border border-gray-200 p-4 sm:p-5'
const CLS_TITRE = 'text-sm font-semibold text-gray-800 mb-4'

function hauteurGraphique(nbBarres: number): number {
  // ~44px par barre + marge pour les axes, jamais moins que 3 barres visibles.
  return Math.max(3, nbBarres) * 44 + 40
}

interface EtiquetteValeurProps {
  x: number
  y: number
  width: number
  height: number
  value: number
  formatter?: (v: number) => string
}

function EtiquetteValeur({ x, y, width, height, value, formatter }: EtiquetteValeurProps) {
  const texte = formatter ? formatter(value) : value
  return (
    <text
      x={x + width + 8}
      y={y + height / 2}
      dy={4}
      fill={TEXTE_CATEGORIE}
      fontSize={13}
      fontWeight={600}
      textAnchor="start"
    >
      {texte}
    </text>
  )
}

interface GraphiqueBarresProps {
  data: { name: string; value: number; couleur: string; nomComplet?: string }[]
  formatterValeur?: (v: number) => string
  formatterTooltip?: (v: number) => string
}

/** Tronque un nom trop long pour l'axe, en gardant le nom complet pour l'infobulle. */
function nomCourt(nom: string, longueurMax = 26): string {
  const sansPrefixe = nom.replace(/^Paroisse\s+/i, '')
  return sansPrefixe.length > longueurMax ? `${sansPrefixe.slice(0, longueurMax - 1).trimEnd()}…` : sansPrefixe
}

function GraphiqueBarresHorizontal({ data, formatterValeur, formatterTooltip }: GraphiqueBarresProps) {
  const valeurMax = Math.max(...data.map((d) => d.value), 1)
  return (
    <ResponsiveContainer width="100%" height={hauteurGraphique(data.length)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }} barSize={20}>
        <CartesianGrid horizontal={false} stroke={GRIDLINE} />
        <XAxis
          type="number"
          domain={[0, valeurMax * 1.15]}
          tick={{ fill: TEXTE_AXE, fontSize: 12 }}
          axisLine={{ stroke: AXE }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fill: TEXTE_CATEGORIE, fontSize: 13 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(11,11,11,0.04)' }}
          formatter={(value) => (formatterTooltip ? formatterTooltip(Number(value)) : value)}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.nomComplet ?? label}
          contentStyle={{ borderRadius: 8, border: '1px solid #e1e0d9', fontSize: 13 }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.couleur} />
          ))}
          <LabelList dataKey="value" content={(props: any) => <EtiquetteValeur {...props} formatter={formatterValeur} />} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// --- Utilisateurs par catégorie ---------------------------------------------
// Reprend les couleurs déjà associées à ces catégories ailleurs dans
// l'application (COULEURS_ROLES : parents en violet, scouts en orange) pour
// que l'identité visuelle reste cohérente entre les écrans.
export function GraphiqueUtilisateursParCategorie({
  staff,
  parents,
  comptesScouts,
}: {
  staff: number
  parents: number
  comptesScouts: number
}) {
  const data = [
    { name: 'Staff (chefs, responsables…)', value: staff, couleur: '#27ae60' },
    { name: 'Parents', value: parents, couleur: '#9333ea' },
    { name: 'Comptes scouts', value: comptesScouts, couleur: '#ea580c' },
  ]
  return (
    <div className={CLS_CARTE}>
      <h2 className={CLS_TITRE}>Utilisateurs par catégorie</h2>
      <GraphiqueBarresHorizontal data={data} />
    </div>
  )
}

// --- Cotisations -------------------------------------------------------------
// Validée/à finaliser est un état, pas une identité : couleurs de statut fixes
// (vert = good, ambre = warning), jamais les teintes catégorielles.
export function GraphiqueCotisations({ payees, enAttente }: { payees: number; enAttente: number }) {
  const data = [
    { name: 'Validées', value: payees, couleur: '#0ca30c' },
    { name: 'À finaliser', value: enAttente, couleur: '#fab219' },
  ]

  if (payees === 0 && enAttente === 0) {
    return (
      <div className={CLS_CARTE}>
        <h2 className={CLS_TITRE}>Cotisations (toutes paroisses)</h2>
        <p className="text-sm text-gray-400 italic">Aucune cotisation enregistrée pour l&apos;instant.</p>
      </div>
    )
  }

  return (
    <div className={CLS_CARTE}>
      <h2 className={CLS_TITRE}>Cotisations (toutes paroisses)</h2>
      <GraphiqueBarresHorizontal data={data} formatterValeur={formatMontantFCFA} formatterTooltip={formatMontantFCFA} />
    </div>
  )
}

// --- Scouts par paroisse ------------------------------------------------------
// Une seule teinte : la longueur des barres encode déjà la magnitude, la
// couleur n'a pas à re-coder ce que la barre montre (cf. anti-patterns).
export function GraphiqueScoutsParParoisse({ paroisses }: { paroisses: { nom: string; scouts: number }[] }) {
  const data = [...paroisses]
    .sort((a, b) => b.scouts - a.scouts)
    .map((p) => ({ name: nomCourt(p.nom), nomComplet: p.nom, value: p.scouts, couleur: '#27ae60' }))

  if (data.length === 0) {
    return (
      <div className={CLS_CARTE}>
        <h2 className={CLS_TITRE}>Scouts par paroisse</h2>
        <p className="text-sm text-gray-400 italic">Aucune paroisse enregistrée.</p>
      </div>
    )
  }

  return (
    <div className={CLS_CARTE}>
      <h2 className={CLS_TITRE}>Scouts par paroisse</h2>
      <GraphiqueBarresHorizontal data={data} />
    </div>
  )
}
