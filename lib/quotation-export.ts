"use client";

import { Document, Footer, Header, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, BorderStyle, VerticalAlign } from "docx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { defaultCompanyHeaderUrl } from "@/lib/constants";
import { formatDate } from "@/lib/date";
import { quotationCreatorName, quotationSignatureCompany } from "@/lib/quotation-signature";
import type { Quotation } from "@/lib/types";

const navy: [number, number, number] = [11, 31, 58];
const lightBlue: [number, number, number] = [238, 244, 255];

export function formatQuotationCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value || 0);
}

export async function exportQuotationPdf(quotation: Quotation) {
  const addressRows = quotationAddressRows(quotation);
  const headerImageData = await loadHeaderImage(quotation.header_image_url || defaultCompanyHeaderUrl);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const headerHeight = headerImageData ? 28 : 12;
  const footerTop = 262;

  const drawFirstPageHeader = () => {
    if (headerImageData) {
      const image = doc.getImageProperties(headerImageData);
      const height = Math.min(28, (pageWidth - margin * 2) * image.height / image.width);
      doc.addImage(headerImageData, "PNG", margin, 8, pageWidth - margin * 2, height, undefined, "FAST");
    } else {
      doc.setFillColor(...navy);
      doc.rect(margin, 8, pageWidth - margin * 2, 9, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("BUSINESS QUOTATION", pageWidth / 2, 14, { align: "center" });
    }

  };

  drawFirstPageHeader();
  let y = 12 + headerHeight;
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("QUOTATION", pageWidth - margin, y, { align: "right" });
  y += 7;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: margin, bottom: 18 },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.6, textColor: [51, 65, 85], overflow: "linebreak" },
    columnStyles: { 0: { fontStyle: "bold", textColor: navy, cellWidth: 29 }, 1: { cellWidth: 61 }, 2: { fontStyle: "bold", textColor: navy, cellWidth: 29 }, 3: { cellWidth: 61 } },
    body: [
      ["Quotation No", quotation.quotation_no, "Date", formatDate(quotation.quotation_date)],
      ["Company Name", quotation.customer_name, "Contract", quotation.contract_name || "-"],
      ["Contact Person", quotation.contact_person || "-", "Mobile", quotation.mobile_number || "-"],
      ["Email", quotation.email || "-", "GST Number", quotation.gst_number || "-"],
      ...addressRows
    ]
  });

  y = lastTableY(doc) + 5;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: margin, bottom: 18 },
    head: [["Sl. No.", "Item Description", "Qty", "Unit", "Unit Price", "Total"]],
    body: quotation.items.map((item, index) => [
      index + 1,
      item.item_description,
      formatNumber(item.quantity),
      item.unit,
      formatMoney(item.unit_price),
      formatMoney(item.quantity * item.unit_price)
    ]),
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: { fontSize: 8.5, cellPadding: 2.2, overflow: "linebreak", valign: "top", lineColor: [203, 213, 225], lineWidth: 0.15 },
    headStyles: { fillColor: navy, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 13, halign: "center" },
      1: { cellWidth: 80 },
      2: { cellWidth: 17, halign: "right" },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 28, halign: "right" }
    }
  });

  const summaryStart = lastTableY(doc) + 5;
  autoTable(doc, {
    startY: summaryStart,
    margin: { left: 112, right: margin, top: margin, bottom: pageHeight - footerTop + 5 },
    theme: "grid",
    body: [
      ["Subtotal", formatMoney(quotationSubtotal(quotation))],
      [`GST @ ${formatPercentage(quotation.gst_percentage)}%`, `${formatPercentage(quotation.gst_percentage)}%`],
      ["GST Amount", formatMoney(quotation.gst_amount)],
      ["Grand Total", formatMoney(quotation.grand_total)]
    ],
    rowPageBreak: "avoid",
    styles: { fontSize: 9, cellPadding: 2.4, lineColor: [203, 213, 225], lineWidth: 0.15 },
    columnStyles: { 0: { cellWidth: 45, fontStyle: "bold", textColor: navy }, 1: { cellWidth: 49, halign: "right", fontStyle: "bold" } },
    didParseCell: ({ row, cell }) => {
      if (row.index === 3) {
        cell.styles.fillColor = navy;
        cell.styles.textColor = [255, 255, 255];
        cell.styles.fontStyle = "bold";
      }
    }
  });

  if (quotation.terms.length) {
    const termsStart = lastTableY(doc) + 7;
    autoTable(doc, {
      startY: termsStart,
      margin: { left: margin, right: margin, top: margin, bottom: pageHeight - footerTop + 5 },
      head: [["Terms & Conditions", ""]],
      body: quotation.terms.map((term) => [term.term_key, term.term_value]),
      showHead: "firstPage",
      rowPageBreak: "avoid",
      styles: { fontSize: 8.5, cellPadding: 2, overflow: "linebreak", lineColor: [203, 213, 225], lineWidth: 0.15 },
      headStyles: { fillColor: navy, textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 45, fontStyle: "bold", textColor: navy }, 1: { cellWidth: 137 } }
    });
  }

  drawPdfSignature(doc, quotation, margin, footerTop);
  drawPdfLastPageFooter(doc, margin, pageWidth, footerTop);
  doc.save(`${safeFileName(quotation.quotation_no)}.pdf`);
}

export async function exportQuotationDocx(quotation: Quotation) {
  const headerImageData = await loadHeaderImage(quotation.header_image_url || defaultCompanyHeaderUrl);
  const headerChildren: Paragraph[] = [];
  if (headerImageData) {
    const dimensions = await imageDimensions(headerImageData, 680, 105);
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: dataUrlBytes(headerImageData), transformation: dimensions, type: "png" })]
      })
    );
  } else {
    headerChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "BUSINESS QUOTATION", bold: true, color: "0B1F3A", size: 24 })] }));
  }

  const document = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 950, right: 794, bottom: 850, left: 794, header: 300, footer: 300 }
        }
      },
      headers: { default: new Header({ children: headerChildren }) },
      footers: {
        default: new Footer({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Quotation ${quotation.quotation_no}`, color: "64748B", size: 16 })] })]
        })
      },
      children: [
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 180 }, children: [new TextRun({ text: "QUOTATION", bold: true, color: "0B1F3A", size: 34 })] }),
        detailsTable(quotation),
        new Paragraph({ spacing: { after: 120 } }),
        itemsTable(quotation),
        new Paragraph({ spacing: { after: 120 } }),
        commercialSummaryTable(quotation),
        new Paragraph({ spacing: { after: 150 } }),
        ...(quotation.terms.length ? [termsTable(quotation), new Paragraph({ spacing: { after: 220 } })] : []),
        ...signatureParagraphs(quotation)
      ]
    }]
  });

  const blob = await Packer.toBlob(document);
  downloadBlob(blob, `${safeFileName(quotation.quotation_no)}.docx`);
}

function detailsTable(quotation: Quotation) {
  const rows = [
    ["Quotation No", quotation.quotation_no, "Date", formatDate(quotation.quotation_date)],
    ["Company Name", quotation.customer_name, "Contract", quotation.contract_name || "-"],
    ["Contact Person", quotation.contact_person || "-", "Mobile", quotation.mobile_number || "-"],
    ["Email", quotation.email || "-", "GST Number", quotation.gst_number || "-"],
    ...quotationAddressRows(quotation)
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row) => new TableRow({
      children: row.map((value, index) => wordCell(value, { bold: index === 0 || index === 2, shade: index === 0 || index === 2 ? "EEF4FF" : undefined }))
    }))
  });
}

function quotationAddressRows(quotation: Quotation) {
  const billing = quotation.address || "-";
  const shipping = quotation.shipping_address || quotation.address || "-";
  return billing === shipping
    ? [["Billing & Shipping Address", billing, "", ""]]
    : [["Billing Address", billing, "", ""], ["Shipping Address", shipping, "", ""]];
}

function itemsTable(quotation: Quotation) {
  const headings = ["Sl. No.", "Item Description", "Quantity", "Unit", "Unit Price", "Total"];
  const rows = quotation.items.map((item, index) => new TableRow({
    cantSplit: true,
    children: [
      wordCell(String(index + 1), { align: AlignmentType.CENTER }),
      wordCell(item.item_description),
      wordCell(formatNumber(item.quantity), { align: AlignmentType.RIGHT }),
      wordCell(item.unit, { align: AlignmentType.CENTER }),
      wordCell(formatMoney(item.unit_price), { align: AlignmentType.RIGHT }),
      wordCell(formatMoney(item.quantity * item.unit_price), { align: AlignmentType.RIGHT })
    ]
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headings.map((heading) => wordCell(heading, { bold: true, shade: "0B1F3A", color: "FFFFFF", align: AlignmentType.CENTER })) }),
      ...rows
    ]
  });
}

function commercialSummaryTable(quotation: Quotation) {
  const rows = [
    ["Subtotal", formatMoney(quotationSubtotal(quotation))],
    [`GST @ ${formatPercentage(quotation.gst_percentage)}%`, `${formatPercentage(quotation.gst_percentage)}%`],
    ["GST Amount", formatMoney(quotation.gst_amount)],
    ["Grand Total", formatMoney(quotation.grand_total)]
  ];

  return new Table({
    alignment: AlignmentType.RIGHT,
    width: { size: 48, type: WidthType.PERCENTAGE },
    rows: rows.map((row, index) => new TableRow({
      cantSplit: true,
      children: [
        wordCell(row[0], { bold: true, shade: index === rows.length - 1 ? "0B1F3A" : "EEF4FF", color: index === rows.length - 1 ? "FFFFFF" : "0B1F3A" }),
        wordCell(row[1], { bold: true, shade: index === rows.length - 1 ? "0B1F3A" : undefined, color: index === rows.length - 1 ? "FFFFFF" : "334155", align: AlignmentType.RIGHT })
      ]
    }))
  });
}

function termsTable(quotation: Quotation) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [wordCell("Terms & Conditions", { bold: true, shade: "0B1F3A", color: "FFFFFF" }), wordCell("", { shade: "0B1F3A" })] }),
      ...quotation.terms.map((term) => new TableRow({ cantSplit: true, children: [wordCell(term.term_key, { bold: true, shade: "EEF4FF" }), wordCell(term.term_value)] }))
    ]
  });
}

function drawPdfSignature(doc: jsPDF, quotation: Quotation, margin: number, footerTop: number) {
  const signatureHeight = 75;
  let y = lastTableY(doc) + 10;
  if (y + signatureHeight > footerTop - 4) {
    doc.addPage();
    y = margin;
  }

  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("For", margin, y);
  y += 6;
  doc.setTextColor(...navy);
  doc.text(quotationSignatureCompany, margin, y);
  y += 52;
  doc.setTextColor(51, 65, 85);
  doc.text("Yours Faithfully,", margin, y);
  y += 7;
  doc.setTextColor(...navy);
  doc.text(quotationCreatorName(quotation), margin, y);
  y += 6;
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.text(quotation.signature_designation || "-", margin, y);
}

function drawPdfLastPageFooter(doc: jsPDF, margin: number, pageWidth: number, y: number) {
  // Content creation is complete here, so the selected page is definitively the last page.
  doc.setPage(doc.getNumberOfPages());
  doc.setDrawColor(203, 213, 225);
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
  [
    "Party Name: M/s ADHUNIK SWITCHGEARS PVT LTD",
    "Account No: 467901010035389 | Bank: UNION BANK OF INDIA",
    "Branch: SHALIMAR BAGH, NEW DELHI | IFSC: UBIN0546798 | MICR: 110026036",
    "PAN: AAACA2633A | GSTN: 06AAACA2633A1ZJ"
  ].forEach((line, index) => doc.text(line, pageWidth / 2, y + 4 + index * 4));
}

function signatureParagraphs(quotation: Quotation) {
  return [
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: "For", bold: true, color: "334155", size: 20 })]
    }),
    new Paragraph({
      spacing: { after: 2950 },
      children: [new TextRun({ text: quotationSignatureCompany, bold: true, color: "0B1F3A", size: 20 })]
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: "Yours Faithfully,", bold: true, color: "334155", size: 20 })]
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: quotationCreatorName(quotation), bold: true, color: "0B1F3A", size: 20 })]
    }),
    new Paragraph({
      children: [new TextRun({ text: quotation.signature_designation || "-", color: "475569", size: 20 })]
    })
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
    children: [new Paragraph({
      alignment: options.align,
      spacing: { before: 35, after: 35 },
      children: [new TextRun({ text, bold: options.bold, color: options.color || "334155", size: 18 })]
    })]
  });
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

function quotationSubtotal(quotation: Quotation) {
  return quotation.items.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
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

async function loadHeaderImage(url: string | null) {
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Unable to download quotation header.");
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
        image.onerror = () => reject(new Error("Unable to decode quotation header."));
        image.src = blobUrl;
      });
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch (error) {
    console.error("Quotation header export failed", error);
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
  return value.replace(/[^a-zA-Z0-9-_]/g, "-") || "quotation";
}
