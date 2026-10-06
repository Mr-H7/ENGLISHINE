import { useEffect, useState } from 'react';
import { mediaUrl } from '@/services/api';
import {
  adminApi,
  type AdminActivationCode,
  type AdminCourseDetails,
  type AdminLesson,
  type StageOption,
  type UploadProgressHandler,
} from '@/services/admin';

type Unit = AdminCourseDetails['units'][number];
type Video = NonNullable<AdminLesson['videos']>[number];
type Resource = NonNullable<AdminLesson['resources']>[number];
export type StudioTarget =
  | { kind: 'course'; record: AdminCourseDetails }
  | { kind: 'unit'; record: Unit }
  | { kind: 'lesson'; record: AdminLesson }
  | { kind: 'video'; record: Video; lessonId: string }
  | { kind: 'resource'; record: Resource; lessonId: string };

const names = { course: 'الدورة', unit: 'الوحدة', lesson: 'الدرس', video: 'الفيديو', resource: 'ملف PDF' };
const accessOptions = [
  { value: 'ENROLLED', label: 'مدفوع' },
  { value: 'FREE', label: 'مجاني' },
  { value: 'PREVIEW', label: 'معاينة مجانية' },
  { value: 'LOCKED', label: 'مغلق' },
];
const statusOptions = [
  { value: 'PUBLISHED', label: 'منشور' },
  { value: 'DRAFT', label: 'مسودة' },
  { value: 'PRIVATE', label: 'خاص' },
  { value: 'READY', label: 'جاهز' },
  { value: 'COMING_SOON', label: 'قريبًا' },
  { value: 'ARCHIVED', label: 'مؤرشف' },
];

export function ContentStudioEditor({
  target, stages, onClose, onChanged, onRemoved, onUploadProgress,
}: {
  target: StudioTarget;
  stages: StageOption[];
  onClose: () => void;
  onChanged: () => Promise<void>;
  onRemoved: () => Promise<void>;
  onUploadProgress: UploadProgressHandler;
}) {
  const [title, setTitle] = useState(target.record.title);
  const [description, setDescription] = useState('description' in target.record ? target.record.description ?? '' : '');
  const [shortDescription, setShortDescription] = useState(target.kind === 'course' ? target.record.shortDescription ?? '' : '');
  const [status, setStatus] = useState('status' in target.record ? target.record.status : '');
  const [access, setAccess] = useState('accessLevel' in target.record ? target.record.accessLevel : '');
  const [position, setPosition] = useState('position' in target.record ? target.record.position : 0);
  const [videoType, setVideoType] = useState(target.kind === 'video' ? target.record.type : 'EXPLANATION');
  const [gradeId, setGradeId] = useState(target.kind === 'course' ? target.record.grade?.id ?? '' : '');
  const [hasCover, setHasCover] = useState(target.kind === 'unit' && Boolean(target.record.coverAssetId));
  const [coverVersion, setCoverVersion] = useState(0);
  const [replacement, setReplacement] = useState<File | null>(null);
  const [codes, setCodes] = useState<AdminActivationCode[]>([]);
  const [newCode, setNewCode] = useState('');
  const [codeLabel, setCodeLabel] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState('');
  const [confirm, setConfirm] = useState<{ label: string; action: () => Promise<void> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const kind = target.kind;
  const targetId = target.record.id;

  useEffect(() => {
    if (kind !== 'unit' && kind !== 'lesson') return;
    let active = true;
    void adminApi.activationCodes(kind === 'unit' ? { unitId: targetId } : { lessonId: targetId })
      .then((items) => { if (active) setCodes(items); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'تعذر تحميل الأكواد.'); });
    return () => { active = false; };
  }, [kind, targetId]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        if (confirm) setConfirm(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [busy, confirm, onClose]);

  async function execute(action: () => Promise<void>, success: string, close = false, refresh = true) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      if (refresh) await onChanged();
      setMessage(success);
      if (close) onClose();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'تعذر حفظ التغييرات.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!title.trim()) { setError('عنوان المحتوى مطلوب.'); return; }
    await execute(async () => {
      if (target.kind === 'course') {
        await adminApi.updateCourse(targetId, {
          title: title.trim(), gradeId: gradeId || null,
          shortDescription: shortDescription.trim(), description: description.trim(),
          status: status as AdminCourseDetails['status'],
          accessLevel: access as AdminCourseDetails['accessLevel'],
        });
      } else if (target.kind === 'unit') {
        await adminApi.updateUnit(targetId, { title: title.trim(), description, status, accessLevel: access, position });
      } else if (target.kind === 'lesson') {
        await adminApi.updateLesson(targetId, { title: title.trim(), description, status, accessLevel: access, position });
      } else if (target.kind === 'video') {
        await adminApi.updateVideo(targetId, { title: title.trim(), type: videoType, status, accessLevel: access, position });
      } else {
        await adminApi.updateResource(targetId, { title: title.trim(), position });
      }
    }, 'تم حفظ التغييرات على السجل الحالي.', true);
  }

  function requestDelete() {
    setConfirm({
      label: `هل تريد حذف ${names[kind]} «${target.record.title}»؟`,
      action: async () => {
        if (kind === 'course') await adminApi.deleteCourse(targetId);
        else if (kind === 'unit') await adminApi.deleteUnit(targetId);
        else if (kind === 'lesson') await adminApi.deleteLesson(targetId);
        else if (kind === 'video') await adminApi.deleteVideo(targetId);
        else await adminApi.deleteResource(targetId);
        await onRemoved();
        onClose();
      },
    });
  }

  async function uploadCover(file: File) {
    await execute(async () => {
      await adminApi.uploadCover('unit', targetId, file);
      setHasCover(true);
      setCoverVersion(Date.now());
    }, 'تم رفع غلاف الوحدة.');
  }

  async function replaceFile() {
    if (!replacement || (kind !== 'video' && kind !== 'resource')) return;
    await execute(async () => {
      if (kind === 'video') {
        await adminApi.uploadVideo(target.lessonId, replacement, {
          title: title.trim(), type: videoType, accessLevel: access,
          status, position,
        }, onUploadProgress, targetId);
      } else {
        await adminApi.uploadResource(target.lessonId, replacement, title.trim(), onUploadProgress, targetId);
      }
      setReplacement(null);
    }, 'تم استبدال الملف مع الحفاظ على السجل الحالي.');
  }

  async function createCode() {
    if (kind !== 'unit' && kind !== 'lesson') return;
    await execute(async () => {
      const created = await adminApi.createActivationCode({
        unlockType: kind === 'unit' ? 'UNIT' : 'LESSON',
        targetId, label: codeLabel.trim() || undefined, maxUses,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      setNewCode(created.code);
      setCodes(await adminApi.activationCodes(kind === 'unit' ? { unitId: targetId } : { lessonId: targetId }));
    }, 'تم إنشاء الكود. انسخه الآن؛ لن يظهر مرة أخرى.');
  }

  return (
    <div className="admin-studio-overlay">
      <section className="admin-studio-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-editor-title">
        <header className="admin-workspace-head">
          <div><span>إدارة المحتوى الحالي</span><h2 id="studio-editor-title">تعديل {names[kind]} «{target.record.title}»</h2></div>
          <button type="button" className="ui-button ui-button-secondary" onClick={onClose} disabled={busy}>إغلاق</button>
        </header>
        {error ? <p className="admin-live-status" role="alert">{error}</p> : null}
        {message ? <p className="admin-live-status" role="status">{message}</p> : null}
        <form className="admin-create-panel" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <label>العنوان<input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={180} /></label>
          {(kind === 'unit' || kind === 'lesson') ? <label>الوصف<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label> : null}
          {kind === 'course' ? <label>الصف
            <select value={gradeId} onChange={(event) => setGradeId(event.target.value)}>
              <option value="">بدون صف محدد</option>
              {stages.flatMap((stage) => stage.grades).map((grade) => <option key={grade.id} value={grade.id}>{grade.nameAr}</option>)}
            </select>
          </label> : null}
          {kind === 'course' ? <label>الملخص القصير<textarea value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} rows={2} maxLength={320} /></label> : null}
          {kind === 'course' ? <label>وصف الدورة<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} /></label> : null}
          {kind !== 'resource' ? <label>حالة النشر
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.filter((option) => kind === 'course' ? !['READY', 'COMING_SOON'].includes(option.value) : option.value !== 'PRIVATE').map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label> : null}
          {kind !== 'resource' ? <label>الوصول
            <select value={access} onChange={(event) => setAccess(event.target.value)}>
              {accessOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label> : null}
          {kind !== 'course' ? <label>الترتيب<input type="number" min={0} value={position} onChange={(event) => setPosition(Number(event.target.value))} /></label> : null}
          {kind === 'video' ? <label>نوع الفيديو
            <select value={videoType} onChange={(event) => setVideoType(event.target.value)}>
              {['EXPLANATION', 'EXERCISE_SOLUTION', 'STORY', 'REVISION', 'FREE_REEL', 'OTHER'].map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label> : null}

          <div className="admin-live-actions">
            <button className="ui-button" type="submit" disabled={busy}>حفظ التغييرات</button>
            <button className="ui-button ui-button-secondary" type="button" disabled={busy} onClick={requestDelete}>حذف {names[kind]}</button>
          </div>
        </form>
        {kind === 'unit' ? <section className="admin-create-panel">
          <h3>غلاف الوحدة</h3>
          {hasCover ? <img className="admin-cover-preview" src={mediaUrl(`/media/covers/unit/${targetId}?v=${coverVersion}`)} alt={`غلاف ${title}`} /> : <p>لا يوجد غلاف. يمكن حفظ الوحدة بدونه.</p>}
          <label>رفع أو استبدال الغلاف<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file); }} /></label>
          {hasCover ? <button className="ui-button ui-button-secondary" type="button" disabled={busy} onClick={() => void execute(async () => { await adminApi.removeCover('unit', targetId); setHasCover(false); }, 'حُذف غلاف الوحدة.')}>إزالة الغلاف</button> : null}
        </section> : null}
        {(kind === 'video' || kind === 'resource') ? <section className="admin-create-panel">
          <h3>استبدال الملف</h3>
          <p>الاستبدال يحافظ على {names[kind]} وروابط الطلاب الحالية.</p>
          <input type="file" accept={kind === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'application/pdf'} disabled={busy} onChange={(event) => setReplacement(event.target.files?.[0] ?? null)} />
          <button className="ui-button" type="button" disabled={busy || !replacement} onClick={() => void replaceFile()}>استبدال الملف الحالي</button>
        </section> : null}
        {(kind === 'unit' || kind === 'lesson') ? <section className="admin-create-panel">
          <h3>أكواد تفعيل {names[kind]}</h3>
          <p>يمنح الكود الوصول إلى {names[kind]} فقط. يظهر الرمز مرة واحدة بعد إنشائه.</p>
          <label>وصف الكود الداخلي<input value={codeLabel} onChange={(event) => setCodeLabel(event.target.value)} maxLength={120} /></label>
          <label>أقصى عدد للاستخدامات<input type="number" min={1} max={1000} value={maxUses} onChange={(event) => setMaxUses(Number(event.target.value))} /></label>
          <label>تاريخ الانتهاء (اختياري)<input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
          <button className="ui-button" type="button" disabled={busy || maxUses < 1} onClick={() => void createCode()}>إنشاء كود تفعيل</button>
          {newCode ? <div role="status" className="admin-code-once"><strong>انسخ الكود الآن</strong><input dir="ltr" readOnly value={newCode} onFocus={(event) => event.target.select()} /></div> : null}
          {codes.length ? <ul className="admin-live-list">
            {codes.map((code) => <li key={code.id}>
              <strong>{code.label || names[kind]}</strong>
              <small>{code.status} · استخدام {code.usedCount} من {code.maxUses} · {code.redemptions.length} عمليات تفعيل</small>
              {code.redemptions.map((redemption) => <small key={redemption.id}>{redemption.student.fullName} · {new Date(redemption.redeemedAt).toLocaleDateString('ar-EG')}</small>)}
              {code.status === 'ACTIVE' ? <button className="ui-button ui-button-secondary" type="button" onClick={() => setConfirm({ label: `تعطيل الكود «${code.label || code.id}»؟`, action: async () => { await adminApi.disableActivationCode(code.id); setCodes(await adminApi.activationCodes(kind === 'unit' ? { unitId: targetId } : { lessonId: targetId })); } })}>تعطيل الكود</button> : null}
              {!code.redemptions.length ? <button className="ui-button ui-button-secondary" type="button" onClick={() => setConfirm({ label: `حذف الكود غير المستخدم «${code.label || code.id}»؟`, action: async () => { await adminApi.deleteActivationCode(code.id); setCodes(await adminApi.activationCodes(kind === 'unit' ? { unitId: targetId } : { lessonId: targetId })); } })}>حذف الكود غير المستخدم</button> : null}
            </li>)}
          </ul> : <p>لا توجد أكواد لهذا المحتوى.</p>}
        </section> : null}
        {confirm ? <div className="admin-delete-confirm" role="alertdialog" aria-modal="true" aria-label={confirm.label}>
          <p>{confirm.label}</p>
          <div className="admin-live-actions">
            <button className="ui-button ui-button-secondary" type="button" onClick={() => setConfirm(null)} disabled={busy}>إلغاء</button>
            <button className="ui-button" type="button" disabled={busy} onClick={() => {
              const action = confirm.action;
              setConfirm(null);
              void execute(action, 'تم تنفيذ الإجراء.', false, false);
            }}>تأكيد</button>
          </div>
        </div> : null}
      </section>
    </div>
  );
}
