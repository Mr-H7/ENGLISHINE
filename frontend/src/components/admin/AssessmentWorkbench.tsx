import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest, mediaUrl } from '@/services/api';
import { QuestionImage, type QuestionImageInfo } from '@/components/assessment/QuestionImage';

type Kind = 'homework' | 'exam';
type Choice = { label: string; position: number; isCorrect: boolean };
type Question = { id: string; type: string; prompt: string; position: number; points: string | number | null; correctText: string | null; image?: QuestionImageInfo | null; choices: Choice[] };
type Attempt = { id: string; attemptNo: number; status: string; reviewStatus?: string; passed?: boolean | null; result?: { passed: boolean | null; publishedAt: string | null } | null; student: { id: string; fullName: string }; answers: { id: string; textAnswer: string | null; awardedPoints: string | number | null; question: { prompt: string; points: string | number | null } }[] };
type View = {
  assessment: { id: string; title: string; instructions: string | null; status: string; maxAttempts: number; passingPercentage: string | number | null; questions?: Question[]; sections?: { id: string; title: string; questions: Question[] }[] };
  attempts: Attempt[];
  grants: { id: string; studentId: string; amount: number; createdAt: string; student: { fullName: string } }[];
  imports: { id: string; status: string; errorMessage: string | null; sourceAsset: { originalName: string } }[];
};
const data = <T,>(path: string, init?: RequestInit) => apiRequest<{ data: T }>(path, init).then((r) => r.data);
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const types = [['SINGLE_CHOICE', 'اختيار واحد'], ['MULTIPLE_CHOICE', 'اختيارات متعددة'], ['TRUE_FALSE', 'صح / خطأ'], ['SHORT_TEXT', 'إجابة قصيرة'], ['LONG_TEXT', 'إجابة مقالية']];

export function AssessmentWorkbench({ kind, id, onChanged, onClose, onDeleted }: { kind: Kind; id: string; onChanged: () => Promise<unknown>; onClose: () => void; onDeleted?: () => void }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Question | 'new' | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [students, setStudents] = useState<{ id: string; fullName: string }[]>([]);
  const [targets, setTargets] = useState<{ value: string; label: string }[]>([]);
  const path = `/admin/assessments/${kind}/${id}`;
  const reload = () => data<View>(path).then(setView);
  useEffect(() => {
    let active = true;
    void data<View>(path).then((value) => { if (active) setView(value); }, (reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'تعذر تحميل التقييم.'); });
    void apiRequest<{ data: { id: string; fullName: string }[] }>('/admin/students').then((value) => { if (active) setStudents(value.data); }).catch(() => undefined);
    void apiRequest<{ data: { id: string }[] }>('/admin/courses').then(async (courses) => {
      const contexts = await Promise.all(courses.data.map((course) => data<{ title: string; units: { id: string; title: string; lessons: { id: string; title: string }[] }[] }>(`/admin/courses/${course.id}`)));
      if (active) setTargets(contexts.flatMap((course) => course.units.flatMap((unit) => [{ value: `unit:${unit.id}`, label: `${course.title} — ${unit.title}` }, ...unit.lessons.map((lesson) => ({ value: `lesson:${lesson.id}`, label: `${unit.title} — ${lesson.title}` }))])));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [path]);
  async function run(action: () => Promise<unknown>, success = 'تم حفظ التغييرات.') {
    if (busy) return;
    setBusy(true); setError(null); setMessage(null);
    try { await action(); await reload(); await onChanged(); setMessage(success); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر تنفيذ العملية.'); }
    finally { setBusy(false); }
  }
  async function deleteAssessment(title: string) {
    if (busy || !window.confirm(`حذف «${title}»؟ لا يمكن حذف تقييم له محاولات أو متطلبات تقدم.`)) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      await apiRequest(`/admin/${kind === 'exam' ? 'exams' : 'homework'}/${id}`, { method: 'DELETE' });
      await onChanged();
      onDeleted?.();
      onClose();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'تعذر الحذف.');
      setBusy(false);
    }
  }
  if (!view) return <section className="admin-card" aria-busy={!error}>{error ? <p role="alert">{error}</p> : <p>جارٍ تحميل التقييم…</p>}</section>;
  const assessment = view.assessment;
  const questions = assessment.questions ?? assessment.sections?.flatMap((section) => section.questions) ?? [];
  return <section className="admin-card" aria-labelledby={`assessment-${id}`}>
    <h2 id={`assessment-${id}`}>إعداد التقييم — {assessment.title}</h2>
    <button className="ui-button ui-button-secondary" type="button" onClick={onClose} disabled={busy}>إغلاق إعداد التقييم</button>
    {error ? <p className="admin-live-status" role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    <details open><summary>الإعدادات والنشر</summary>
      <form className="admin-live-form" key={`${id}-${assessment.status}`} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void run(() => data(`/admin/${kind === 'exam' ? 'exams' : 'homework'}/${id}`, json('PATCH', { title: form.get('title'), instructions: form.get('instructions'), maxAttempts: Number(form.get('maxAttempts')), passingPercentage: Number(form.get('passingPercentage')), status: form.get('status') }))); }}>
        <label>العنوان<input name="title" required defaultValue={assessment.title} maxLength={180} /></label>
        <label>التعليمات<textarea name="instructions" defaultValue={assessment.instructions ?? ''} rows={3} /></label>
        <label>نسبة الاجتياز<input name="passingPercentage" type="number" min={0} max={100} required defaultValue={assessment.passingPercentage ?? 60} /></label>
        <label>المحاولات الأساسية<input name="maxAttempts" type="number" min={1} max={100} required defaultValue={assessment.maxAttempts} /></label>
        <label>الحالة<select name="status" defaultValue={assessment.status}><option value="DRAFT">مسودة</option><option value="PUBLISHED">نشر بعد المراجعة</option><option value="ARCHIVED">أرشيف</option></select></label>
        <button className="ui-button" disabled={busy}>حفظ الإعدادات</button>
      </form>
      <button type="button" className="ui-button ui-button-secondary" disabled={busy} onClick={() => void deleteAssessment(assessment.title)}>حذف التقييم</button>
    </details>
    <details><summary>PDF المصدر وحالة الاستيراد</summary>
      <p>استخراج الأسئلة غير متصل بمزوّد حاليًا. ارفع المصدر ثم أنشئ الأسئلة وراجعها يدويًا. لا يتم النشر تلقائيًا.</p>
      <form className="admin-live-form" onSubmit={(event) => { event.preventDefault(); const body = new FormData(event.currentTarget); void run(() => data(`${path}/imports`, { method: 'POST', body }), 'تم حفظ المصدر؛ أضف الأسئلة يدويًا.'); }}>
        <label>ملف PDF<input type="file" name="file" accept="application/pdf" required disabled={assessment.status !== 'DRAFT'} /></label><button className="ui-button" disabled={busy || assessment.status !== 'DRAFT'}>رفع المصدر</button>
      </form>
      <ul className="admin-live-list">{view.imports.map((job) => <li key={job.id}><strong dir="auto">{job.sourceAsset.originalName}</strong><small>{job.status === 'UPLOADED' ? 'المصدر محفوظ — إضافة الأسئلة يدويًا' : job.status}</small><p>{job.errorMessage}</p><a className="ui-button ui-button-secondary" href={mediaUrl(`/admin/assessment-imports/${job.id}/source`)} target="_blank" rel="noreferrer">مراجعة ملف المصدر</a></li>)}</ul>
    </details>
    <details open><summary>الأسئلة ومراجعة المسودة ({questions.length})</summary>
      <ul className="admin-live-list">{questions.map((question) => <li key={question.id}><strong dir="auto">{question.prompt}</strong><small>{types.find(([key]) => key === question.type)?.[1]} · {question.points ?? 0} درجة · ترتيب {question.position}</small><div className="admin-live-actions"><button className="ui-button ui-button-secondary" type="button" disabled={busy} onClick={() => setEditing(question)}>تعديل</button><button className="ui-button ui-button-secondary" type="button" disabled={busy} onClick={() => { if (window.confirm(`حذف السؤال «${question.prompt}»؟`)) void run(() => apiRequest(`/admin/${kind === 'exam' ? 'exam' : 'homework'}-questions/${question.id}`, { method: 'DELETE' })); }}>حذف</button></div><QuestionImageControls kind={kind} question={question} busy={busy} locked={view.attempts.length > 0} run={run} /></li>)}</ul>
      <button className="ui-button" type="button" onClick={() => setEditing('new')} disabled={busy}>إضافة سؤال</button>
      {editing ? <QuestionEditor key={editing === 'new' ? 'new' : editing.id} question={editing === 'new' ? null : editing} position={Math.max(-1, ...questions.map((q) => q.position)) + 1} busy={busy} onClose={() => setEditing(null)} onSave={async (input) => {
        await run(async () => {
          if (editing !== 'new') await data(`/admin/${kind === 'exam' ? 'exam' : 'homework'}-questions/${editing.id}`, json('PATCH', input));
          else if (kind === 'homework') await data(`/admin/homework/${id}/questions`, json('POST', input));
          else {
            const section = assessment.sections?.[0] ?? await data<{ id: string }>(`/admin/exams/${id}/sections`, json('POST', { title: 'الأسئلة', position: 0 }));
            await data(`/admin/exam-sections/${section.id}/questions`, json('POST', input));
          }
          setEditing(null);
        });
      }} /> : null}
    </details>
    <details><summary>المحاولات والمراجعة اليدوية</summary>
      {view.attempts.length ? view.attempts.map((attempt) => <section className="admin-create-panel" key={attempt.id}>
        <h3>{attempt.student.fullName} — المحاولة {attempt.attemptNo}</h3><p>{attempt.status === 'IN_PROGRESS' ? 'قيد الحل' : attempt.passed === true || attempt.result?.passed === true ? 'تم الاجتياز' : attempt.passed === false || attempt.result?.passed === false ? 'لم يتم الاجتياز' : 'قيد المراجعة'}</p><small>المستخدمة: {view.attempts.filter((row) => row.student.id === attempt.student.id).length} · الأساسي: {assessment.maxAttempts} · الإضافي: {view.grants.filter((grant) => grant.studentId === attempt.student.id).reduce((sum, grant) => sum + grant.amount, 0)} · الإجمالي: {assessment.maxAttempts + view.grants.filter((grant) => grant.studentId === attempt.student.id).reduce((sum, grant) => sum + grant.amount, 0)}</small>
        {attempt.status !== 'IN_PROGRESS' && attempt.answers.some((answer) => answer.awardedPoints === null) ? <form className="admin-live-form" onSubmit={(event) => { event.preventDefault(); const manual = attempt.answers.filter((a) => a.awardedPoints === null).map((a) => ({ answerId: a.id, points: Number(marks[a.id]) })); void run(() => data(`/admin/${kind === 'exam' ? 'exam-attempts' : 'homework-submissions'}/${attempt.id}/review`, json('PATCH', { marks: manual, reviewStatus: 'REVIEWED' }))); }}>
          {attempt.answers.filter((answer) => answer.awardedPoints === null).map((answer) => <label key={answer.id}><span dir="auto">{answer.question.prompt}</span><p dir="auto">{answer.textAnswer || 'بدون إجابة'}</p><input aria-label="الدرجة" type="number" step="0.01" min={0} max={Number(answer.question.points ?? 0)} required value={marks[answer.id] ?? ''} onChange={(event) => setMarks((current) => ({ ...current, [answer.id]: event.target.value }))} /></label>)}<button className="ui-button" disabled={busy}>اعتماد المراجعة والنتيجة</button>
        </form> : null}
      </section>) : <p>لا توجد محاولات بعد.</p>}
    </details>
    <details><summary>منح محاولات إضافية لطالب</summary>
      <form className="admin-live-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void run(() => data(`${path}/grants`, json('POST', { studentId: form.get('studentId'), amount: Number(form.get('amount')) })), 'تمت إضافة المحاولات. الاجتياز ما زال مطلوبًا لفتح المحتوى.'); }}>
        <label>الطالب<select name="studentId" required><option value="">اختر الطالب</option>{students.map((student) => <option key={student.id} value={student.id}>{student.fullName}</option>)}</select></label>
        <label>الإضافة<select name="amount"><option value="1">+1 محاولة</option><option value="2">+2 محاولتان</option></select></label><button className="ui-button" disabled={busy}>منح المحاولات</button>
      </form>
      <ul>{view.grants.map((grant) => <li key={grant.id}>{grant.student.fullName} · +{grant.amount} · {new Date(grant.createdAt).toLocaleDateString('ar-EG')}</li>)}</ul>
    </details>
    <details><summary>المحتوى الذي يتطلب اجتياز هذا التقييم</summary>
      <p>الاجتياز يحقق شرط التقدم فقط ولا يمنح اشتراكًا أو تفعيلًا. يجب اختيار محتوى لاحق من نفس الكورس.</p>
      <form className="admin-live-form" onSubmit={(event) => { event.preventDefault(); const [type, targetId] = String(new FormData(event.currentTarget).get('target')).split(':'); void run(() => data(`${path}/dependencies`, json('POST', { [type === 'unit' ? 'unitId' : 'lessonId']: targetId }))); }}>
        <label>المحتوى المستهدف<select name="target" required><option value="">اختر درسًا أو وحدة</option>{targets.map((target) => <option value={target.value} key={target.value}>{target.label}</option>)}</select></label><button className="ui-button" disabled={busy}>حفظ شرط الاجتياز</button>
      </form>
    </details>
  </section>;
}

function QuestionImageControls({ kind, question, busy, locked, run }: { kind: Kind; question: Question; busy: boolean; locked: boolean; run: (action: () => Promise<unknown>, success?: string) => Promise<void> }) {
  const path = `/admin/assessment-questions/${kind}/${question.id}/image`;
  return <details><summary>صورة السؤال (اختيارية)</summary>
    {question.image ? <QuestionImage image={question.image} /> : <p>لا توجد صورة مرفقة. نص السؤال مطلوب كما هو.</p>}
    {locked ? <p>بدأ الطلاب حل هذا التقييم؛ الصورة محفوظة ولا يمكن تغييرها.</p> : <>
      <form className="admin-live-form" onSubmit={(event) => { event.preventDefault(); const body = new FormData(event.currentTarget); void run(() => data(path, { method: 'POST', body }), 'تم حفظ صورة السؤال.'); }}>
        <label>صورة السؤال — PNG / JPEG / WebP، بحد أقصى 5 ميجابايت<input type="file" name="file" accept="image/png,image/jpeg,image/webp" required disabled={busy} /></label>
        <button className="ui-button ui-button-secondary" disabled={busy}>{question.image ? 'استبدال صورة السؤال' : 'إرفاق صورة السؤال'}</button>
      </form>
      {question.image ? <button type="button" className="ui-button ui-button-secondary" disabled={busy} onClick={() => { if (window.confirm(`إزالة صورة السؤال «${question.prompt}»؟`)) void run(() => apiRequest(path, { method: 'DELETE' }), 'تمت إزالة صورة السؤال.'); }}>إزالة صورة السؤال</button> : null}
    </>}
  </details>;
}

function QuestionEditor({ question, position, busy, onClose, onSave }: { question: Question | null; position: number; busy: boolean; onClose: () => void; onSave: (input: Record<string, unknown>) => Promise<void> }) {
  const [type, setType] = useState(question?.type ?? 'SINGLE_CHOICE');
  const [choices, setChoices] = useState<Choice[]>(question?.choices.length ? question.choices : [{ label: '', position: 0, isCorrect: true }, { label: '', position: 1, isCorrect: false }]);
  const choiceType = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(type);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void onSave({ type, prompt: form.get('prompt'), points: Number(form.get('points')), position: Number(form.get('position')), correctText: form.get('correctText') ?? '', choices: choiceType ? choices.map((choice, index) => ({ ...choice, position: index })) : [] });
  }
  return <form className="admin-live-form admin-create-panel" onSubmit={submit}>
    <label>نص السؤال<textarea name="prompt" dir="auto" rows={4} required defaultValue={question?.prompt ?? ''} /></label>
    <label>نوع السؤال<select value={type} onChange={(event) => { setType(event.target.value); if (event.target.value === 'TRUE_FALSE') setChoices([{ label: 'True', position: 0, isCorrect: true }, { label: 'False', position: 1, isCorrect: false }]); }}>{types.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label>الدرجة<input name="points" type="number" min="0.01" step="0.01" max="1000000" required defaultValue={question?.points ?? 1} /></label><label>الترتيب<input name="position" type="number" min={0} required defaultValue={question?.position ?? position} /></label>
    {choiceType ? <fieldset><legend>الاختيارات — حدد الإجابة الصحيحة</legend>{choices.map((choice, index) => <label key={index}><input type={type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'} name="correct" aria-label={`الاختيار الصحيح ${index + 1}`} checked={choice.isCorrect} onChange={() => setChoices((current) => current.map((item, number) => ({ ...item, isCorrect: type === 'MULTIPLE_CHOICE' ? number === index ? !item.isCorrect : item.isCorrect : number === index })))} /><input dir="auto" aria-label={`نص الاختيار ${index + 1}`} value={choice.label} required onChange={(event) => setChoices((current) => current.map((item, number) => number === index ? { ...item, label: event.target.value } : item))} />{type !== 'TRUE_FALSE' && choices.length > 2 ? <button type="button" onClick={() => setChoices((current) => current.filter((_, number) => number !== index))}>إزالة الاختيار</button> : null}</label>)}{type !== 'TRUE_FALSE' ? <button type="button" onClick={() => setChoices((current) => [...current, { label: '', position: current.length, isCorrect: false }])}>إضافة اختيار</button> : null}</fieldset> : type === 'SHORT_TEXT' ? <label>الإجابة المقبولة (مطابقة نصية؛ اتركها فارغة للمراجعة اليدوية)<input name="correctText" dir="auto" defaultValue={question?.correctText ?? ''} /></label> : <p>الإجابة المقالية تحتاج مراجعة يدوية قبل اعتماد الاجتياز.</p>}
    <div className="admin-live-actions"><button className="ui-button" disabled={busy}>حفظ السؤال</button><button type="button" className="ui-button ui-button-secondary" onClick={onClose} disabled={busy}>إلغاء</button></div>
  </form>;
}
