import { redirect } from 'next/navigation'

// Adresse utilisée par les actions rapides du tableau de bord : la création
// se fait dans une fenêtre de la liste des comptes.
export default function PageNouveauCompte() {
  redirect('/admin/utilisateurs?nouveau=1')
}
