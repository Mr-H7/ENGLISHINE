import { useEffect, useState } from 'react';
import { mediaUrl } from '@/services/api';
import { adminApi, type AdminHomework } from '@/services/admin';

type Question = {
  id: string;
  type: string;
  prompt: string;
  position: number;
  points: number | string | null;
  correctText: string | null;
  choices: Array<{ id: string; label: string; position: number; isCorrect: boolean }>;
};

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
  const [questions, setQuestions] = useState<Question[]>([]);
  const [prompt, setPrompt] = useState('');
  const [choiceA, setChoiceA] = useState('');
  const [choiceB, setChoiceB] = useState('');
  const [correct, setCorrect] = useState('A');
  const [points, setPoints] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function reloadQuestions() {
    const details = await adminApi.homeworkDetails(item.id);
    setQuestions(details.questions ?? []);
  }

  useEffect(() => {
    let active = true;
    void adminApi.homeworkDetails(item.id).then(
      (details) => {
        if (active) setQuestions(details.questions ?? []);
      },
      (reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'تعذر تحميل الأسئلة.');
      },
    );
    return () => {
      active = false;
    };
  }, [item.id]);

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
        <h3>الأسئلة</h3>
        {questions.length ? <ul className="admin-live-list">{questions.map((question) => (
          <li key={question.id}>
            <strong>{question.position + 1}. {question.prompt}</strong>
            <small>{question.type} · {question.points ?? 0} درجة</small>
            <button className="ui-button ui-button-secondary" type="button" disabled={busy} onClick={() => void execute(async () => {
              await adminApi.deleteHomeworkQuestion(question.id);
              await reloadQuestions();
            }, 'حُذف السؤال.')}>حذف السؤال</button>
          </li>
        ))}</ul> : <p>لا توجد أسئلة بعد.</p>}
        <label>نص السؤال<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} /></label>
        <label>اختيار أ<input value={choiceA} onChange={(event) => setChoiceA(event.target.value)} /></label>
        <label>اختيار ب<input value={choiceB} onChange={(event) => setChoiceB(event.target.value)} /></label>
        <label>الإجابة الصحيحة<select value={correct} onChange={(event) => setCorrect(event.target.value)}>
          <option value="A">أ</option><option value="B">ب</option>
        </select></label>
        <label>الدرجة<input type="number" min={0} value={points} onChange={(event) => setPoints(Number(event.target.value))} /></label>
        <button className="ui-button" type="button" disabled={busy || !prompt.trim() || !choiceA.trim() || !choiceB.trim()} onClick={() => void execute(async () => {
          await adminApi.addHomeworkQuestion(item.id, {
            type: 'SINGLE_CHOICE',
            prompt: prompt.trim(),
            position: questions.length,
            points,
            choices: [
              { label: choiceA.trim(), position: 0, isCorrect: correct === 'A' },
              { label: choiceB.trim(), position: 1, isCorrect: correct === 'B' },
            ],
          });
          setPrompt('');
          setChoiceA('');
          setChoiceB('');
          await reloadQuestions();
        }, 'أُضيف السؤال. يبقى الواجب مسودة إلى أن تراجعه وتنشره.')}>إضافة سؤال</button>
      </section>
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
      </section>
      {confirmDelete ? <div className="admin-delete-confirm" role="alertdialog">
        <p>هل تريد حذف الواجب «{item.title}»؟ التسليمات تمنع الحذف.</p>
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
