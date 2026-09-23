/**
 * Bộ dựng lệnh ESC/POS tối giản cho máy in nhiệt 80mm (48 ký tự/dòng ở cỡ chữ
 * thường). Viết tay thuần TypeScript (không phụ thuộc Node — `net`, `serialport`)
 * để DÙNG CHUNG được cho cả 2 đường in: API route phía server (LAN, port 9100)
 * và trình duyệt phía client (Web Bluetooth) — cả hai chỉ cần một `Uint8Array`.
 *
 * LƯU Ý DẤU TIẾNG VIỆT: phần lớn máy in nhiệt giá phổ thông dùng bảng mã ANSI
 * (CP1258) hoặc không hỗ trợ UTF-8 đầy đủ; in thẳng UTF-8 có thể ra ký tự lỗi.
 * Ở đây in AN TOÀN bằng cách bỏ dấu tiếng Việt (một hạn chế đã biết, ghi rõ
 * trong README) — quán có máy in hỗ trợ UTF-8 (đời mới) có thể tự bỏ bước
 * `stripDiacritics` nếu muốn giữ dấu.
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const LINE_WIDTH = 48;

function textToBytes(text: string): number[] {
  return Array.from(stripDiacritics(text)).map((ch) => ch.charCodeAt(0) & 0xff);
}

/** Bỏ dấu tiếng Việt để tương thích bảng mã ASCII của phần lớn máy in nhiệt — xem ghi chú đầu file. */
export function stripDiacritics(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

class EscPosBuilder {
  private bytes: number[] = [];

  init(): this {
    this.bytes.push(ESC, 0x40); // ESC @ — reset máy in
    return this;
  }

  alignCenter(): this {
    this.bytes.push(ESC, 0x61, 1);
    return this;
  }

  alignLeft(): this {
    this.bytes.push(ESC, 0x61, 0);
    return this;
  }

  bold(on: boolean): this {
    this.bytes.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  doubleSize(on: boolean): this {
    this.bytes.push(GS, 0x21, on ? 0x11 : 0x00);
    return this;
  }

  /** Một dòng text đơn giản, tự xuống dòng. */
  line(text = ""): this {
    this.bytes.push(...textToBytes(text), LF);
    return this;
  }

  /** Hai cột canh trái/phải trong độ rộng LINE_WIDTH (48 ký tự) — dùng cho "tên món ... giá tiền". */
  twoColumns(left: string, right: string): this {
    const safeLeft = stripDiacritics(left);
    const safeRight = stripDiacritics(right);
    const gap = Math.max(1, LINE_WIDTH - safeLeft.length - safeRight.length);
    return this.line(safeLeft + " ".repeat(gap) + safeRight);
  }

  dashedLine(): this {
    return this.line("-".repeat(LINE_WIDTH));
  }

  feed(lines = 1): this {
    for (let i = 0; i < lines; i += 1) this.bytes.push(LF);
    return this;
  }

  /** Cắt giấy (partial cut) — máy in không hỗ trợ tự cắt sẽ bỏ qua lệnh này một cách an toàn. */
  cut(): this {
    this.bytes.push(GS, 0x56, 1);
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

export function createEscPosBuilder(): EscPosBuilder {
  return new EscPosBuilder().init();
}
