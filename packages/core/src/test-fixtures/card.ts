const CARD_LINES = [
  "Date transaction,Libellé,Marchand,Numéro de carte,Devise,Montant,Devise d'origine,Montant d'origine,Sens,Statut,Catégorie,Code catégorie",
  '"25.03.2026","EPICERIE FICTIVE 12, VILLEFICTIVE","Epicerie Fictive","5555 12** **** 3456","CHF","11.95","","","Débit","En attente","Alimentation","GROCERY"',
  '"22.03.2026","MAGASIN ""LE COIN"", NYON","Le Coin","5555 12** **** 3456","CHF","1\'234.50","","","Débit","Comptabilisée","Shopping","STORES"',
  '"20.03.2026","REMBOURSEMENT BOUTIQUE","Boutique Imaginaire","4444 98**** *7777","CHF","40.00","","","Crédit","Comptabilisée","Shopping","STORES"',
  '"18.03.2026","STATION SERVICE ALPHA","Station Alpha","4444 98**** *7777","CHF","60.10","EUR","62.00","Débit","Comptabilisée","Voiture","FUEL"',
  '"17.03.2026","CAFE DU PONT","","4444 98**** *7777","CHF","abc","","","Débit","Comptabilisée","",""',
]

export const CARD_CSV = `${CARD_LINES.join("\n")}\n`
