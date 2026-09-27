type EntryFixture = {
  amount: string
  indicator: "DBIT" | "CRDT"
  status?: "BOOK" | "PDNG"
  bookingDate?: string
  valueDate: string
  reference: string
  label: string
  reversal?: boolean
  details?: string
}

function entry(fixture: EntryFixture): string {
  const bookingDate = fixture.bookingDate ? `<BookgDt><Dt>${fixture.bookingDate}</Dt></BookgDt>` : ""
  return `
      <Ntry>
        <Amt Ccy="CHF">${fixture.amount}</Amt>
        <CdtDbtInd>${fixture.indicator}</CdtDbtInd>
        <RvslInd>${fixture.reversal ? "true" : "false"}</RvslInd>
        <Sts><Cd>${fixture.status ?? "BOOK"}</Cd></Sts>
        ${bookingDate}
        <ValDt><Dt>${fixture.valueDate}</Dt></ValDt>
        <AcctSvcrRef>${fixture.reference}</AcctSvcrRef>
        ${fixture.details ?? ""}
        <AddtlNtryInf>${fixture.label}</AddtlNtryInf>
      </Ntry>`
}

export function statement(iban: string, entries: EntryFixture[]): string {
  return `
    <Stmt>
      <Id>STM-TEST-${iban}</Id>
      <Acct><Id><IBAN>${iban}</IBAN></Id><Ccy>CHF</Ccy></Acct>
      <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="CHF">1000.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2026-03-01</Dt></Dt></Bal>
      ${entries.map(entry).join("")}
    </Stmt>`
}

export function camtDocument(statements: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>MSG-TEST</MsgId><CreDtTm>2026-03-31T10:00:00.000+02:00</CreDtTm></GrpHdr>
    ${statements.join("")}
  </BkToCstmrStmt>
</Document>`
}

const TRANSACTION_DETAILS = `<NtryDtls><TxDtls><Refs><EndToEndId>NOTPROVIDED</EndToEndId></Refs><RmtInf><Ustrd>Facture 42</Ustrd></RmtInf></TxDtls></NtryDtls>`

export const CAMT_IBAN = "CH9300762011623852957"

export const CAMT_053 = camtDocument([
  statement(CAMT_IBAN, [
    { amount: "2500.50", indicator: "CRDT", bookingDate: "2026-03-02", valueDate: "2026-03-02", reference: "REF001", label: "Crédit Société Fictive SA" },
    { amount: "12.40", indicator: "DBIT", bookingDate: "2026-03-03", valueDate: "2026-03-02", reference: "REF002", label: "Achat Boulangerie du Lac, Morges" },
    { amount: "20", indicator: "DBIT", status: "PDNG", bookingDate: "2026-03-04", valueDate: "2026-03-04", reference: "REF003", label: "Paiement TWINT DUPONT, JEAN" },
    { amount: "15.00", indicator: "DBIT", reversal: true, bookingDate: "2026-03-05", valueDate: "2026-03-05", reference: "REF004", label: "Annulation achat Kiosque &amp; Co" },
    { amount: "99.90", indicator: "DBIT", bookingDate: "2026-03-06", valueDate: "2026-03-06", reference: "REF005", label: "Paiement facture Assurance Fictive", details: TRANSACTION_DETAILS },
    { amount: "7.00", indicator: "DBIT", valueDate: "", reference: "REF006", label: "Écriture sans date" },
  ]),
])
