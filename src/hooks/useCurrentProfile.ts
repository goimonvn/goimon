"use client";

import { supabase } from "@/lib/supabase/client";
import { getCurrentProfile, signOut as signOutService } from "@/services/auth.service";
import type { ProfilesRow } from "@/types/database.types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UseCurrentProfileResult {
  profile: ProfilesRow | null;
  loading: boolean;
  signOut: () => void;
}

/**
 * Hồ sơ (role/tên) của nhân viên/chủ quán đang đăng nhập — dùng ở header của
 * `/staff` và `/admin` để hiển thị tên + nút đăng xuất. Việc CHẶN truy cập
 * khi chưa đăng nhập đã do `middleware.ts` đảm nhiệm ở tầng server; hook này
 * chỉ phục vụ hiển thị, không phải lớp bảo mật.
 */
export function useCurrentProfile(): UseCurrentProfileResult {
  const [profile, setProfile] = useState<ProfilesRow | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await getCurrentProfile();
        if (!cancelled) setProfile(result?.profile ?? null);
      } catch {
        // Bỏ qua: không nên chặn UI vì middleware đã đảm bảo quyền truy cập trang.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => void load());

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(() => {
    void (async () => {
      try {
        await signOutService();
        router.push("/login");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể đăng xuất.");
      }
    })();
  }, [router]);

  return { profile, loading, signOut };
}
