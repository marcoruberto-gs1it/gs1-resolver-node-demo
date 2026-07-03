const express = require('express');
const cors = require('cors');
const gs1encoder = require('gs1encoder'); // Utilizzato internamente per futuri parsing di IA

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// ============================================================================
// DATI STATICI DEL PRODOTTO (MOCK COMPLIANT CON LO STANDARD)
// Basato su GTIN: 08005360007746, Lotto: LOTTO123, Scadenza: 261031
// ============================================================================
const TARGET_GTIN = "08005360007746";

// Struttura Linkset ufficiale (RFC 9264 / GS1 Resolver Standard)
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

// Struttura JSON-LD nativa del Resolver (GS1 Web Vocabulary)
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

    // 1. Controllo di corrispondenza del GTIN di test
    if (gtin !== TARGET_GTIN) {
        return res.status(404).json({ error: "GS1 Identifiers not found on this resolver." });
    }

    // 2. Intercettazione Query Parameters
    const linkTypeRequested = req.query.linkType; // es. gs1:recipeInfo o la versione estesa

    // 3. PRIORITÀ 1: Richiesta esplicita di LINKSET (application/linkset+json)
    if (req.accepts('application/linkset+json')) {
        res.set('Content-Type', 'application/linkset+json');
        return res.status(200).json(linksetResponse);
    }

    // 4. PRIORITÀ 2: Richiesta dati strutturati JSON-LD (application/ld+json)
    if (req.accepts('application/ld+json')) {
        res.set('Content-Type', 'application/ld+json');
        return res.status(200).json(jsonldResponse);
    }

    // 5. PRIORITÀ 3: Richiesta Web Standard (HTML) o qualsiasi altro client (Browser/Smartphone) -> REDIRECT
    // Gestione dell'attributo short-name o full-URI per il linkType
    let targetVocabKey = "https://ref.gs1.org/voc/pip"; // default fallback

    if (linkTypeRequested) {
        if (linkTypeRequested.includes('recipeInfo') || linkTypeRequested === 'gs1:recipeInfo') {
            targetVocabKey = "https://ref.gs1.org/voc/recipeInfo";
        } else if (linkTypeRequested.includes('pip') || linkTypeRequested === 'gs1:pip') {
            targetVocabKey = "https://ref.gs1.org/voc/pip";
        }
    }

    // Estraiamo il link corrispondente dal linkset
    const linksFound = linksetResponse.linkset[0][targetVocabKey] || linksetResponse.linkset[0]["https://ref.gs1.org/voc/defaultLink"];
    const targetUrl = linksFound[0].href;

    // Come da standard GS1 1.2.0, usiamo HTTP 307 (Temporary Redirect)
    // valorizzando l'header 'Link' per la tracciabilità del tipo di relazione ed il Linkset correlato
    res.set('Link', `<${targetUrl}>; rel="${targetVocabKey}"`);
    return res.redirect(307, targetUrl);
});

// Avvio del Server
app.listen(port, () => {
    console.log(`🚀 GS1 Conformant Resolver attivo sulla porta ${port}`);
});