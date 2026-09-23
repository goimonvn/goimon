import net from "net";
import { NextResponse } from "next/server";
import { requireStaffOrAdmin } from "@/lib/supabase/server";

// Bắt buộc chạy Node.js runtime (không phải Edge) vì cần module "net" của
// Node để mở kết nối TCP thô tới máy in nhiệt — Edge runtime không có API này.
export const runtime = "nodejs";

const CONNECT_TIMEOUT_MS = 5000;

interface PrintLanRequestBody {
  ip: string;
  port: number;
  dataBase64: string;
}

function isValidBody(value: unknown): value is PrintLanRequestBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.ip === "string" &&
    body.ip.trim().length > 0 &&
    typeof body.port === "number" &&
    Number.isInteger(body.port) &&
    body.port > 0 &&
    body.port < 65536 &&
    typeof body.dataBase64 === "string" &&
    body.dataBase64.length > 0
  );
}

/** Gửi buffer thô tới máy in qua TCP (chuẩn ESC/POS phổ biến — cổng 9100). */
function sendToPrinter(ip: string, port: number, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    socket.setTimeout(CONNECT_TIMEOUT_MS);

    socket.once("timeout", () => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error("timeout"));
    });

    socket.once("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });

    socket.connect(port, ip, () => {
      socket.write(data, (err) => {
        socket.end();
        if (err) {
          if (settled) return;
          settled = true;
          reject(err);
          return;
        }
        if (settled) return;
        settled = true;
        resolve();
      });
    });
  });
}

/**
 * Route in trực tiếp qua mạng LAN. QUAN TRỌNG: route này CHỈ hoạt động khi
 * server Next.js chạy trong cùng mạng LAN với máy in của quán (self-host tại
 * chỗ) — nếu deploy trên hosting cloud (Vercel...) thì server không có đường
 * mạng tới IP nội bộ của quán và request này sẽ luôn timeout/lỗi kết nối.
 *
 * Yêu cầu đăng nhập với role nhân viên/chủ quán TRƯỚC khi mở kết nối TCP, vì
 * middleware.ts không bảo vệ /api/** — nếu bỏ kiểm tra này, một khách ẩn danh
 * có thể lợi dụng route để dò cổng/tấn công các thiết bị khác trong mạng LAN
 * của quán (SSRF nội bộ).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const authorized = await requireStaffOrAdmin();
  if (!authorized) {
    return NextResponse.json({ error: "Yêu cầu đăng nhập với tài khoản nhân viên/chủ quán." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json({ error: "Thiếu hoặc sai định dạng IP/cổng/dữ liệu in." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(body.dataBase64, "base64");
    await sendToPrinter(body.ip.trim(), body.port, buffer);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Không kết nối được tới máy in. Kiểm tra lại IP, máy in đã bật và cùng mạng LAN với server." },
      { status: 502 }
    );
  }
}
