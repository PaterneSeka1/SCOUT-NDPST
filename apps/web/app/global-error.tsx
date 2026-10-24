'use client'

import './globals.css'

// Erreur dans le layout racine lui-même : ce composant le remplace entièrement
// (balises <html> et <body> comprises). Les variables de thème (--cp…) ne sont
// donc pas définies ici : couleurs neutres uniquement.
export default function ErreurGlobale({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <head>
        <title>Erreur</title>
      </head>
      <body className="antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
          <h1 className="text-lg font-semibold text-gray-800">Une erreur est survenue.</h1>
          <p className="text-sm text-gray-500">Réessayez, ou revenez plus tard si le problème persiste.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-gray-700"
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  )
}
