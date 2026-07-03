const express = require('express');
const cors = require('cors');
const gs1encoder = require('gs1encoder'); 

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// ============================================================================
// DATI STATICI DEL PRODOTTO (GS1 RESOLVER COMPLIANT)
// ============================================================================
const TARGET_GTIN = "08005360007746";

const linksetResponse = {
    "linkset": [
        {
            "anchor": "https://id.gs1.org/01/08005360007746/10/LOTTO123?17=261031",
            "description": "Prodotto Demo GS1 Italy - Pasta/Riso",
            "https://ref.gs1.org/voc/pip": [
                {
                    "href": "https://marcoruberto-gs1it.github.io/demo-gs1-italy-digital-link-web-vocabulary/01/08005360007746/10/LOTTO123?17=261031",
                    "title": "Product Information Page (Digital Link Demo)",
                    "type": "text/html",
                    "hreflang": ["it"]
                }
            ],
            "https://ref.gs1.org/voc/recipeInfo": [
                {
                    "href": "https://example.com/ricette/08005360007746",
                    "title": "Ricette Consigliate",
                    "type": "text/html",
                    "hreflang": ["it"]
                }
            ],
            "https://ref.gs1.org/voc/defaultLink": [
                {
                    "href": "https://marcoruberto-gs1it.github.io/demo-gs1-italy-digital-link-web-vocabulary/01/08005360007746/10/LOTTO123?17=261031",
                    "title": "Default Link"
                }
            ]
        }
    ]
};

const jsonldResponse = {
    "@context": [
        "https://gs1.github.io/GS1WebVocab/gs1.jsonld",
        { "@vocab": "https://gs1.org/vocab/" }
    ],
    "@id": "https://id.gs1.org/01/08005360007746/10/LOTTO123",
    "@type": "Product",
    "gtin": "08005360007746",
    "productName": "Prodotto Demo GS1 Italy",
    "lotNumber": "LOTTO123",
    "expirationDate": "2026-10-31",
    "comment": "Risposta in formato nativo GS1 JSON-LD"
};

// ============================================================================
// LOGICA DI ROUTING E CONTENT NEGOTIATION GS1
// ============================================================================
app.get('/01/:gtin/10/:lot', (req, res) => {
  const { gtin, lot } = req.params;
  const linkTypeRequested = req.query.linkType; 

  // 1. Validazione preliminare del GTIN
  if (gtin !== TARGET_GTIN) {
      return res.status(404).json({ error: "GS1 Identifiers not found on this resolver." });
  }

  const rawAccept = req.headers['accept'] || '';

  // ------------------------------------------------------------------------
  // MDEIA TYPE PRIORITIZATION (Risolve il problema del browser)
  // ------------------------------------------------------------------------
  
  // Se l'utente sta navigando da Browser (ha "text/html" nell'header o usa una query string comune)
  // Forziamo il REDIRECT (Caso 3) prima di qualsiasi valutazione API dati.
  if (rawAccept.includes('text/html') || req.accepts('html') || rawAccept === '*/*' || !rawAccept) {
      
      let targetVocabKey = "https://ref.gs1.org/voc/pip"; // Fallback standard (Product Information Page)

      // Parsing del linkType
      if (linkTypeRequested) {
          if (linkTypeRequested.includes('recipeInfo') || linkTypeRequested === 'gs1:recipeInfo') {
              targetVocabKey = "https://ref.gs1.org/voc/recipeInfo";
          } else if (linkTypeRequested.includes('pip') || linkTypeRequested === 'gs1:pip') {
              targetVocabKey = "https://ref.gs1.org/voc/pip";
          }
      }

      // Estrazione URL
      const linksFound = linksetResponse.linkset[0][targetVocabKey] || linksetResponse.linkset[0]["https://ref.gs1.org/voc/defaultLink"];
      const targetUrl = linksFound[0].href;

      // Header standard GS1 e Redirect Temporaneo 307
      res.set('Link', `<${targetUrl}>; rel="${targetVocabKey}"`);
      return res.redirect(307, targetUrl);
  }

  // SE NON È UN BROWSER (Richieste API pure, cURL, App di scansione B2B)
  
  // CASO 1: Richiesta esplicita del Linkset
  if (rawAccept.includes('application/linkset+json')) {
      res.set('Content-Type', 'application/linkset+json');
      return res.status(200).json(linksetResponse);
  }

  // CASO 2: Richiesta esplicita di dati strutturati JSON-LD
  if (rawAccept.includes('application/ld+json')) {
      res.set('Content-Type', 'application/ld+json');
      return res.status(200).json(jsonldResponse);
  }

  // Fallback se nessun header corrisponde
  return res.status(406).send('Not Acceptable - Formato non supportato dal Resolver GS1');
});

app.get('/', (req, res) => {
    res.send('GS1 Conformant Resolver PoC attivo. Naviga su un URI di un prodotto per testarlo.');
});

app.listen(port, () => {
    console.log(`🚀 GS1 Conformant Resolver online sulla porta ${port}`);
});