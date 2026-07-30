import { useState } from 'react'
import { Button, Modal } from './ui'
import { IconHelp } from './icons'

export type GuideKey =
  | 'inbox'
  | 'daily'
  | 'standup'
  | 'artsync'
  | 'kanban'
  | 'dependencies'
  | 'roadmap'
  | 'team'
  | 'sprint'
  | 'decisions'
  | 'report'

interface GuideSection {
  title: string
  items: string[]
}
interface Guide {
  title: string
  intro: string
  sections: GuideSection[]
  cadence: string
}

const GUIDES: Record<GuideKey, Guide> = {
  inbox: {
    title: 'Inbox',
    intro:
      'Il punto unico di atterraggio di tutto ciò che ti arriva: mail che toccano l’infrastruttura, richieste, note di meeting. Serve a non perdere niente e a decidere una volta sola cosa farne.',
    sections: [
      {
        title: 'Come si usa',
        items: [
          'Scegli la fonte (Mail / Meeting / ART Sync / Chat / Idea) e lo stream (CCoE, Digital CCoE, Team interno, RunOps…), poi incolla: una riga = un item.',
          'Smista ogni item col menu ⋯: → Attività di oggi · → Card Kanban · → Dipendenza esterna · → Action item · → Porta in ART Sync · → Roadmap · Archivia.',
          'L’avatar assegna l’item a una persona e lo trasforma in una delega (lo trovi in Team & 1:1 → Deleghe).',
          'Il badge nel menu laterale dice quanti item restano da smistare: l’obiettivo è chiudere la giornata a zero.',
        ],
      },
      {
        title: 'Buone pratiche',
        items: [
          'Cattura subito, decidi dopo: incollare costa 2 secondi, ricostruire una richiesta persa costa un’ora.',
          'Smista almeno una volta al giorno (fine mattina o fine giornata): l’inbox è un punto di transito, non un archivio.',
          'Tagga sempre lo stream: è ciò che fa comporre da sola l’agenda dell’ART Sync.',
        ],
      },
    ],
    cadence: 'Cattura in continuo · smistamento almeno 1 volta al giorno.',
  },
  daily: {
    title: 'Oggi',
    intro:
      'La tua plancia giornaliera: cosa apri al mattino e chiudi a sera. Pochi elementi, ad alta frequenza.',
    sections: [
      {
        title: 'Come si usa',
        items: [
          '«Quadro completo» in cima: da smistare · dipendenze a rischio · deleghe ferme · action aperte · backlog da ricontrollare. Se è tutto a zero non ti sei perso niente; clicca un numero per andare alla sezione.',
          'Le 3 priorità di oggi: scrivi al massimo 3 cose che devono chiudersi oggi. Si salvano per data, ogni giorno riparti da zero.',
          'Diario: incolla più righe per aggiungere tante attività insieme; ogni riga ha stream, assegnatario e menu ⋯ (→ Kanban, → ART Sync, → domani).',
          'Focus della settimana: 3 obiettivi più ampi che restano fissi per tutta la settimana.',
          '1:1 in arrivo e Azioni in scadenza: pannelli automatici di sola lettura, alimentati da Team e da Decisioni & Azioni.',
        ],
      },
      {
        title: 'Buone pratiche',
        items: [
          'Limita a 3: se tutto è prioritario, niente lo è.',
          'Svuota la quick capture ogni giorno: è la tua «inbox mentale», non un archivio.',
          'Apri questa sezione come primissima cosa della giornata, prima delle email.',
        ],
      },
    ],
    cadence: 'Ogni giorno — apertura al mattino, chiusura a fine giornata.',
  },
  standup: {
    title: 'Standup',
    intro:
      'Il Daily Scrum: ispeziona i progressi verso l’obiettivo di sprint e adatta il piano. Qui chiudi la giornata e generi il daily da presentare il giorno dopo.',
    sections: [
      {
        title: 'Come si usa',
        items: [
          'A fine giornata apri «Chiudi la giornata»: l’app pre-compila «Fatto oggi», «Non finite» e «Impedimenti» dai tuoi dati (card chiuse, priorità spuntate, card in corso/bloccate).',
          'Correggi le liste e aggiungi le «Note del giorno», poi «Salva chiusura giornata».',
          'A destra trovi lo standup pronto (Ieri · Oggi · Impedimenti) con l’obiettivo di sprint in testa: usa «Copia» per incollarlo in Teams/Slack o leggerlo al daily.',
          'Il menù a tendina ti fa rivedere e copiare anche gli standup dei giorni passati.',
        ],
      },
      {
        title: 'Buone pratiche (agile)',
        items: [
          'Daily timeboxato a 15 minuti: parla di flusso e obiettivo di sprint, non di status burocratico.',
          'Gli impedimenti emersi vanno risolti dopo il daily, non durante: annotali e portali a chi può sbloccarli.',
          '«Non finite» che si ripetono per più giorni sono un segnale: la card è troppo grande o c’è un blocco nascosto.',
        ],
      },
    ],
    cadence: 'Chiusura a fine giornata · standup il mattino dopo, sempre alla stessa ora.',
  },
  artsync: {
    title: 'ART Sync',
    intro:
      'Evento SAFe facilitato dall’RTE: unisce il Coach Sync (ex Scrum of Scrums, lato esecuzione) e il PO Sync (lato scope e priorità). Qui l’agenda è la TUA: le sezioni che presenti davvero, già compilate dai tuoi dati.',
    sections: [
      {
        title: 'Come si usa',
        items: [
          'La mattina apri la data di oggi: l’agenda mostra le tue sezioni (CCoE · Digital CCoE · Progress Internal Team · External Dependencies · External Meeting · Rischi ROAM).',
          '«↻ componi» riempie la sezione dai tuoi dati: attività e action taggate con quello stream, dipendenze aperte, item del backlog esterno che monitori.',
          'Durante il meeting spunta «riportato» su ogni punto e usa la nota per annotare cosa è emerso.',
          'I rischi vivono in un registro persistente: restano di sync in sync (con owner e aging) finché non li marchi Resolved. Il check «riportato» invece è per-giornata.',
          'Le action in uscita: assegna owner con l’avatar e portale nella giornata con «→ Diario» (stato collegato) o «→ Kanban». Le ritrovi in «Decisioni & Azioni» e in «Team → Deleghe».',
          '«Copia» genera il testo già nel tuo formato di presentazione (CCoE: … Digital CCoE: …), pronto da incollare.',
          'Il pulsante «Agenda» ti fa rinominare, riordinare, aggiungere o togliere sezioni: l’app si adatta a come presenti tu.',
        ],
      },
      {
        title: 'Le regole (SAFe)',
        items: [
          'Timebox 30-60 minuti: nel sync si IDENTIFICANO i problemi, non si risolvono. Il confronto tecnico va nel «meet after».',
          'Da ogni ART Sync deve uscire almeno un’action con owner e data: senza owner, nulla si muove.',
          'I rischi si gestiscono con ROAM: Resolved (risolto), Owned (qualcuno lo prende in carico), Accepted (accettato così com’è), Mitigated (c’è un piano di mitigazione).',
          'Le dipendenze cross-team vanno rese visibili il prima possibile: sono la causa principale di ritardo sul PI.',
        ],
      },
    ],
    cadence: 'Preparazione ogni mattina prima del meeting · action gestite nella giornata.',
  },
  kanban: {
    title: 'Kanban personale',
    intro:
      'Il TUO lavoro da manager, non i task del team: hiring, vendor, escalation, decisioni, architettura.',
    sections: [
      {
        title: 'Come si usa',
        items: [
          'Crea con «Nuova card» o «+ Aggiungi» direttamente nella colonna voluta.',
          'Trascina le card tra le colonne: Backlog → Da fare → In corso → Bloccato → Fatto.',
          'Click su una card per modificarla: priorità, tag, note.',
          'Il contatore «WIP in corso» in alto e l’etichetta «fermo da Ng» (card non mossa da ≥7 giorni) sono i tuoi due semafori.',
        ],
      },
      {
        title: 'Buone pratiche',
        items: [
          'WIP limit su te stesso: max 2-3 card «In corso». Oltre, è solo context switching.',
          'Usa «Bloccato» e nelle note scrivi da chi/cosa dipende: i blocchi vanno resi visibili, non nascosti.',
          'Ogni settimana rivedi le card «ferme da»: o le sblocchi, o le chiudi.',
        ],
      },
    ],
    cadence: 'Aggiorna durante la giornata · review delle card ferme una volta a settimana.',
  },
  dependencies: {
    title: 'Interlocutori',
    intro:
      'Il quadro di ciò che hai aperto con gli altri team (CCoE, Digital CCoE, RunOps…): dipendenze, item del loro backlog che monitori e action verso di loro. Le dipendenze sono la «D» del RAID log e la causa #1 di lavoro fermo.',
    sections: [
      {
        title: 'Come si usa',
        items: [
          'I chip in alto filtrano per interlocutore: selezionane uno per vedere solo il suo quadro (e per poter aggiungere item al suo backlog).',
          '«Nuova dipendenza»: cosa serve, da chi (stream), tipo, riferimento e link, criticità, «needed by» e owner che la segue.',
          '«Sollecita» registra il follow-up: dopo 3 solleciti l’app marca «da escalare» — a quel punto portala al tuo responsabile o all’RTE.',
          '«Backlog monitorato»: gli item del backlog ALTRUI che segui ma non gestisci. Premi «Controllato» quando li verifichi: dopo 7 giorni senza check compare «da ricontrollare».',
          'La barra KPI è il semaforo: Aperte · Scadute · Da sollecitare · Da escalare · Backlog da ricontrollare.',
        ],
      },
      {
        title: 'Buone pratiche (agile)',
        items: [
          'Ogni dipendenza ha un owner esplicito: senza un responsabile che la insegue, resta ferma.',
          'Imposta sempre il «needed by»: una dipendenza senza data non è prioritizzabile.',
          'Rendi visibili le dipendenze cross-team il prima possibile (planning / PI planning): si gestiscono prevenendo, non rincorrendo.',
          'Una dipendenza «ferma da» troppo tempo va escalata, non solo sollecitata: dopo 3 solleciti l’app la marca «da escalare» — a quel punto portala al tuo responsabile o all’RTE.',
        ],
      },
    ],
    cadence: 'Rivedi le aperte ogni giorno · sollecita le critiche prima che scadano.',
  },
  roadmap: {
    title: 'Roadmap DevOps',
    intro:
      'La tua direzione tecnica come DevOps manager: iniziative (non task) su tre orizzonti Now/Next/Later. Niente date finte: l’impegno cresce man mano che l’orizzonte si avvicina.',
    sections: [
      {
        title: 'Come si usa',
        items: [
          'Tre colonne: «Adesso» (in lavorazione / prossime settimane), «Prossimo» (prossimo trimestre o PI), «Più avanti» (visione, senza impegno).',
          'Aggiungi un’iniziativa con «+ aggiungi e Invio» o col pulsante; trascina tra le colonne quando le priorità cambiano.',
          'Ogni iniziativa ha area (CI/CD, Observability, Security, FinOps…), stato e target indicativo (es. Q4 2026).',
          '«Kanban» su un’iniziativa crea la card operativa e la mette In corso: la roadmap dice il perché, il Kanban il cosa questa settimana.',
          'Le iniziative «Adesso» compaiono anche nel Report.',
        ],
      },
      {
        title: 'Buone pratiche',
        items: [
          'Tieni «Adesso» a massimo 3-4 iniziative attive: una roadmap dove è tutto «adesso» non è una roadmap.',
          'Rivedila una volta al mese e a ogni PI planning: promuovi da Later → Next → Now, e non aver paura di retrocedere.',
          '«Più avanti» è una lista di intenzioni, non di promesse: lì la vaghezza è una funzionalità.',
          'Ogni iniziativa dovrebbe dire il valore atteso, non solo il titolo tecnico.',
        ],
      },
    ],
    cadence: 'Review mensile · riallineamento a ogni PI planning.',
  },
  team: {
    title: 'Team & 1:1',
    intro:
      'La memoria sulle tue persone: 1:1, obiettivi, skill. Serve ad arrivare alle review senza sorprese e a far crescere il team in modo intenzionale.',
    sections: [
      {
        title: 'Tab «Schede»',
        items: [
          'Aggiungi persona e compila ruolo, skill (tag), obiettivi del trimestre, note.',
          'Imposta «Prossimo 1:1»: la data comparirà automaticamente nella sezione Oggi.',
          'Registra 1:1: scrivi le note, opzionale il mood (emoji), premi «Registra». Resta storicizzato con la data.',
        ],
      },
      {
        title: 'Tab «Skill matrix»',
        items: [
          'Aggiungi le competenze (le colonne); click su una cella per impostare il livello: Base → Solido → Esperto.',
          'Sotto ogni competenza «coperte» = quante persone sono almeno Solido. In rosso (0) = single point of failure.',
        ],
      },
      {
        title: 'Tab «Deleghe»',
        items: [
          'Il quadro di cosa hai passato a chi: attività del diario e action, raggruppate per persona, con stato e da quanto tempo sono ferme.',
          'Assegni dall’avatar nel Diario di oggi, nell’Inbox o nell’ART Sync; qui monitori senza rincorrere.',
          '«ferme ≥5g» è il segnale per riparlarne al prossimo 1:1 — o per capire se la persona è bloccata.',
        ],
      },
      {
        title: 'Buone pratiche',
        items: [
          'Prepara ogni 1:1 rileggendo il precedente: dai continuità e chiedi i follow-up.',
          'Guarda l’andamento del mood nel tempo, non il singolo: un calo costante è un segnale da intercettare.',
          'Competenze con copertura 0-1 = rischio bus factor: pianifica formazione o pairing.',
        ],
      },
    ],
    cadence: '1:1 a cadenza fissa (es. ogni 2 settimane) · skill matrix rivista ogni mese/trimestre.',
  },
  sprint: {
    title: 'Sprint & Salute',
    intro:
      'Collega la cadenza di consegna (sprint/PI) con la salute del team misurata nel tempo.',
    sections: [
      {
        title: 'Tab «Sprint / Train»',
        items: [
          'A inizio sprint: crea lo sprint, stato «Attivo», scrivi gli obiettivi.',
          'A fine sprint: riaprilo, compila la retro (cosa è andato bene / cosa migliorare) e metti stato «Chiuso».',
          'Rischi & impedimenti: sono trasversali, te li porti tra sprint. Severità + stato ciclabile (Aperto → Mitigato → Chiuso).',
        ],
      },
      {
        title: 'Tab «Salute DORA»',
        items: [
          'Una volta a settimana dai un voto 1-5 alle 4 metriche (lead time, freq. deploy, MTTR, change failure) + due righe di note.',
          'È un self-rating soggettivo da manager, non un dato estratto dai sistemi: serve a percepire la tendenza.',
          'Leggi il grafico di trend, non il numero secco: conta la direzione.',
        ],
      },
      {
        title: 'Buone pratiche',
        items: [
          'Il «cosa migliorare» della retro deve diventare un’azione concreta nel Kanban o negli Action items, altrimenti è solo uno sfogo.',
          'DORA: scegli un giorno fisso (es. venerdì) per non saltare la valutazione.',
          'Un rischio «Aperto» da troppo tempo va escalato agli stakeholder.',
        ],
      },
    ],
    cadence: 'Retro a fine sprint · DORA una volta a settimana, sempre lo stesso giorno.',
  },
  decisions: {
    title: 'Decisioni & Azioni',
    intro:
      'Conserva il «perché» delle decisioni (che dimenticherai tra 3 mesi) e traccia gli action item con responsabile e scadenza.',
    sections: [
      {
        title: 'Tab «Decision log»',
        items: [
          'Nuova decisione: compila contesto, alternative valutate, scelta e — soprattutto — il «perché» (razionale e trade-off accettati).',
          'Stato: Aperta (in valutazione), Decisa, Da rivedere (da riconsiderare in futuro).',
        ],
      },
      {
        title: 'Tab «Action items»',
        items: [
          'Aggiungi con owner e scadenza; click sul pallino per ciclare lo stato: Da fare → In corso → Fatto.',
          'Le scadenze appaiono nella sezione Oggi; il campo owner si autocompleta dai nomi del team.',
        ],
      },
      {
        title: 'Buone pratiche',
        items: [
          'Registra la decisione nel momento in cui la prendi: il razionale è fresco e onesto.',
          'Una decisione «Da rivedere» è legittima: associa un trigger temporale per riconsiderarla.',
          'Da ogni meeting esce almeno un action item con owner e data, altrimenti il meeting non è servito.',
        ],
      },
    ],
    cadence: 'Decisioni: appena le prendi · Action items: dopo ogni meeting.',
  },
  report: {
    title: 'Report',
    intro:
      'Un’istantanea sintetica per i tuoi resoconti: 1:1 col tuo responsabile, weekly, allineamenti verso l’alto.',
    sections: [
      {
        title: 'Come si usa',
        items: [
          'È un’anteprima generata in automatico da tutte le altre sezioni: non si compila a mano.',
          '«Stampa / Salva PDF» → nella finestra di stampa scegli «Salva come PDF» come stampante.',
          'In stampa spariscono sidebar e pulsanti: resta solo il foglio pulito.',
          'Tab «Chiusura settimana»: il venerdì l’app ti mostra i numeri della settimana (attività, card, dipendenze, rischi, cycle time) — tu aggiungi «cosa è andato bene» e «cosa migliorare» e chiudi. La chiusura finisce nel Report.',
          'Il «cosa migliorare» ha «→ Crea action item»: la retro senza azione è solo uno sfogo.',
        ],
      },
      {
        title: 'Buone pratiche',
        items: [
          'Se tieni aggiornate le altre sezioni durante la settimana, il report si scrive da solo.',
          'Usalo come base oggettiva per la comunicazione verso l’alto: numeri e fatti, non sensazioni.',
        ],
      },
    ],
    cadence: 'A richiesta — tipicamente a fine settimana o prima di un allineamento.',
  },
}

export function GuideButton({ section }: { section: GuideKey }) {
  const [open, setOpen] = useState(false)
  const g = GUIDES[section]
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} title="Guida alla sezione">
        <IconHelp width={15} height={15} /> Guida
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Guida · ${g.title}`}
        wide
        footer={
          <Button variant="primary" onClick={() => setOpen(false)}>
            Ho capito
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-muted)]">{g.intro}</p>
          {g.sections.map((s) => (
            <div key={s.title}>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                {s.title}
              </h4>
              <ul className="space-y-1.5">
                {s.items.map((it, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-snug">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-border)]" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="rounded-[calc(var(--radius)-0.25rem)] border bg-[var(--color-surface-2)]/50 px-3 py-2 text-sm">
            <span className="font-semibold">Ritmo consigliato: </span>
            <span className="text-[var(--color-muted)]">{g.cadence}</span>
          </div>
        </div>
      </Modal>
    </>
  )
}
