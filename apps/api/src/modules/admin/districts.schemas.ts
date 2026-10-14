import { z } from 'zod'
import { champTexte, champTexteNettoye, corpsAdmin } from './admin.schemas'

// POST et PATCH /admin/districts : le nom (nettoyé) est toujours requis.
export const SchemaDistrict = corpsAdmin({ nom: champTexteNettoye('nom') }).transform((corps, ctx) => {
  if (!corps.nom) {
    ctx.addIssue({ code: 'custom', message: 'Le nom du district est requis', path: ['nom'] })
    return z.NEVER
  }
  return { nom: corps.nom }
})
export type DonneesDistrict = z.infer<typeof SchemaDistrict>

// POST /admin/districts/:id/commissaire : identifiant transmis tel quel.
export const SchemaDesignationCommissaire = corpsAdmin({ utilisateurId: champTexte('utilisateurId') }).transform(
  (corps, ctx) => {
    if (!corps.utilisateurId?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Le membre à désigner est requis', path: ['utilisateurId'] })
      return z.NEVER
    }
    return { utilisateurId: corps.utilisateurId }
  },
)
export type DonneesDesignationCommissaire = z.infer<typeof SchemaDesignationCommissaire>
