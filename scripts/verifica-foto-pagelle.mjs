/* Controllo automatico della rosa fotografica delle pagelle.
   Un nome non riconosciuto non rompe il sito: mostra le iniziali. Proprio per
   questo l'errore potrebbe passare inosservato fino alla partita successiva. */
import fs from "node:fs";
import path from "node:path";
import { fotoDi, fotoDisponibili } from "../src/utils/fotoGiocatori.js";

const casi = [
  ["A. Gudmundsson", "/giocatori/gudmundsson.webp"],
  ["Albert Gudmundsson", "/giocatori/gudmundsson.webp"],
  ["A. Guðmundsson", "/giocatori/gudmundsson.webp"],
  ["D. Leite", "/giocatori/diogo-leite.webp"],
  ["Diogo Leite", "/giocatori/diogo-leite.webp"],
  ["Alessio Romagnoli", null],
  ["A. Romagnoli", null],
];

for (const [nome, attesa] of casi) {
  const ottenuta = fotoDi(nome);
  if (ottenuta !== attesa) {
    throw new Error(`${nome}: attesa ${attesa || "nessuna foto"}, ottenuta ${ottenuta || "nessuna foto"}`);
  }
  if (ottenuta) {
    const file = path.join(process.cwd(), "public", ...ottenuta.split("/").filter(Boolean));
    if (!fs.existsSync(file) || fs.statSync(file).size < 1000) {
      throw new Error(`${nome}: file fotografico assente o vuoto (${file})`);
    }
  }
}

const cartella = path.join(process.cwd(), "public", "giocatori");
const dichiarate = new Set(fotoDisponibili().map((nome) => `${nome}.webp`));
const presenti = new Set(fs.readdirSync(cartella).filter((nome) => nome.endsWith(".webp")));

for (const nome of dichiarate) {
  const file = path.join(cartella, nome);
  if (!presenti.has(nome) || fs.statSync(file).size < 1000) {
    throw new Error(`Foto dichiarata ma assente o vuota: ${nome}`);
  }
}
for (const nome of presenti) {
  if (!dichiarate.has(nome)) throw new Error(`Foto presente ma non collegata alle pagelle: ${nome}`);
}

console.log(`Foto pagelle verificate: ${dichiarate.size} ritratti collegati, Gudmundsson e Diogo Leite presenti, Romagnoli rimosso`);
