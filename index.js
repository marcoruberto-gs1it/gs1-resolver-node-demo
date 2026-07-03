const express = require('express');
const cors = require('cors');
const gs1encoder = require('gs1encoder'); // Il pacchetto NPM funzionante!

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// ============================================================================
// DATABASE STATICO (Mock per il Proof of Concept)
// Dati: /01/08005360007746/10/LOTTO123?17=261031
// ============================================================================
const prodottoMock = {
    gtin: "08005360007746",
    links: {
        // Product Information Page (Default / Fallback)
        "gs1:pip": "https://marcoruberto-gs1it.github.io/demo-gs1-italy-digital-link-web-vocabulary/01/08005360007746/10/LOTTO123?17=261031",
        // Tracciabilità
        "gs1:traceability": "https://example.com/tracciabilita/08005360007746",
        // Informazioni Nutrizionali / Ricette
        "gs1:recipeInfo": "https://example.com/ricette/08005360007746"
    },
    jsonld: {
        "@context": [
            "https://gs1.github.io/GS1WebVocab/gs1.jsonld",
            { "@vocab": "https://gs1.org/vocab/" }
        ],
        "@id": "https://id.gs1.org/01/08005360007746/10/LOTTO123",
        "@type": "Product",
        "gtin": "08005360007746",
        "productName": "Prodotto Demo GS1 Italy",
        "lotNumber": "LOTTO123",
        "expirationDate": "2026-10-31", // Corrisponde all'AI 17=261031
        "description": "Dati di prodotto esposti tramite Resolver Node.js conforme a GS1"
    }
};

// ============================================================================
// LOGICA DEL RESOLVER (Rotta dinamica GS1 Digital Link)
// ============================================================================
app.get('/01/:gtin/10/:lot', (req, res) => {
    const { gtin, lot } = req.params;
    
    // 1. Lettura dei parametri della Query String (AI secondari)
    // L'Application Identifier (AI) 17 è la data di scadenza (es. ?17=261031)
    const expiryDate = req.query['17']; 
    
    // Il linkType richiesto dal client (es. app dello scanner)
    const linkType = req.query.linkType || 'gs1:pip';

    // 2. Controllo Identificativi Primari
    if (gtin !== prodottoMock.gtin) {
        return res.status(404).json({ error: "Prodotto non trovato nel resolver." });
    }

    // 3. CONTENT NEGOTIATION (Standard GS1 1.2.0)
    // Verifichiamo se il client accetta JSON-LD (Dati strutturati)
    const acceptsJsonLd = req.accepts('application/ld+json');

    if (acceptsJsonLd) {
        // Creiamo una copia dell'oggetto JSON-LD di base per arricchirlo
        const responseData = { ...prodottoMock.jsonld };
        
        // Dinamizziamo il JSON-LD con i dati letti dall'URI
        responseData.lotNumber = lot;
        if (expiryDate) {
            responseData.encodedExpirationDate = expiryDate;
            // Potresti usare gs1encoder qui per parsare '261031' in '2026-10-31'
        }

        res.set('Content-Type', 'application/ld+json');
        
        // Risposta dati diretta (HTTP 200) come raccomandato per B2B/Sistemi Informatici
        return res.status(200).json(responseData);
    }

    // 4. GESTIONE REDIRECT (Standard HTTP e Browser)
    // Se il linkType non è nel nostro database, facciamo un fallback sulla Product Information Page (PIP)
    const redirectTarget = prodottoMock.links[linkType] || prodottoMock.links['gs1:pip'];

    // Lo standard GS1 esige un redirect HTTP 307 (Temporary Redirect).
    // Questo evita che i browser e gli smartphone mettano in cache il redirect,
    // garantendo che letture future con linkType diversi funzionino sempre.
    return res.redirect(307, redirectTarget);
});

// Avvio del Server
app.listen(port, () => {
    console.log(`✅ GS1 Resolver (Powered by gs1encoder) attivo sulla porta ${port}`);
    console.log(`Per testare il redirect (Browser): http://localhost:${port}/01/08005360007746/10/LOTTO123?17=261031`);
    console.log(`Per testare i Dati (JSON-LD): curl -H "Accept: application/ld+json" http://localhost:${port}/01/08005360007746/10/LOTTO123?17=261031`);
});