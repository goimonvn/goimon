import { createEscPosBuilder } from "@/lib/escpos";
import { formatCurrency } from "@/lib/utils";
import { AppError, type OrderWithItems, type PrinterSettings, type ReceiptData } from "@/types";
import type { PaymentMethod, TablesRow } from "@/types/database.types";

const SHOP_NAME = "GOI MON - QUAN CA PHE";

/** Gom dữ liệu bàn + đơn hàng (+ VAT nếu có) thành ReceiptData để build tem in — tránh UI phải tự biết cấu trúc ESC/POS. */
export function buildReceiptData(
  table: TablesRow,
  orders: OrderWithItems[],
  paymentMethod: PaymentMethod | null,
  vat: { companyName: string; taxCode: string } | null
): ReceiptData {
  return {
    shopName: SHOP_NAME,
    tableNumber: table.table_number,
    printedAt: new Date(),
    orders: orders.map((order) => ({
      orderShortId: order.id.slice(0, 8).toUpperCase(),
      items: order.order_items.map((item) => ({
        name: item.menu_item?.name ?? "Mon",
        quantity: item.quantity,
        notes: item.notes,
        // Module 11: dòng thuộc combo mang thêm combo_group_id/combo_name để
        // buildReceiptBytes gộp in dưới 1 dòng "COMBO: ten".
        comboGroupId: item.combo_group_id,
        comboName: item.combo_name,
      })),
    })),
    totalAmount: orders.reduce((sum, o) => sum + o.total_amount, 0),
    paymentMethod,
    vat,
  };
}

function buildReceiptBytes(data: ReceiptData): Uint8Array {
  const builder = createEscPosBuilder()
    .alignCenter()
    .bold(true)
    .doubleSize(true)
    .line(data.shopName)
    .doubleSize(false)
    .line("HOA DON TAM TINH")
    .bold(false)
    .dashedLine()
    .alignLeft()
    .twoColumns("Ban so", String(data.tableNumber))
    .twoColumns("Thoi gian in", data.printedAt.toLocaleString("vi-VN"))
    .dashedLine();

  if (data.orders.length === 0) {
    builder.line("Chua co don hang nao.");
  }

  for (const order of data.orders) {
    builder.line(`Don #${order.orderShortId}`);
    // Module 11: gộp các dòng cùng comboGroupId dưới 1 dòng "COMBO: ten" cho
    // gọn — mỗi group chỉ in 1 lần dù order_items có thể không liền kề nhau
    // (khách gọi thêm món lẻ xen giữa các lần gửi đơn).
    const printedComboGroups = new Set<string>();
    for (const item of order.items) {
      if (item.comboGroupId) {
        if (printedComboGroups.has(item.comboGroupId)) continue;
        printedComboGroups.add(item.comboGroupId);
        builder.line(`COMBO: ${item.comboName ?? "Combo"}`);
        for (const comboItem of order.items.filter((i) => i.comboGroupId === item.comboGroupId)) {
          builder.twoColumns(`  ${comboItem.quantity}x ${comboItem.name}`, "");
          if (comboItem.notes) builder.line(`    (${comboItem.notes})`);
        }
        continue;
      }
      builder.twoColumns(`${item.quantity}x ${item.name}`, "");
      if (item.notes) builder.line(`  (${item.notes})`);
    }
  }

  builder.dashedLine();
  builder.bold(true).twoColumns("TONG CONG", formatCurrency(data.totalAmount)).bold(false);

  if (data.paymentMethod) {
    builder.line(`Thanh toan: ${data.paymentMethod === "cash" ? "Tien mat" : "Chuyen khoan"}`);
  }

  if (data.vat) {
    builder.dashedLine();
    builder.line("Xuat hoa don VAT:");
    builder.line(`Cong ty: ${data.vat.companyName}`);
    builder.line(`MST: ${data.vat.taxCode}`);
  }

  builder.dashedLine().alignCenter().line("Cam on quy khach!").feed(3).cut();

  return builder.build();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

/**
 * In qua mạng LAN: trình duyệt KHÔNG thể tự mở raw TCP socket tới máy in
 * (giới hạn bảo mật của mọi trình duyệt) nên phải nhờ server (route
 * `/api/print/lan`, chạy Node.js) làm cầu nối. Vì vậy đường in này CHỈ hoạt
 * động khi server Next.js có thể tới được IP máy in trong mạng LAN của quán —
 * tức là server phải chạy trong CÙNG mạng LAN (self-host tại quán), KHÔNG áp
 * dụng nếu deploy lên hosting cloud không có đường tới mạng nội bộ của quán.
 */
async function printViaLan(bytes: Uint8Array, settings: PrinterSettings): Promise<void> {
  if (!settings.lanIp.trim()) {
    throw new AppError("Chưa cấu hình IP máy in nhiệt. Vào Cài đặt máy in để thiết lập.");
  }

  const response = await fetch("/api/print/lan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ip: settings.lanIp.trim(),
      port: settings.lanPort,
      dataBase64: bytesToBase64(bytes),
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new AppError(body?.error ?? "Không thể in qua mạng LAN. Kiểm tra lại IP máy in và kết nối mạng.");
  }
}

/**
 * In qua Web Bluetooth (BLE). LƯU Ý QUAN TRỌNG: Web Bluetooth chỉ hỗ trợ
 * Bluetooth Low Energy (GATT) — máy in Bluetooth Classic/SPP (rất phổ biến ở
 * dòng máy in nhiệt giá rẻ) KHÔNG kết nối được qua đường này, chỉ dùng được
 * cho máy in có giao tiếp BLE thật sự. UUID service/characteristic khác nhau
 * tuỳ hãng — cần cấu hình đúng trong Cài đặt máy in.
 */
async function printViaBluetooth(bytes: Uint8Array, settings: PrinterSettings): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.bluetooth) {
    throw new AppError(
      "Trình duyệt này không hỗ trợ Web Bluetooth (chỉ Chrome/Edge trên máy tính hoặc Android). Hãy dùng in qua mạng LAN thay thế."
    );
  }

  let characteristic: BluetoothRemoteGATTCharacteristic;
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [settings.bleServiceUuid] }],
    });
    const server = await device.gatt?.connect();
    if (!server) throw new Error("no-gatt-server");
    const service = await server.getPrimaryService(settings.bleServiceUuid);
    characteristic = await service.getCharacteristic(settings.bleCharacteristicUuid);
  } catch (error) {
    throw new AppError(
      "Không thể kết nối máy in Bluetooth. Kiểm tra máy in đã bật, ở gần thiết bị, và UUID cấu hình đúng.",
      error
    );
  }

  // Chia nhỏ gói tin (mặc định 20 byte/gói, giới hạn ATT MTU tối thiểu của BLE)
  // kèm nghỉ ngắn giữa các gói — nhiều máy in nhiệt BLE giá rẻ bị tràn hàng đợi
  // và mất dữ liệu nếu ghi liên tục không nghỉ.
  const CHUNK_SIZE = 20;
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.slice(offset, offset + CHUNK_SIZE);
    try {
      if (characteristic.writeValueWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
    } catch (error) {
      throw new AppError("Mất kết nối máy in Bluetooth trong lúc in. Vui lòng thử lại.", error);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** In trực tiếp hoá đơn — không qua hộp thoại in của trình duyệt. Dùng đường LAN hoặc Bluetooth theo cấu hình hiện tại. */
export async function printReceiptDirect(data: ReceiptData, settings: PrinterSettings): Promise<void> {
  const bytes = buildReceiptBytes(data);

  if (settings.connection === "bluetooth") {
    await printViaBluetooth(bytes, settings);
  } else {
    await printViaLan(bytes, settings);
  }
}
