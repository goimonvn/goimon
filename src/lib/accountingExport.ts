import { EXPENSE_CATEGORY_LABEL, type AccountingReport } from "@/types";
import { formatCurrency } from "./utils";

/** "yyyy-MM-dd" -> "dd/MM/yyyy" để hiển thị trong báo cáo (kế toán quen định dạng ngày Việt Nam). */
function formatDateVn(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

const PAYMENT_METHOD_LABEL = {
  cash: "Tiền mặt",
  vietqr: "Chuyển khoản (VietQR)",
  cod: "Thu hộ khi giao hàng (COD)",
} as const;

function reportPeriodLabel(report: AccountingReport): string {
  const first = report.daily[0]?.date;
  const last = report.daily[report.daily.length - 1]?.date;
  if (!first || !last) return "";
  return first === last ? formatDateVn(first) : `${formatDateVn(first)} - ${formatDateVn(last)}`;
}

// ---------------------------------------------------------------------------
// Excel — dùng thư viện `xlsx` (SheetJS). Import động (dynamic import) để
// không kéo thư viện ~700KB này vào bundle chung của trang — chỉ tải khi
// người dùng thực sự bấm "Xuất Excel".
// ---------------------------------------------------------------------------

/**
 * Xuất báo cáo kế toán (Module 21) ra file Excel nhiều sheet, thay cho CSV
 * thô (Module 10, vẫn giữ song song) — tiện gửi thẳng cho kế toán quán. Số
 * liệu để dạng SỐ THẬT (không format thành chuỗi "đ") để kế toán tự tính lại
 * được ngay trong Excel (SUM, đối chiếu công thức...).
 */
export async function exportAccountingExcel(report: AccountingReport, filename: string): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const period = reportPeriodLabel(report);

  const summaryRows: (string | number)[][] = [
    ["Báo cáo kế toán — Gọi Món"],
    [`Kỳ báo cáo: ${period}`],
    [],
    ["Chỉ tiêu", "Giá trị"],
    ["Tổng doanh thu (đã thanh toán)", report.totals.revenueTotal],
    ["Tổng số đơn", report.totals.ordersCount],
    ["Số đơn đã thanh toán", report.totals.paidOrdersCount],
    ["Tổng chi phí", report.totals.totalExpenses],
    ["Lợi nhuận gộp (doanh thu - chi phí)", report.totals.grossProfit],
    [],
    ["Doanh thu theo phương thức thanh toán"],
    [PAYMENT_METHOD_LABEL.cash, report.paymentBreakdown.cash],
    [PAYMENT_METHOD_LABEL.vietqr, report.paymentBreakdown.vietqr],
    [PAYMENT_METHOD_LABEL.cod, report.paymentBreakdown.cod],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 36 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Tổng quan");

  const dailyRows: (string | number)[][] = [
    ["Ngày", "Doanh thu", "Tổng số đơn", "Số đơn đã thanh toán"],
    ...report.daily.map((row) => [formatDateVn(row.date), row.revenue, row.ordersCount, row.paidOrdersCount]),
  ];
  const dailySheet = XLSX.utils.aoa_to_sheet(dailyRows);
  dailySheet["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, dailySheet, "Doanh thu theo ngày");

  const expenseRows: (string | number)[][] = [
    ["Loại chi phí", "Số tiền"],
    ...report.expensesByCategory.map((row) => [EXPENSE_CATEGORY_LABEL[row.category], row.amount]),
    ["Tổng cộng", report.totals.totalExpenses],
  ];
  const expenseSheet = XLSX.utils.aoa_to_sheet(expenseRows);
  expenseSheet["!cols"] = [{ wch: 20 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, expenseSheet, "Chi phí theo loại");

  const vatRows: (string | number)[][] =
    report.vatInvoices.length > 0
      ? [
          ["Ngày", "Công ty", "Mã số thuế", "Tổng tiền"],
          ...report.vatInvoices.map((row) => [formatDateVn(row.date), row.companyName, row.taxCode, row.totalAmount]),
        ]
      : [["Không có hoá đơn VAT nào trong kỳ báo cáo."]];
  const vatSheet = XLSX.utils.aoa_to_sheet(vatRows);
  vatSheet["!cols"] = [{ wch: 12 }, { wch: 32 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, vatSheet, "Hoá đơn VAT");

  XLSX.writeFile(wb, filename);
}

// ---------------------------------------------------------------------------
// PDF — dùng `jspdf` + `jspdf-autotable`. Font mặc định của jsPDF (Helvetica)
// KHÔNG có đủ dấu tiếng Việt, nên phải nhúng font Unicode riêng (DejaVu Sans,
// giấy phép Bitstream Vera — tự do nhúng lại) làm sẵn ở `public/fonts/`, tải
// qua `fetch()` lúc xuất PDF (không hardcode base64 khổng lồ vào source code)
// rồi đăng ký với jsPDF qua VFS.
// ---------------------------------------------------------------------------

let cachedFonts: { regular: string; bold: string } | null = null;

/** Chuyển ArrayBuffer -> base64 theo từng khối nhỏ (tránh tràn stack với `String.fromCharCode(...bytes)` trên file ~700KB). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadVietnameseFonts(): Promise<{ regular: string; bold: string }> {
  if (cachedFonts) return cachedFonts;

  const [regularRes, boldRes] = await Promise.all([
    fetch("/fonts/DejaVuSans.ttf"),
    fetch("/fonts/DejaVuSans-Bold.ttf"),
  ]);
  if (!regularRes.ok || !boldRes.ok) {
    throw new Error("Không thể tải font tiếng Việt để xuất PDF.");
  }

  const [regularBuf, boldBuf] = await Promise.all([regularRes.arrayBuffer(), boldRes.arrayBuffer()]);
  cachedFonts = {
    regular: arrayBufferToBase64(regularBuf),
    bold: arrayBufferToBase64(boldBuf),
  };
  return cachedFonts;
}

/** `jspdf-autotable` gắn `lastAutoTable` vào instance jsPDF lúc runtime, không có trong kiểu gốc của `jspdf` — ép kiểu tường minh qua `unknown` giống quy ước đã dùng cho các trường embed của Supabase trong dự án. */
function getAutoTableFinalY(doc: import("jspdf").jsPDF, fallback: number): number {
  const withAutoTable = doc as unknown as { lastAutoTable?: { finalY: number } };
  return withAutoTable.lastAutoTable?.finalY ?? fallback;
}

const PDF_MARGIN_X = 40;
const PDF_BOTTOM_MARGIN = 60;
const PDF_BRAND_COLOR: [number, number, number] = [139, 73, 29]; // khớp REVENUE_HUE #8b491d dùng cho biểu đồ

/**
 * Xuất báo cáo kế toán (Module 21) ra file PDF — bản in gọn để gửi/lưu trữ,
 * dùng font DejaVu Sans nhúng riêng để hiện đúng dấu tiếng Việt (xem giải
 * thích ở đầu phần PDF của file này).
 */
export async function exportAccountingPdf(report: AccountingReport, filename: string): Promise<void> {
  const [{ jsPDF }, autoTableModule, fonts] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    loadVietnameseFonts(),
  ]);
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.addFileToVFS("DejaVuSans.ttf", fonts.regular);
  doc.addFileToVFS("DejaVuSans-Bold.ttf", fonts.bold);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");

  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 48;

  function ensureSpace(neededHeight: number) {
    if (y + neededHeight > pageHeight - PDF_BOTTOM_MARGIN) {
      doc.addPage();
      y = 48;
    }
  }

  function sectionTitle(text: string) {
    ensureSpace(30);
    doc.setFont("DejaVu", "bold");
    doc.setFontSize(12);
    doc.text(text, PDF_MARGIN_X, y);
    y += 16;
  }

  doc.setFont("DejaVu", "bold");
  doc.setFontSize(16);
  doc.text("BÁO CÁO KẾ TOÁN — GỌI MÓN", PDF_MARGIN_X, y);
  y += 20;

  doc.setFont("DejaVu", "normal");
  doc.setFontSize(10);
  doc.text(`Kỳ báo cáo: ${reportPeriodLabel(report)}`, PDF_MARGIN_X, y);
  doc.text(`Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}`, doc.internal.pageSize.getWidth() - PDF_MARGIN_X - 140, y);
  y += 24;

  sectionTitle("Tổng quan");
  autoTable(doc, {
    startY: y,
    margin: { left: PDF_MARGIN_X, right: PDF_MARGIN_X },
    styles: { font: "DejaVu", fontSize: 10 },
    headStyles: { font: "DejaVu", fontStyle: "bold", fillColor: PDF_BRAND_COLOR },
    head: [["Chỉ tiêu", "Giá trị"]],
    body: [
      ["Tổng doanh thu (đã thanh toán)", formatCurrency(report.totals.revenueTotal)],
      ["Tổng số đơn", `${report.totals.ordersCount}`],
      ["Số đơn đã thanh toán", `${report.totals.paidOrdersCount}`],
      ["Tổng chi phí", formatCurrency(report.totals.totalExpenses)],
      ["Lợi nhuận gộp (doanh thu - chi phí)", formatCurrency(report.totals.grossProfit)],
    ],
  });
  y = getAutoTableFinalY(doc, y) + 24;

  sectionTitle("Doanh thu theo phương thức thanh toán");
  autoTable(doc, {
    startY: y,
    margin: { left: PDF_MARGIN_X, right: PDF_MARGIN_X },
    styles: { font: "DejaVu", fontSize: 10 },
    headStyles: { font: "DejaVu", fontStyle: "bold", fillColor: PDF_BRAND_COLOR },
    head: [["Phương thức", "Doanh thu"]],
    body: [
      [PAYMENT_METHOD_LABEL.cash, formatCurrency(report.paymentBreakdown.cash)],
      [PAYMENT_METHOD_LABEL.vietqr, formatCurrency(report.paymentBreakdown.vietqr)],
      [PAYMENT_METHOD_LABEL.cod, formatCurrency(report.paymentBreakdown.cod)],
    ],
  });
  y = getAutoTableFinalY(doc, y) + 24;

  sectionTitle("Chi phí theo loại");
  autoTable(doc, {
    startY: y,
    margin: { left: PDF_MARGIN_X, right: PDF_MARGIN_X },
    styles: { font: "DejaVu", fontSize: 10 },
    headStyles: { font: "DejaVu", fontStyle: "bold", fillColor: PDF_BRAND_COLOR },
    head: [["Loại chi phí", "Số tiền"]],
    body: [
      ...report.expensesByCategory.map((row) => [EXPENSE_CATEGORY_LABEL[row.category], formatCurrency(row.amount)]),
      ["Tổng cộng", formatCurrency(report.totals.totalExpenses)],
    ],
  });
  y = getAutoTableFinalY(doc, y) + 24;

  sectionTitle("Doanh thu theo ngày");
  autoTable(doc, {
    startY: y,
    margin: { left: PDF_MARGIN_X, right: PDF_MARGIN_X },
    styles: { font: "DejaVu", fontSize: 9 },
    headStyles: { font: "DejaVu", fontStyle: "bold", fillColor: PDF_BRAND_COLOR },
    head: [["Ngày", "Doanh thu", "Tổng số đơn", "Số đơn đã thanh toán"]],
    body: report.daily.map((row) => [
      formatDateVn(row.date),
      formatCurrency(row.revenue),
      `${row.ordersCount}`,
      `${row.paidOrdersCount}`,
    ]),
  });
  y = getAutoTableFinalY(doc, y) + 24;

  sectionTitle("Hoá đơn VAT");
  if (report.vatInvoices.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: PDF_MARGIN_X, right: PDF_MARGIN_X },
      styles: { font: "DejaVu", fontSize: 9 },
      headStyles: { font: "DejaVu", fontStyle: "bold", fillColor: PDF_BRAND_COLOR },
      head: [["Ngày", "Công ty", "Mã số thuế", "Tổng tiền"]],
      body: report.vatInvoices.map((row) => [
        formatDateVn(row.date),
        row.companyName,
        row.taxCode,
        formatCurrency(row.totalAmount),
      ]),
    });
  } else {
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(10);
    doc.text("Không có hoá đơn VAT nào trong kỳ báo cáo.", PDF_MARGIN_X, y);
  }

  doc.save(filename);
}
