import { useEffect, useState } from 'react';
import { mediaUrl } from '@/services/api';
import { adminApi, type AdminHomework } from '@/services/admin';

export function HomeworkEditor({
  item, onClose, onChanged,
}: {
  item: AdminHomework;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [title, setTitle] = useState(item.title);
  const [instructions, setInstructions] = useState(item.instructions ?? '');
  const [status, setStatus] = useState(item.status);
  const [hasCover, setHasCover] = useState(Boolean(item.coverAssetId));
  const [coverVersion, setCoverVersion] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        if (confirmDelete) setConfirmDelete(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [busy, confirmDelete, onClose]);

  async function execute(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await onChanged();
      setMessage(success);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'تعذر تنفيذ العملية.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="admin-studio-overlay">
    <section className="admin-studio-dialog" role="dialog" aria-modal="true" aria-labelledby="homework-editor-title">
      <header className="admin-workspace-head">
        <div><span>إدارة واجب حالي</span><h2 id="homework-editor-title">تعديل «{item.title}»</h2></div>
        <button type="button" className="ui-button ui-button-secondary" onClick={onClose} disabled={busy}>إغلاق</button>
      </header>
      {error ? <p className="admin-live-status" role="alert">{error}</p> : null}
      {message ? <p className="admin-live-status" role="status">{message}</p> : null}
      <form className="admin-create-panel" onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        void execute(async () => {
          await adminApi.updateHomework(item.id, { title: title.trim(), instructions, status });
          onClose();
        }, 'تم تحديث الواجب.');
      }}>
        <label>عنوان الواجب<input value={title} maxLength={180} required onChange={(event) => setTitle(event.target.value)} /></label>
        <label>شرح الواجب<textarea rows={5} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label>
        <label>حالة النشر<select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="PUBLISHED">منشور</option><option value="DRAFT">مسودة</option>
        </select></label>
        <button className="ui-button" type="submit" disabled={busy}>حفظ التغييرات</button>
      </form>
      <section className="admin-create-panel">
        <h3>غلاف الواجب</h3>
        {hasCover ? <img className="admin-cover-preview" src={mediaUrl(`/media/covers/homework/${item.id}?v=${coverVersion}`)} alt={`غلاف ${item.title}`} /> : <p>لا يوجد غلاف للواجب.</p>}
        <label>رفع أو استبدال الغلاف<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void execute(async () => {
            await adminApi.uploadCover('homework', item.id, file);
            setHasCover(true);
            setCoverVersion(Date.now());
          }, 'تم رفع غلاف الواجب.');
        }} /></label>
        {hasCover ? <button className="ui-button ui-button-secondary" type="button" disabled={busy} onClick={() => void execute(async () => {
          await adminApi.removeCover('homework', item.id);
          setHasCover(false);
        }, 'حُذف غلاف الواجب.')}>إزالة الغلاف</button> : null}
      </section>
      {confirmDelete ? <div className="admin-delete-confirm" role="alertdialog" aria-modal="true" aria-label={`حذف الواجب «${item.title}»`}>
        <p>هل تريد حذف الواجب «{item.title}»؟ سيختفي من القوائم ولن تُحذف التسليمات تلقائيًا.</p>
        <div className="admin-live-actions">
          <button className="ui-button ui-button-secondary" type="button" onClick={() => setConfirmDelete(false)} disabled={busy}>إلغاء</button>
          <button className="ui-button" type="button" disabled={busy} onClick={() => void execute(async () => {
            await adminApi.deleteHomework(item.id);
            onClose();
          }, 'تم حذف الواجب.')}>تأكيد الحذف</button>
        </div>
      </div> : <button className="ui-button ui-button-secondary" type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>حذف الواجب</button>}
    </section>
  </div>;
}
