import { redirect } from 'next/navigation'

// L'application ne contient que l'espace d'administration.
export default function Accueil() {
  redirect('/admin')
}
