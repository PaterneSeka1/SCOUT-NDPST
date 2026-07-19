// Factorise les skeletons de chargement redéfinis à l'identique dans
// scouts/page.tsx, parents/page.tsx, utilisateurs/page.tsx, activites/page.tsx.

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse space-y-3">
      <div className="flex justify-between">
        <div className="h-4 bg-gray-200 rounded w-32" />
        <div className="h-5 bg-gray-100 rounded-full w-16" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-20" />
      <div className="flex gap-3 pt-1">
        <div className="h-3 bg-gray-100 rounded w-10" />
        <div className="h-3 bg-gray-100 rounded w-14" />
        <div className="h-3 bg-gray-100 rounded w-16" />
      </div>
    </div>
  )
}

export function SkeletonRow({ colonnes = 6 }: { colonnes?: number }) {
  return (
    <tr>
      {Array.from({ length: colonnes }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  )
}
