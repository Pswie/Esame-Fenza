# Architettura dei Dati: Perché Kafka + Spark?

In CineMatch, il calcolo delle statistiche utente (`user_stats`) e dei trend globali (`global_stats`) si basa su un'architettura a micro-servizi che combina **Apache Kafka** e **Apache Spark Structured Streaming**. 

Sebbene Spark possa tecnicamente leggere dati da molte fonti, l'integrazione con Kafka è fondamentale per rendere il sistema **robusto, scalabile e reattivo**.

---

## 1. I Ruoli nel Sistema

### Apache Kafka: Il Buffer Intelligente (Messaggistica)
Kafka agisce come un "ufficio postale" ad alta velocità. Riceve gli eventi dal backend (FastAPI) e li memorizza in un **Topic** (`user-movie-events`).
*   **Velocità**: Risponde in millisecondi.
*   **Persistenza**: Salva i messaggi su disco, garantendo che nulla vada perso.

### Apache Spark: Il Motore di Calcolo (Processing)
Spark legge i messaggi da Kafka in **micro-batch** e svolge il lavoro pesante.
*   **Analisi**: Calcola medie, raggruppa generi, identifica attori ricorrenti.
*   **Integrazione**: Arricchisce i dati dell'evento facendo join con il catalogo dei film su MongoDB.

---

## 2. I 4 Vantaggi Fondamentali

### ✅ 1. Disaccoppiamento (Decoupling)
Senza Kafka, il backend dovrebbe inviare i dati direttamente a Spark. Se Spark fosse lento nel processare un calcolo complesso, l'utente vedrebbe un rallentamento nell'app. 
Con Kafka, il backend "spara-e-dimentica": invia il dato a Kafka e torna subito a servire l'utente. Spark elaborerà il dato un istante dopo in background.

### ✅ 2. Tolleranza ai Guasti (Resilience)
Se il server Spark subisce un crash o deve essere riavviato per manutenzione:
*   **Senza Kafka**: I dati inviati durante il crash andrebbero persi.
*   **Con Kafka**: I dati si accumulano in coda. Appena Spark torna online, riprende l'elaborazione esattamente dal punto in cui era rimasto (grazie ai *Checkpoints*).

### ✅ 3. Gestione dei Picchi (Backpressure)
Immagina un picco di traffico (es. sabato sera). Kafka funge da **ammortizzatore**: assorbe migliaia di eventi al secondo e permette a Spark di "consumarli" al ritmo più efficiente possibile, evitando che il sistema vada in saturazione di memoria.

### ✅ 4. Architettura Fan-out (Multifunzionale)
Una volta che l'evento "Film Aggiunto" è su Kafka, può essere usato da più servizi contemporaneamente:
1.  **Spark Service**: Per aggiornare le statistiche.
2.  **Notification Service**: Per inviare una notifica push.
3.  **Auditing Service**: Per tracciare le azioni ai fini della sicurezza.
Aggiungere una nuova funzionalità non richiede di modificare il backend o Spark, basta creare un nuovo "consumatore" Kafka.

---

## 3. Conclusione
L'uso combinato di Kafka + Spark trasforma CineMatch da una semplice applicazione a una **piattaforma dati moderna**. Questa architettura assicura che l'esperienza dell'utente rimanga fluida (grazie al disaccoppiamento) e che i dati siano sempre accurati e protetti (grazie alla resilienza).

---

## 4. Procedimento: Global Trends (Pure Streaming)
Mentre le statistiche del singolo utente vengono ricalcolate partendo dallo storico (per precisione assoluta), i **Global Trends** (i film più visti dalla community) seguono un flusso di "Aggregazione Incrementale" estremamente efficiente:

1.  **Flusso Continuo**: Spark ascolta il topic Kafka senza sosta. Ogni azione di ogni singolo utente (`ADD` o `DELETE`) viene catturata.
2.  **Watermarking (1 ora)**: Spark gestisce gli eventi "ritardatari" (es. aggiornamenti inviati dopo problemi di connessione) mantenendo una finestra temporale in memoria di un'ora. Questo evita di perdere dati senza saturare le risorse.
3.  **Gestione Eventi (+/-)**:
    *   Se l'evento è un inserimento (`ADD`), Spark **incrementa** il contatore del film nel documento globale.
    *   Se l'evento è una cancellazione (`DELETE`), Spark **decrementa** il contatore istantaneamente.
4.  **Trigger Periodico (30 secondi)**: Per non sovraccaricare il database MongoDB con migliaia di micro-aggiornamenti al secondo, Spark "raggruppa" i risultati e scrive lo stato della community ogni 30 secondi.
5.  **Risultato**: La Dashboard globale mostra sempre la Top 10 aggiornata e i generi di tendenza della community in tempo reale, senza mai dover scansionare l'intera collezione dei film, il che garantisce performance costanti anche con milioni di record.
