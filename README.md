# DevOps Manager · Dashboard personale

Dashboard personale per la gestione quotidiana del lavoro da DevOps Manager.
Nessun dato aziendale, nessun codice: solo il tuo layer organizzativo personale.

**Stack:** React + TypeScript + Vite + Tailwind. Build = **un singolo file HTML**
(`dist/index.html`) con JS e CSS inlinati. Nessuna installazione richiesta per
usarlo, nessuna libreria caricata da internet: funziona offline.

## Sezioni

- **Oggi** — 3 priorità del giorno, quick capture (inbox da smistare), focus
  della settimana, 1:1 in arrivo e azioni in scadenza.
- **Kanban personale** — le tue attività da manager (hiring, vendor, escalation,
  decisioni, architettura) con drag-and-drop, priorità, tag e aging delle card.
- **Team & 1:1** — due tab:
  - *Schede*: ruolo, skill, obiettivi, note, storico 1:1 con mood, prossimo 1:1.
  - *Skill matrix*: griglia persone × competenze a livelli (Base/Solido/Esperto)
    con copertura per competenza.
- **Sprint & Salute** — due tab:
  - *Sprint / Train*: obiettivi e retro (bene / da migliorare) di sprint e PI,
    più pannello rischi & impedimenti che ti porti tra sprint.
  - *Salute DORA*: voto settimanale 1–5 su lead time, freq. deploy, MTTR e
    change failure, con grafico di trend.
- **Decisioni & Azioni** — decision log (ADR leggero: contesto, alternative,
  scelta, **perché**) + action items con owner e scadenza.
- **Report** — resoconto sintetico stampabile (→ «Salva come PDF») che aggrega
  focus, sprint, kanban, team, DORA, azioni, rischi e decisioni.

## Dove finiscono i dati

I dati restano **sempre sul tuo PC**, mai in cloud. Due modalità, l'app sceglie
da sola:

1. **Doppio click su `dist/index.html`** (`file://`)
   → dati in **IndexedDB** del browser. Usa **Esporta** per salvarti un file
   JSON di backup quando vuoi (mettilo dove preferisci).

2. **Servito da `localhost` o da un host** (vedi sotto)
   → si sblocca **«Collega cartella su disco»**: l'app salva un file
   `dashboard.json` reale nella cartella che scegli e mantiene backup automatici
   a rotazione (ultimi 20) nella sottocartella `backups/`. Sopravvive alla
   pulizia della cache.

In entrambi i casi i pulsanti **Esporta / Importa JSON** sono sempre disponibili.

## Uso

### Versione pronta (consigliata per l'uso quotidiano)
Apri `dist/index.html` con doppio click. Fatto. Fai un **Esporta** ogni tanto
per il backup.

### Versione con file su disco + backup automatici
Servi la build da localhost (richiede Node solo per lanciare il server):

```bash
npm install
npm run build
npm run preview   # apre su http://localhost:4173
```

Poi nell'app clicca **«Collega cartella su disco»** e scegli una cartella.

## Sviluppo

```bash
npm install
npm run dev        # http://localhost:5173, hot reload
npm run build      # genera dist/index.html (file unico)
npm run typecheck  # controllo tipi
```

## Struttura

```
src/
  types.ts            modello dati + stato di default
  store.tsx           stato globale + persistenza (debounced)
  lib/
    utils.ts          helper (date, id, colori…)
    storage.ts        IndexedDB + File System Access API + export/import
  components/
    ui.tsx            componenti riutilizzabili (Button, Card, Modal…)
    icons.tsx         icone SVG inline
  views/
    DailyView.tsx        sezione Oggi
    KanbanView.tsx       Kanban personale
    TeamView.tsx         Team & 1:1 (tab Schede)
    SkillMatrix.tsx      Team & 1:1 (tab Skill matrix)
    SprintHealthView.tsx Sprint/Train + rischi + DORA
    DecisionsView.tsx    Decisioni & Azioni
    ReportView.tsx       Report stampabile (PDF)
```
