import { supabase } from "@/lib/supabase/client";
import { AppError, type CounterDisplayEvent } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Tên kênh Supabase Realtime BROADCAST dùng CHUNG giữa màn hình Thu ngân
 * (`/staff/tables`, người gửi) và Màn hình phụ tại quầy (`/counter/display`,
 * người nghe) — xem JSDoc `CounterDisplayEvent` ở types/index.ts. Chỉ 1 kênh
 * duy nhất cho toàn quán (đúng quy mô hiện tại: 1 màn hình phụ ở 1 quầy thu
 * ngân) — không cần tách kênh theo bàn.
 */
const COUNTER_DISPLAY_CHANNEL = "counter_display_channel";
const COUNTER_DISPLAY_EVENT_NAME = "counter_event";

/**
 * Gửi 1 sự kiện tới Màn hình phụ đang mở ở quầy (Module 16) — dùng ở
 * `/staff/tables` khi thu ngân bấm "Hiện lên màn hình phụ" hoặc "Thanh toán
 * qua màn hình phụ". Tự mở 1 kênh MỚI, đợi kết nối xong (trạng thái
 * "SUBSCRIBED") rồi mới gửi và đóng lại ngay — khác với các kênh lắng nghe
 * DÀI HẠN khác trong dự án (vd `subscribeToOrderUpdates`) vì phía gửi chỉ
 * cần gửi đúng 1 lần rồi thôi, không cần giữ kết nối liên tục; độ trễ thêm do
 * phải bắt tay kết nối (thường dưới 1 giây) chấp nhận được vì đây không phải
 * hành động lặp lại liên tục nhiều lần/giây.
 *
 * Nếu không có Màn hình phụ nào đang mở để nhận, việc gửi vẫn "thành công"
 * bình thường (Supabase Broadcast không báo lỗi vì không ai lắng nghe) — đây
 * là hạn chế đã biết, không có cách nào phân biệt "gửi xong, không ai nhận"
 * với "gửi xong, có người nhận" chỉ bằng API Broadcast thuần.
 */
export async function broadcastCounterDisplayEvent(event: CounterDisplayEvent): Promise<void> {
  const channel = supabase.channel(COUNTER_DISPLAY_CHANNEL);
  try {
    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          reject(new AppError("Không thể kết nối tới màn hình phụ."));
        }
      });
    });

    const result = await channel.send({
      type: "broadcast",
      event: COUNTER_DISPLAY_EVENT_NAME,
      payload: event,
    });
    if (result !== "ok") {
      throw new AppError("Không thể gửi tín hiệu tới màn hình phụ.");
    }
  } finally {
    // Luôn đóng kênh dù gửi thành công hay lỗi — tránh rò rỉ kết nối vì đây
    // là kênh dùng 1 lần rồi bỏ (xem JSDoc trên).
    await supabase.removeChannel(channel);
  }
}

/**
 * Lắng nghe sự kiện từ Thu ngân — dùng ở `/counter/display`
 * (`hooks/useCounterDisplay.ts`). Giữ kết nối SUỐT vòng đời trang (khác hàm
 * gửi ở trên) vì Màn hình phụ luôn cần mở sẵn tại quầy để nhận tín hiệu bất
 * kỳ lúc nào, không biết trước khi nào thu ngân sẽ thao tác.
 */
export function subscribeToCounterDisplayEvents(
  onEvent: (event: CounterDisplayEvent) => void
): RealtimeChannel {
  return supabase
    .channel(COUNTER_DISPLAY_CHANNEL)
    .on("broadcast", { event: COUNTER_DISPLAY_EVENT_NAME }, ({ payload }) =>
      onEvent(payload as CounterDisplayEvent)
    )
    .subscribe();
}
