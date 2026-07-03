const express = require('express');
const cors = require('cors');
// Inizializza il Toolkit del GS1 Syntax Engine
const GS1DigitalLinkToolkit = require('gs1-syntax-engine');
const toolkit = new GS1DigitalLinkToolkit();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// ============================================================================
// 1. DATABASE STATICO (Mock)
// Basato sui dati: /01/08005360007746/10/LOTTO123?17=261031
// ============================================================================
const prodottoMock = {
  gtin: '08005360007746',
  links: {
    // Product Information Page (Default)
    'gs1:pip':
      'https://marcoruberto-gs1it.github.io/demo-gs1-italy-digital-link-web-vocabulary/01/08005360007746/10/LOTTO123?17=261031',
    // Scheda di Sostenibilità / Tracciabilità
    'gs1:traceability': 'https://example.com/tracciabilita/08005360007746',
    // Informazioni Nutrizionali/Ricette
    'gs1:recipeInfo': 'https://example.com/ricette/08005360007746',
  },
  jsonld: {
    '@context': [
      'https://gs1.github.io/GS1WebVocab/gs1.jsonld',
      { '@vocab': 'https://gs1.org/vocab/' },
    ],
    '@id': 'https://id.gs1.org/01/08005360007746/10/LOTTO123',
    '@type': 'Product',
    gtin: '08005360007746',
    productName: 'Prodotto Demo GS1 Italy',
    lotNumber: 'LOTTO123',
    expirationDate: '2026-10-31', // Decodificato dal query param '17=261031'
    description:
      'Dati di prodotto esposti tramite Resolver Node.js conforme a GS1',
  },
};

// ============================================================================
// 2. LOGICA DEL RESOLVER (Rotta dinamica)
// Intercettiamo GTIN (01) e LOTTO (10)
// ============================================================================
app.get('/01/:gtin/10/:lot', (req, res) => {
  const { gtin, lot } = req.params;

  // Costruiamo l'URI completo scansionato per passarlo al syntax engine
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const scannedURI = `${protocol}://${host}${req.originalUrl}`;

  // A. VALIDAZIONE SINTASSI TRAMITE gs1-syntax-engine
  try {
    // Rimuoviamo il dominio per validare solo il path GS1
    const gs1Path = req.originalUrl.split('?')[0];
    const isValid = toolkit.isValidGS1DigitalLink(
      `https://id.gs1.org${gs1Path}`
    );
    if (!isValid) {
      return res
        .status(400)
        .send("Errore: L'URI non è un GS1 Digital Link valido.");
    }
  } catch (e) {
    console.warn('Avviso dal syntax engine:', e.message);
  }

  // B. CONTROLLO IDENTIFICATIVI (Rispondiamo solo al nostro GTIN)
  if (gtin !== prodottoMock.gtin) {
    return res
      .status(404)
      .json({ error: 'Prodotto non trovato nel resolver.' });
  }

  // C. LETTURA PARAMETRI E LINKTYPE
  // Il parametro '17' identifica la data di scadenza (es. ?17=261031)
  const expiryDate = req.query['17'];
  // Il linkType richiesto dal client (di default usiamo gs1:pip)
  const linkType = req.query.linkType || 'gs1:pip';

  // D. CONTENT NEGOTIATION (Standard GS1 1.2.0)
  // Il client accetta JSON-LD (es. un'app B2B, un sistema ERP o un crawler)
  const acceptsJsonLd = req.accepts('application/ld+json');

  if (acceptsJsonLd) {
    // Se il client vuole i dati strutturati, ignoriamo i redirect e mandiamo il JSON-LD
    // Possiamo anche arricchire il JSON-LD con lotto e scadenza letti real-time
    const responseData = { ...prodottoMock.jsonld };
    responseData.lotNumber = lot;
    if (expiryDate) {
      // Semplice logica dimostrativa: passa il valore crudo se presente
      responseData.encodedExpirationDate = expiryDate;
    }

    res.set('Content-Type', 'application/ld+json');
    // Lo standard GS1 consiglia HTTP 200 per le risposte dati
    return res.status(200).json(responseData);
  }

  // E. REDIRECT BEHAVIOUR (Smartphone o Browser standard)
  // Se il linkType non è supportato, fallback sul default (pip)
  const redirectTarget =
    prodottoMock.links[linkType] || prodottoMock.links['gs1:pip'];

  // Lo standard GS1 richiede un redirect HTTP 307 (Temporary Redirect)
  // per impedire ai browser di mettere in cache il redirect se il linkType cambia.
  return res.redirect(307, redirectTarget);
});

// Avvio del Server
app.listen(port, () => {
  console.log(`✅ GS1 Resolver in esecuzione sulla porta ${port}`);
  console.log(
    `Prova il JSON-LD: curl -H "Accept: application/ld+json" http://localhost:${port}/01/08005360007746/10/LOTTO123?17=261031`
  );
});
