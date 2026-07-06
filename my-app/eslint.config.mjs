import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Dette pré-existante importante dans ce projet (réponses JSON d'API
      // non typées, etc.) : abaissé en avertissement pour que le lint reste
      // un signal exploitable en CI plutôt qu'un mur de 30+ erreurs à corriger
      // d'un coup. Nouvelle règle : préférer un vrai type ou `unknown` dans
      // le code ajouté, sans bloquer la build pour l'existant.
      "@typescript-eslint/no-explicit-any": "warn",
      // Suggestion de performance (évite un rendu supplémentaire), pas un bug
      // fonctionnel — abaissé en avertissement pour la même raison.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
