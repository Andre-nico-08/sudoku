# Relazione Tecnica — AI Sudoku Vision & Tutor

**Materia:** Informatica / Laboratorio di Tecnologie Web  
**Progetto:** Sviluppo di una Web Application Multimodale basata su API Google Gemini  
**Stack Principale:** React 19, TypeScript, Tailwind CSS, Node.js (Express), `@google/genai`

---

## 1. Obiettivo e Flusso Utente (UX Workflow)

**AI Sudoku Vision & Tutor** consente di digitalizzare uno schema di Sudoku cartaceo partendo da una fotografia e offre un supporto didattico progressivo fino alla risoluzione completa:

1. **Acquisizione Immagine:** l'utente può caricare una foto dalla galleria oppure scattarla in tempo reale tramite webcam/fotocamera (con riquadro guida 3×3).
2. **Digitalizzazione OCR Multimodale:** l'immagine ottimizzata viene inviata al backend Express, che interroga Gemini per estrarre la matrice `9×9` in formato JSON strutturato (`0` = cella vuota, `1–9` = cifre rilevate).
3. **Verifica e Correzione Manuale:** lo schema appare su una griglia HTML interattiva (tastiera e tastierino numerico) che evidenzia in rosso eventuali conflitti su riga, colonna o blocco, permettendo di correggere errori di scansione prima di iniziare.
4. **Assistenza Intelligente e Risoluzione:** l'utente può richiedere un suggerimento guidato (**Suggerisci Mossa**) oppure completare istantaneamente lo schema (**Risolvi Sudoku**) distinguendo visivamente le cifre originali da quelle inserite dall'AI.

---

## 2. Architettura Scelta e Gestione API

L'applicazione adotta un'architettura **Full-Stack Client–Server** con netta separazione delle responsabilità:

- **Frontend (React + TypeScript + Vite + Tailwind CSS):** gestisce l'interfaccia a due zone (griglia interattiva `9×9` a sinistra, pannello Tutor e acquisizione a destra), la fotocamera (`getUserMedia`), la sintesi vocale (`Web Speech API`), l'ottimizzazione dell'immagine su `<canvas>` e il layer AR.
- **Backend Proxy (`server.ts` con Express):** espone le rotte `/api/sudoku/ocr` e `/api/sudoku/hint`, mantenendo la `GEMINI_API_KEY` esclusivamente lato server tramite `.env` / `process.env.GEMINI_API_KEY` (mai esposta al browser).
- **Integrazione `@google/genai` e Structured Outputs:**
  - **OCR (`/api/sudoku/ocr`):** utilizza `gemini-4-hydrogen` con `ThinkingLevel.LOW` e `responseMimeType: "application/json"` + `responseSchema` rigoroso (`grid` 9×9 di interi + `note` sulla nitidezza) per evitare errori di parsing.
  - **Tutor (`/api/sudoku/hint`):** utilizza `gemini-3.1-flash-lite` con `ThinkingLevel.MINIMAL` e `responseSchema` per generare spiegazioni didattiche in italiano brevi e puntuali a bassissima latenza.
- **Ottimizzazioni Prestazionali:**
  - Ridimensionamento client-side delle immagini a max `1024px` (JPEG qualità `0.82`) prima dell'invio all'OCR.
  - Riuso di un'unica istanza singleton di `GoogleGenAI` sul server e pre-calcolo delle cifre di blocco nel prompt.
  - Visualizzazione istantanea (`0 ms`) dei primi due livelli di aiuto con chiamata Gemini asincrona in background e cache locale per stato della griglia.

---

## 3. Funzionalità Bonus Implementate

Sono state integrate **tutte e cinque** le funzionalità d'eccellenza previste dalla traccia:

1. **Solutore Ibrido (Algoritmi):** la risoluzione completa e l'individuazione della prossima mossa più semplice (euristica MRV + ricerca di *Singoli Nudi* e *Singoli Nascosti*) avvengono in locale tramite algoritmo **Backtracking deterministico** (esattezza garantita al 100%). Gemini interviene esclusivamente per formulare la spiegazione logica in linguaggio naturale.
2. **Hint Progressivi a 3 Livelli (Didattica):** il pulsante *Suggerisci Mossa* guida il ragionamento per gradi:
   - *Livello 1:* evidenzia il solo blocco `3×3` interessato.
   - *Livello 2:* indica la cella esatta `(Riga, Colonna)`.
   - *Livello 3:* rivela la cifra, mostra la motivazione logica e abilita il pulsante *Applica Mossa*.
3. **Tutor Vocale (Audio):** integrazione della **Web Speech API** (`speechSynthesis`, lingua `it-IT`) per leggere ad alta voce la spiegazione della mossa con comando di avvio/interruzione.
4. **Avatar Interattivo (UI/UX):** mascotte SVG reattiva (`TutorAvatar`) che cambia espressione in tempo reale in base allo stato dell'applicazione (attesa, scansione OCR, elaborazione, suggerimento disponibile, errore/conflitto, schema completato).
5. **Overlay Fotografico AR Lite (HTML5 Canvas):** finestra dedicata che proietta le cifre risolte dall'AI direttamente sopra la foto cartacea originale dell'utente, con cursori interattivi per allineare margini e dimensione del carattere ed esportare l'immagine finale in PNG.

---

## 4. Screenshot dell'Applicazione

> **Nota per la consegna (esportazione PDF max 2 pagine):** inserire qui 2 screenshot acquisiti dall'app in esecuzione, ridimensionandoli affiancati così da mantenere il documento entro 2 pagine.

| Schermata 1 — Griglia Interattiva, Avatar e Hint Livello 3 | Schermata 2 — Overlay Fotografico (AR Lite) / Fotocamera |
| :--- | :--- |
| *[Inserire qui screenshot della vista principale con griglia 9×9, mascotte Tutor e pannello spiegazione logica]* | *[Inserire qui screenshot del modale AR Lite con i numeri verdi proiettati sulla foto del Sudoku]* |
