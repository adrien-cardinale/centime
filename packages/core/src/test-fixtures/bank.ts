const ACCOUNT = "CH9300762011623852957"

const BANK_LINES = [
  "Compte;Date comptable;Libellé;Montant;Solde;Date valeur",
  `${ACCOUNT};2026-03-02 00:00:00.0;Crédit Société Fictive SA;2500.5;3100.5;2026-03-02 00:00:00.0`,
  `${ACCOUNT};2026-03-03 00:00:00.0;Achat Boulangerie du Lac, Morges;-12.4;3088.1;2026-03-02 00:00:00.0`,
  `${ACCOUNT};2026-03-03 00:00:00.0;Paiement mobile DUPONT, JEAN;-20;3068.1;2026-03-03 00:00:00.0`,
  `${ACCOUNT};2026-03-03 00:00:00.0;Paiement mobile DUPONT, JEAN;-20;3048.1;2026-03-03 00:00:00.0`,
  `${ACCOUNT};pas une date;Ligne cassée;-5;3043.1;2026-03-04 00:00:00.0`,
  `${ACCOUNT};2026-03-04 00:00:00.0;Colonnes manquantes`,
  `${ACCOUNT};2026-03-05 00:00:00.0;Ordre permanent Régie Imaginaire;-1'250.00;1798.1;2026-03-05 00:00:00.0`,
]

export const BANK_CSV = `${BANK_LINES.join("\r\n")}\r\n`
