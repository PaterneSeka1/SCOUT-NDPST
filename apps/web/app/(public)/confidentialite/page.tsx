import type { Metadata } from 'next'
import Link from 'next/link'
import { getIdentite } from '@/lib/identite-serveur'
import { nomAffiche } from '@/lib/identite'
import { EnTetePage } from '@/components/public/EnTetePage'

export const metadata: Metadata = {
  title: 'Données personnelles',
  description: 'Comment le groupe scout utilise les informations transmises par le site et comment exercer vos droits.',
  alternates: { canonical: '/confidentialite' },
}

// Contenu factuel, aligné sur le fonctionnement réel de l'application
// (formulaire de demande, espace membres, publication des photos). Il doit
// être relu et validé par la direction du groupe (voir docs/refonte-ux-ui.md).
export default async function PageConfidentialite() {
  const identite = await getIdentite()
  const nom = nomAffiche(identite)

  const sections: { titre: string; contenu: React.ReactNode }[] = [
    {
      titre: 'Ce que nous recevons par ce site',
      contenu: (
        <>
          <p>
            Le formulaire « Nous rejoindre » transmet vos nom, prénom, téléphone, e-mail facultatif et message. Pour une inscription, il
            transmet aussi le prénom, le nom et la date de naissance du jeune, ainsi que la branche souhaitée.
          </p>
          <p>Aucune information médicale n’est demandée par ce formulaire et aucun compte n’est créé lors de l’envoi.</p>
        </>
      ),
    },
    {
      titre: 'Pourquoi et par qui elles sont utilisées',
      contenu: (
        <p>
          Ces informations servent uniquement à traiter votre demande et à vous recontacter. Elles sont consultées par la direction de{' '}
          {nom} depuis l’espace de gestion du groupe, ne sont jamais publiées et ne sont pas utilisées à des fins commerciales.
        </p>
      ),
    },
    {
      titre: 'Photos et contenus publiés',
      contenu: (
        <p>
          Les photos où figurent des mineurs ne sont publiées qu’après vérification de l’autorisation de leurs parents ou représentants. Seuls
          les membres de la maîtrise dont le profil public a été activé par la direction du groupe apparaissent sur la page « La
          maîtrise ».
        </p>
      ),
    },
    {
      titre: 'Cookies',
      contenu: (
        <p>
          Le site public n’utilise pas de cookie de mesure d’audience ni de publicité. Seul l’espace membres dépose des cookies techniques
          de session, indispensables à la connexion.
        </p>
      ),
    },
    {
      titre: 'Vos droits',
      contenu: (
        <p>
          Vous pouvez demander à consulter, corriger ou supprimer les informations vous concernant, ou retirer une autorisation de
          publication, en écrivant à la direction du groupe
          {identite.email ? (
            <>
              {' '}
              à l’adresse{' '}
              <a href={`mailto:${identite.email}`} className="font-medium text-primaire underline underline-offset-2">
                {identite.email}
              </a>
            </>
          ) : null}{' '}
          ou depuis le{' '}
          <Link href="/nous-rejoindre?objet=contact#formulaire" className="font-medium text-primaire underline underline-offset-2">
            formulaire de contact
          </Link>
          .
        </p>
      ),
    },
  ]

  return (
    <>
      <EnTetePage surtitre="Données personnelles" titre="Vos informations, notre responsabilité" />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="space-y-10">
          {sections.map((s) => (
            <section key={s.titre} className="border-t border-ligne pt-6">
              <h2 className="titre-display text-2xl font-semibold text-encre">{s.titre}</h2>
              <div className="mt-3 space-y-3 text-lg leading-relaxed text-encre-douce">{s.contenu}</div>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
