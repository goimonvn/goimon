/**
 * Phát 1 tiếng "ting" ngắn bằng Web Audio API — KHÔNG dùng file âm thanh
 * (tránh phải thêm asset/dependency mới), an toàn bỏ qua nếu trình duyệt chặn
 * (vd chưa từng có tương tác người dùng). Tách ra khỏi CheckoutSheet.tsx
 * (Module 15, nơi hàm này được viết lần đầu) để dùng chung cho cả Màn hình
 * phụ tại quầy (Module 16, `/counter/display`) — tránh lặp lại y hệt logic ở
 * 2 nơi.
 */
export function playTingSound(): void {
  try {
    const AudioContextCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
    oscillator.frequency.setValueAtTime(1568, ctx.currentTime + 0.12); // G6
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.5);
    oscillator.onended = () => void ctx.close();
  } catch {
    // Bỏ qua — hiệu ứng âm thanh chỉ là tiện ích cộng thêm, không được phép gây lỗi màn hình thanh toán.
  }
}
