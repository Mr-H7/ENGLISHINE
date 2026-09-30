export function transferProgress(loaded: number, fileSize: number) {
  const total = Number.isFinite(fileSize) ? Math.max(0, fileSize) : 0;
  return { loaded: Math.min(total, Math.max(0, Number.isFinite(loaded) ? loaded : 0)), total };
}

export function uploadFailureMessage(stage: 'preparing' | 'uploading' | 'finalizing', code?: string) {
  if (code === 'STORAGE_REJECTED') return 'رفض التخزين رفع الملف. تحقق من إعدادات الرفع وحاول مرة أخرى.';
  if (code && /MIME|FILE_TYPE|FILE_SIZE|UPLOAD_SIZE|EMPTY_FILE|VALIDATION/.test(code)) {
    return 'الملف غير صالح للرفع. تحقق من نوع الملف وحجمه.';
  }
  if (code && /UNAUTHORIZED|FORBIDDEN|SESSION|TOKEN/.test(code)) {
    return 'تعذر السماح بالرفع. تحقق من تسجيل الدخول وصلاحيات الحساب.';
  }
  if (stage === 'preparing') return 'تعذر تجهيز الرفع. تحقق من الاتصال وصلاحيات الحساب وحاول مرة أخرى.';
  if (stage === 'finalizing') return 'تعذر إنهاء الرفع وربط الملف بالدرس. حدّث الصفحة وتحقق من المحتوى قبل إعادة الرفع.';
  return 'تعذر الاتصال بالتخزين. تحقق من الشبكة والسماح بأصل الموقع في إعدادات التخزين.';
}
