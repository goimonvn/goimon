/**
 * Thông báo "rung/chuông" cho màn hình nhân viên khi có đơn mới hoặc yêu cầu
 * hỗ trợ mới. Dùng Web Audio API để phát tiếng bíp ngắn (không cần file âm
 * thanh đính kèm) + Vibration API cho tablet/điện thoại hỗ trợ.
 * Cả hai API đều yêu cầu tương tác người dùng trước đó (autoplay policy) nên
 * luôn bọc trong try/catch, không để lỗi này làm gãy luồng chính.
 */
export function playAlertSound(): void {
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    const now = ctx.currentTime;

    [880, 1108].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const start = now + index * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.18);
    });

    window.setTimeout(() => void ctx.close(), 500);
  } catch {
    // Trình duyệt chặn âm thanh tự động — bỏ qua, toast vẫn hiển thị.
  }
}

export function vibrateDevice(pattern: number | number[] = [120, 60, 120]): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Thiết bị/trình duyệt không hỗ trợ — bỏ qua.
  }
}

export function notifyStaff(): void {
  playAlertSound();
  vibrateDevice();
}

/**
 * Thông báo NHẸ cho màn hình khách (Module 7) khi món vừa chuyển sang "Đã
 * xong" — CHỈ rung (không phát âm thanh): khách đang cầm điện thoại riêng ở
 * bàn, không cần chuông như màn hình dùng chung của nhân viên, và rung nhẹ ít
 * gây chú ý xung quanh hơn tiếng bíp.
 */
export function notifyCustomer(): void {
  vibrateDevice(80);
}
