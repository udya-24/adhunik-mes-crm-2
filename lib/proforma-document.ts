"use client";

import { AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } from "docx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { piCompanyHeaderUrl } from "@/lib/constants";
import { formatDate } from "@/lib/date";
import type { ProformaInvoice } from "@/lib/types";

const navy: [number, number, number] = [11, 31, 58];
const border = [203, 213, 225] as [number, number, number];

export const piCompanyName = "ADHUNIK SWITCHGEARS PVT. LTD.";
export const piFixedFooter = {
  registeredOffice: [
    "Regd. Office :",
    "Adhunik Switchgears Pvt Ltd",
    "Plot No -1700 HSIIDC,",
    "RAI Industrial Estate,",
    "Sonipat,",
    "Haryana"
  ],
  bank: [
    ["Accounts details :", ""],
    ["Party Name", "M/s ADHUNIK SWITCHGEARS PVT LTD"],
    ["Account No", "467901010035389"],
    ["Bank Name", "UNION BANK OF INDIA"],
    ["Branch", "SHALIMAR BAGH, NEW DELHI"],
    ["IFSC", "UBIN0546798"],
    ["MICR", "110026036"],
    ["PAN", "AAACA2633A"],
    ["GSTN", "06AAACA2633A1ZJ"]
  ]
};

export function formatPiCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
}

export function piCreatorName(invoice: ProformaInvoice) {
  return invoice.creator?.full_name || invoice.creator?.email || "Unknown User";
}

export function piSubtotal(invoice: ProformaInvoice) {
  return invoice.items.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
}

export async function exportProformaInvoicePdf(invoice: ProformaInvoice) {
  const headerImageData = await loadImage(piCompanyHeaderUrl);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const headerHeight = headerImageData ? 28 : 12;
  const footerTop = 262;

  const drawChrome = () => {
    if (headerImageData) {
      const image = doc.getImageProperties(headerImageData);
      const height = Math.min(28, (pageWidth - margin * 2) * image.height / image.width);
      doc.addImage(headerImageData, "PNG", margin, 8, pageWidth - margin * 2, height, undefined, "FAST");
    } else {
      doc.setFillColor(...navy);
      doc.rect(margin, 8, pageWidth - margin * 2, 9, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("PROFORMA INVOICE", pageWidth / 2, 14, { align: "center" });
    }
    drawPdfFixedFooter(doc, margin, pageWidth, footerTop);
  };

  drawChrome();
  let y = 12 + headerHeight;
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("PROFORMA INVOICE", pageWidth - margin, y, { align: "right" });
  y += 7;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: 12 + headerHeight, bottom: pageHeight - footerTop + 5 },
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 1.5, textColor: [51, 65, 85], overflow: "linebreak" },
    columnStyles: { 0: { fontStyle: "bold", textColor: navy, cellWidth: 27 }, 1: { cellWidth: 63 }, 2: { fontStyle: "bold", textColor: navy, cellWidth: 27 }, 3: { cellWidth: 63 } },
    body: [
      ["PI No.", invoice.pi_no, "Date", formatDate(invoice.pi_date)],
      ["Our Ref No.", invoice.our_ref_no || "-", "DP Code", invoice.dp_code || "-"],
      ["Company Name", invoice.indentor_name, "GSTIN", invoice.gstin || "-"],
      ["Mobile No.", invoice.mobile_no || "-", "E-mail", invoice.email || "-"],
      ["PO No.", invoice.po_no || "-", "PO Date", invoice.po_date ? formatDate(invoice.po_date) : "-"],
      ["Project", invoice.project || "-", "", ""],
      ["Indentor Address", invoice.indentor_address || "-", "", ""]
    ],
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) drawChrome();
    }
  });

  autoTable(doc, {
    startY: lastTableY(doc) + 5,
    margin: { left: margin, right: margin, top: 12 + headerHeight, bottom: pageHeight - footerTop + 5 },
    head: [["Sl. No.", "Item Description", "Model Type", "Qty.", "Unit Price (INR)", "Total Price (INR)"]],
    body: invoice.items.map((item, index) => [index + 1, item.item_description, item.model_type || "-", formatNumber(item.quantity), formatMoney(item.unit_price), formatMoney(item.quantity * item.unit_price)]),
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: { fontSize: 8.2, cellPadding: 2, overflow: "linebreak", valign: "top", lineColor: border, lineWidth: 0.15 },
    headStyles: { fillColor: navy, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { cellWidth: 13, halign: "center" }, 1: { cellWidth: 72 }, 2: { cellWidth: 31 }, 3: { cellWidth: 16, halign: "right" }, 4: { cellWidth: 25, halign: "right" }, 5: { cellWidth: 25, halign: "right" } },
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) drawChrome();
    }
  });

  autoTable(doc, {
    startY: lastTableY(doc) + 5,
    margin: { left: 112, right: margin, top: 12 + headerHeight, bottom: pageHeight - footerTop + 5 },
    theme: "grid",
    body: [
      ["Subtotal", formatMoney(piSubtotal(invoice))],
      [`GST @ ${formatPercentage(invoice.gst_percentage)}%`, formatMoney(invoice.gst_amount)],
      ["Grand Total", formatMoney(invoice.grand_total)]
    ],
    styles: { fontSize: 8.8, cellPadding: 2.2, lineColor: border, lineWidth: 0.15 },
    columnStyles: { 0: { cellWidth: 45, fontStyle: "bold", textColor: navy }, 1: { cellWidth: 49, halign: "right", fontStyle: "bold" } },
    didParseCell: ({ row, cell }) => {
      if (row.index === 2) {
        cell.styles.fillColor = navy;
        cell.styles.textColor = [255, 255, 255];
      }
    },
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) drawChrome();
    }
  });

  if (invoice.terms.length) {
    autoTable(doc, {
      startY: lastTableY(doc) + 6,
      margin: { left: margin, right: margin, top: 12 + headerHeight, bottom: pageHeight - footerTop + 5 },
      head: [["Terms & Conditions", ""]],
      body: invoice.terms.map((term) => [term.term_key, term.term_value]),
      showHead: "firstPage",
      rowPageBreak: "avoid",
      styles: { fontSize: 8.2, cellPadding: 1.8, overflow: "linebreak", lineColor: border, lineWidth: 0.15 },
      headStyles: { fillColor: navy, textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 45, fontStyle: "bold", textColor: navy }, 1: { cellWidth: 137 } },
      didDrawPage: ({ pageNumber }) => {
        if (pageNumber > 1) drawChrome();
      }
    });
  }

  drawPdfSignature(doc, invoice, margin, headerHeight, footerTop, drawChrome);
  doc.save(`${safeFileName(invoice.pi_no)}.pdf`);
}

export async function exportProformaInvoiceDocx(invoice: ProformaInvoice) {
  const headerImageData = await loadImage(piCompanyHeaderUrl);
  const headerChildren = headerImageData
    ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: dataUrlBytes(headerImageData), transformation: await imageDimensions(headerImageData, 680, 105), type: "png" })] })]
    : [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PROFORMA INVOICE", bold: true, color: "0B1F3A", size: 24 })] })];

  const document = new Document({
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 950, right: 794, bottom: 1450, left: 794, header: 300, footer: 300 } } },
      headers: { default: new Header({ children: headerChildren }) },
      footers: { default: new Footer({ children: fixedFooterParagraphs() }) },
      children: [
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 180 }, children: [new TextRun({ text: "PROFORMA INVOICE", bold: true, color: "0B1F3A", size: 34 })] }),
        detailsTable(invoice),
        new Paragraph({ spacing: { after: 120 } }),
        itemsTable(invoice),
        new Paragraph({ spacing: { after: 120 } }),
        summaryTable(invoice),
        new Paragraph({ spacing: { after: 150 } }),
        ...(invoice.terms.length ? [termsTable(invoice), new Paragraph({ spacing: { after: 200 } })] : []),
        ...signatureParagraphs(invoice)
      ]
    }]
  });

  downloadBlob(await Packer.toBlob(document), `${safeFileName(invoice.pi_no)}.docx`);
}

function detailsTable(invoice: ProformaInvoice) {
  const rows = [
    ["PI No.", invoice.pi_no, "Date", formatDate(invoice.pi_date)],
    ["Our Ref No.", invoice.our_ref_no || "-", "DP Code", invoice.dp_code || "-"],
    ["Company Name", invoice.indentor_name, "GSTIN", invoice.gstin || "-"],
    ["Mobile No.", invoice.mobile_no || "-", "E-mail", invoice.email || "-"],
    ["PO No.", invoice.po_no || "-", "PO Date", invoice.po_date ? formatDate(invoice.po_date) : "-"],
    ["Project", invoice.project || "-", "", ""],
    ["Indentor Address", invoice.indentor_address || "-", "", ""]
  ];
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rows.map((row) => new TableRow({ children: row.map((value, index) => wordCell(value, { bold: index === 0 || index === 2, shade: index === 0 || index === 2 ? "EEF4FF" : undefined })) })) });
}

function itemsTable(invoice: ProformaInvoice) {
  const headings = ["Sl. No.", "Item Description", "Model Type", "Qty.", "Unit Price (INR)", "Total Price (INR)"];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headings.map((heading) => wordCell(heading, { bold: true, shade: "0B1F3A", color: "FFFFFF", align: AlignmentType.CENTER })) }),
      ...invoice.items.map((item, index) => new TableRow({ cantSplit: true, children: [
        wordCell(String(index + 1), { align: AlignmentType.CENTER }),
        wordCell(item.item_description),
        wordCell(item.model_type || "-"),
        wordCell(formatNumber(item.quantity), { align: AlignmentType.RIGHT }),
        wordCell(formatMoney(item.unit_price), { align: AlignmentType.RIGHT }),
        wordCell(formatMoney(item.quantity * item.unit_price), { align: AlignmentType.RIGHT })
      ] }))
    ]
  });
}

function summaryTable(invoice: ProformaInvoice) {
  const rows = [["Subtotal", formatMoney(piSubtotal(invoice))], [`GST @ ${formatPercentage(invoice.gst_percentage)}%`, formatMoney(invoice.gst_amount)], ["Grand Total", formatMoney(invoice.grand_total)]];
  return new Table({ alignment: AlignmentType.RIGHT, width: { size: 48, type: WidthType.PERCENTAGE }, rows: rows.map((row, index) => new TableRow({ cantSplit: true, children: [wordCell(row[0], { bold: true, shade: index === rows.length - 1 ? "0B1F3A" : "EEF4FF", color: index === rows.length - 1 ? "FFFFFF" : "0B1F3A" }), wordCell(row[1], { bold: true, shade: index === rows.length - 1 ? "0B1F3A" : undefined, color: index === rows.length - 1 ? "FFFFFF" : "334155", align: AlignmentType.RIGHT })] })) });
}

function termsTable(invoice: ProformaInvoice) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
    new TableRow({ tableHeader: true, children: [wordCell("Terms & Conditions", { bold: true, shade: "0B1F3A", color: "FFFFFF" }), wordCell("", { shade: "0B1F3A" })] }),
    ...invoice.terms.map((term) => new TableRow({ cantSplit: true, children: [wordCell(term.term_key, { bold: true, shade: "EEF4FF" }), wordCell(term.term_value)] }))
  ] });
}

function signatureParagraphs(invoice: ProformaInvoice) {
  return [
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "For", bold: true, color: "334155", size: 20 })] }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: piCompanyName, bold: true, color: "0B1F3A", size: 20 })] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "Yours Faithfully,", bold: true, color: "334155", size: 20 })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: piCreatorName(invoice), bold: true, color: "0B1F3A", size: 20 })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: invoice.signature_designation || "-", color: "475569", size: 20 })] }),
    new Paragraph({ children: [new TextRun({ text: [invoice.signature_email, invoice.signature_mobile].filter(Boolean).join(" | ") || "-", color: "475569", size: 18 })] })
  ];
}

function fixedFooterParagraphs() {
  return [
    new Paragraph({ children: [new TextRun({ text: "Regd. Office : Adhunik Switchgears Pvt Ltd, Plot No -1700 HSIIDC, RAI Industrial Estate, Sonipat, Haryana", color: "64748B", size: 14 })] }),
    new Paragraph({ children: [new TextRun({ text: "BANK INFORMATION - M/s ADHUNIK SWITCHGEARS PVT LTD | A/c 467901010035389 | UNION BANK OF INDIA | IFSC UBIN0546798 | PAN AAACA2633A | GSTN 06AAACA2633A1ZJ", color: "64748B", size: 14 })] })
  ];
}

function wordCell(text: string, options: { bold?: boolean; shade?: string; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    shading: options.shade ? { fill: options.shade } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" }
    },
    children: [new Paragraph({ alignment: options.align, spacing: { before: 35, after: 35 }, children: [new TextRun({ text, bold: options.bold, color: options.color || "334155", size: 18 })] })]
  });
}

function drawPdfSignature(doc: jsPDF, invoice: ProformaInvoice, margin: number, headerHeight: number, footerTop: number, drawChrome: () => void) {
  let y = lastTableY(doc) + 9;
  const signatureHeight = 34;
  if (y + signatureHeight > footerTop) {
    doc.addPage();
    drawChrome();
    y = 12 + headerHeight;
  }
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text("For", margin, y);
  y += 6;
  doc.setTextColor(...navy);
  doc.text(piCompanyName, margin, y);
  y += 6;
  doc.setTextColor(51, 65, 85);
  doc.text("Yours Faithfully,", margin, y);
  y += 7;
  doc.setTextColor(...navy);
  doc.text(piCreatorName(invoice), margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(invoice.signature_designation || "-", margin, y);
  y += 5;
  doc.text([invoice.signature_email, invoice.signature_mobile].filter(Boolean).join(" | ") || "-", margin, y);
}

function drawPdfFixedFooter(doc: jsPDF, margin: number, pageWidth: number, y: number) {
  doc.setDrawColor(...border);
  doc.line(margin, y - 3, pageWidth - margin, y - 3);
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "bold");
  doc.text("Regd. Office :", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(["Adhunik Switchgears Pvt Ltd", "Plot No -1700 HSIIDC, RAI Industrial Estate, Sonipat, Haryana"], margin, y + 4);
  doc.setFont("helvetica", "bold");
  doc.text("BANK INFORMATION", pageWidth / 2, y);
  doc.setFont("helvetica", "normal");
  const lines = [
    "Party Name: M/s ADHUNIK SWITCHGEARS PVT LTD",
    "Account No: 467901010035389 | Bank: UNION BANK OF INDIA",
    "Branch: SHALIMAR BAGH, NEW DELHI | IFSC: UBIN0546798 | MICR: 110026036",
    "PAN: AAACA2633A | GSTN: 06AAACA2633A1ZJ"
  ];
  lines.forEach((line, index) => doc.text(line, pageWidth / 2, y + 4 + index * 4));
}

function lastTableY(doc: jsPDF) {
  return ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(value || 0);
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function dataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function imageDimensions(dataUrl: string, maxWidth: number, maxHeight: number) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
      resolve({ width: Math.round(image.width * scale), height: Math.round(image.height * scale) });
    };
    image.onerror = () => resolve({ width: maxWidth, height: Math.round(maxHeight * 0.7) });
    image.src = dataUrl;
  });
}

async function loadImage(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Unable to download PI header.");
    const blobUrl = URL.createObjectURL(await response.blob());
    try {
      return await new Promise<string>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, image.naturalWidth);
          canvas.height = Math.max(1, image.naturalHeight);
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("Canvas unavailable."));
            return;
          }
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0);
          resolve(canvas.toDataURL("image/png", 0.92));
        };
        image.onerror = () => reject(new Error("Unable to decode PI header."));
        image.src = blobUrl;
      });
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch (error) {
    console.error("PI header export failed", error);
    return null;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-") || "proforma-invoice";
}
