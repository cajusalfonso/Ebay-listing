import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  Order,
  FixedCost,
  BankTransaction,
  Debt,
  DebtPayment,
} from "@/lib/database.types";
import {
  calcOrderMargin,
  debtPaidAmount,
  debtRemaining,
  type OwnerDashboardKpis,
} from "@/lib/calculations";

export type ExportRow = Record<string, string | number>;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function addRowsSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: ExportRow[]
) {
  const sheet = workbook.addWorksheet(sheetName);
  if (rows.length === 0) return;
  sheet.columns = Object.keys(rows[0]).map((key) => ({
    header: key,
    key,
    width: 22,
  }));
  rows.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true };
}

export async function exportToExcel(
  rows: ExportRow[],
  filename: string,
  sheetName = "Übersicht"
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  if (rows.length > 0) {
    sheet.columns = Object.keys(rows[0]).map((key) => ({
      header: key,
      key,
      width: 22,
    }));
    rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${filename}.xlsx`
  );
}

const OWNER_KPI_LABELS: { key: keyof OwnerDashboardKpis; label: string; unit: string }[] = [
  { key: "nettoumsatz", label: "Nettoumsatz", unit: "EUR" },
  { key: "bestellungen", label: "Bestellungen", unit: "Anzahl" },
  { key: "durchschnittVerkaufspreis", label: "Ø Verkaufspreis", unit: "EUR" },
  { key: "rohertrag", label: "Rohertrag", unit: "EUR" },
  { key: "rohertragsmargePercent", label: "Rohertragsmarge", unit: "%" },
  { key: "marketingkosten", label: "Marketingkosten", unit: "EUR" },
  { key: "cacJeBestellung", label: "CAC je Bestellung", unit: "EUR" },
  { key: "retourenquotePercent", label: "Retouren-/Stornoquote", unit: "%" },
  { key: "deckungsbeitrag", label: "Deckungsbeitrag", unit: "EUR" },
  { key: "overhead", label: "Overhead", unit: "EUR" },
  { key: "nettoergebnis", label: "Nettoergebnis Lumox", unit: "EUR" },
];

export async function exportAllToExcel({
  orders,
  fixedCosts,
  bankTransactions,
  debts,
  debtPayments,
  ownerKpisThisMonth,
  ownerKpisLastMonth,
}: {
  orders: Order[];
  fixedCosts: FixedCost[];
  bankTransactions: BankTransaction[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  ownerKpisThisMonth: OwnerDashboardKpis;
  ownerKpisLastMonth: OwnerDashboardKpis;
}) {
  const workbook = new ExcelJS.Workbook();

  addRowsSheet(
    workbook,
    "Kennzahlen",
    OWNER_KPI_LABELS.map((row) => ({
      KPI: row.label,
      Einheit: row.unit,
      "Aktueller Monat": ownerKpisThisMonth[row.key] ?? 0,
      Vormonat: ownerKpisLastMonth[row.key] ?? 0,
    }))
  );

  addRowsSheet(
    workbook,
    "Bestellungen",
    orders.map((o) => {
      const m = calcOrderMargin(o);
      return {
        Datum: o.order_date,
        Produkt: o.product_name,
        Herkunft: o.sales_channel,
        Lieferant: o.supplier,
        Status: o.status,
        Verkaufspreis: o.sale_price,
        Einkaufspreis: o.purchase_price,
        Einkaufswaehrung: o.purchase_currency,
        Wechselkurs: o.exchange_rate,
        Versandkosten: o.shipping_cost,
        Zahlungsgebuehr_Prozent: o.payment_fee_percent,
        Sonstige_Kosten: o.other_costs,
        Retoure: o.is_return ? "Ja" : "Nein",
        Retourkosten: o.return_cost,
        "Marge (€)": Number(m.marginEur.toFixed(2)),
        "Marge (%)": m.marginPercent !== null ? Number(m.marginPercent.toFixed(1)) : "",
      };
    })
  );

  addRowsSheet(
    workbook,
    "Kosten",
    fixedCosts.map((fc) => ({
      Bezeichnung: fc.label,
      Kategorie: fc.category,
      Betrag: fc.amount,
      Rhythmus: fc.rhythm,
      Datum: fc.start_date,
    }))
  );

  addRowsSheet(
    workbook,
    "Kontoauszug",
    bankTransactions.map((t) => ({
      Datum: t.tx_date,
      Verwendungszweck: t.description,
      Betrag: t.amount,
      Typ: t.type,
    }))
  );

  addRowsSheet(
    workbook,
    "Schulden",
    debts.map((d) => ({
      Bezeichnung: d.label,
      Gesamtbetrag: d.total_amount,
      Bezahlt: Number(debtPaidAmount(d.id, debtPayments).toFixed(2)),
      Offen: Number(debtRemaining(d, debtPayments).toFixed(2)),
      Notizen: d.notes,
    }))
  );

  addRowsSheet(
    workbook,
    "Schulden-Zahlungen",
    debtPayments.map((p) => {
      const debt = debts.find((d) => d.id === p.debt_id);
      return {
        Schuld: debt?.label ?? p.debt_id,
        Datum: p.payment_date,
        Betrag: p.amount,
        Notiz: p.note,
      };
    })
  );

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "lumox-gesamtexport.xlsx"
  );
}

export function exportToPdf(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  autoTable(doc, {
    head: [headers],
    body: rows.map((r) => r.map(String)),
    startY: 22,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [79, 70, 229] },
  });
  doc.save(`${filename}.pdf`);
}
