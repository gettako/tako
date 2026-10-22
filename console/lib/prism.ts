import Prism from "prismjs"
import "prismjs/components/prism-json"
import "prismjs/components/prism-bash"
import "prismjs/components/prism-yaml"
import "prismjs/components/prism-docker"
import "prismjs/components/prism-log"

if (typeof window !== "undefined" || typeof global !== "undefined") {
  if (!Prism.languages.dotenv) {
    Prism.languages.dotenv = {
      comment: {
        pattern: /(^|\s)#.*$/m,
        lookbehind: true,
        greedy: true,
      },
      property: {
        pattern: /^\s*[\w.-]+(?=\s*=)/m,
        greedy: true,
      },
      punctuation: /=/,
      string: {
        pattern: /("|')(?:\\.|(?!\1)[^\\\r\n])*\1/,
        greedy: true,
      },
      boolean: /\b(?:true|false)\b/i,
      number: /\b\d+(?:\.\d+)?\b/,
      variable: /\$\{[^}]+\}|\$[A-Z_0-9]+/i,
    }
  }
}

export { Prism }
