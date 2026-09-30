import { useEffect, useMemo, useState } from 'react';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import { AdminCoursesPage } from '@/pages/admin/AdminCoursesStudio';
import { HomeworkEditor } from '@/components/admin/HomeworkEditor';
import { AssessmentWorkbench } from '@/components/admin/AssessmentWorkbench';
import {
  adminApi,
  type AdminCourse,
  type AdminCourseDetails,
  type AdminExam,
  type AdminHomework,
  type AdminStudent,
  type StageOption,
} from '@/services/admin';

export { AdminCoursesPage };

function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  useDocumentMetadata({
    title: `${title} — إدارة Englishine`,
    description,
    openGraph: [],
    structuredData: [],
  });
  return (
    <header className="admin-page-header">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}

function StatusNote({ message, error = false }: { message: string | null; error?: boolean }) {
  if (!message) return null;
  return (
    <p className="admin-live-status" role={error ? 'alert' : 'status'}>
      {message}
    </p>
  );
}

export function AdminStudentsPage() {
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState('');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const grades = useMemo(() => stages.flatMap((stage) => stage.grades), [stages]);
  const selectedCourse = courses.find((course) => course.id === courseId);
  const filteredStudents = students.filter((student) => {
    const haystack = `${student.fullName} ${student.user.email ?? ''} ${student.user.phone ?? ''}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const reload = () =>
    Promise.all([adminApi.students(), adminApi.courses(), adminApi.grades()]).then(
      ([studentPayload, coursePayload, nextStages]) => {
        setStudents(studentPayload.data);
        setCourses(coursePayload.data);
        setStages(nextStages);
      },
    );

  useEffect(() => {
    void reload().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'تعذر تحميل الطلاب.');
    });
  }, []);

  return (
    <div className="admin-page">
      <PageIntro
        eyebrow="تفعيل الطلاب"
        title="الطلاب وتفعيل الكورس"
        description="ابحث عن الطالب، اختر الكورس، ثم اضغط تفعيل. التفعيل يفتح الدروس المدفوعة في كورساتي."
      />
      <StatusNote message={error} error />
      <StatusNote message={status} />
      <form className="admin-live-form" onSubmit={(event) => event.preventDefault()}>
        <label>
          ابحث عن طالب
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="الاسم أو البريد"
          />
        </label>
        <label>
          الكورس المراد تفعيله
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">اختر كورسًا</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>
      </form>
      <div className="admin-card">
        {filteredStudents.length ? (
          <ul className="admin-live-list">
            {filteredStudents.map((student) => (
              <li key={student.id}>
                <strong>{student.fullName}</strong>
                <small>
                  {student.user.email} · الصف: {student.grade?.nameAr ?? 'بدون صف'} · كورسات مفعّلة:{' '}
                  {student._count.enrollments}
                </small>
                <div className="admin-live-actions">
                  <select
                    defaultValue={student.grade?.id ?? ''}
                    onChange={(event) => {
                      const nextGradeId = event.target.value || null;
                      void adminApi
                        .updateStudentGrade(student.id, nextGradeId)
                        .then(() => {
                          setStatus(`تم تحديث صف ${student.fullName}.`);
                          return reload();
                        })
                        .catch((reason: unknown) => {
                          setError(reason instanceof Error ? reason.message : 'تعذر تحديث الصف.');
                        });
                    }}
                  >
                    <option value="">بدون صف</option>
                    {grades.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.nameAr}
                      </option>
                    ))}
                  </select>
                  <button
                    className="ui-button"
                    type="button"
                    disabled={!courseId || saving}
                    onClick={() => {
                      setSaving(true);
                      setError(null);
                      void adminApi
                        .enroll(student.id, courseId)
                        .then(() => {
                          setStatus(
                            `تم تفعيل «${selectedCourse?.title ?? 'الكورس'}» للطالب ${student.fullName}.`,
                          );
                          return reload();
                        })
                        .catch((reason: unknown) => {
                          setError(reason instanceof Error ? reason.message : 'تعذر التفعيل.');
                        })
                        .finally(() => setSaving(false));
                    }}
                  >
                    {saving ? 'جارٍ التفعيل…' : 'تفعيل هذا الكورس للطالب'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>لا يوجد طلاب مطابقون للبحث.</p>
        )}
      </div>
    </div>
  );
}

export function AdminHomeworkPage() {
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [items, setItems] = useState<AdminHomework[]>([]);
  const [courses, setCourses] = useState<AdminCourseDetails[]>([]);
  const [lessonId, setLessonId] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [editing, setEditing] = useState<AdminHomework | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () =>
    Promise.all([adminApi.homework(), adminApi.courses()]).then(
      async ([homework, coursePayload]) => {
        setItems(homework);
        const details = await Promise.all(
          coursePayload.data.map((course) => adminApi.course(course.id)),
        );
        setCourses(details);
      },
    );

  useEffect(() => {
    void reload().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'تعذر تحميل الواجبات.');
    });
  }, []);

  const lessons = courses.flatMap((course) =>
    course.units.flatMap((unit) =>
      unit.lessons.map((lesson) => ({
        id: lesson.id,
        title: `${course.title} — ${lesson.title}`,
      })),
    ),
  );

  return (
    <div className="admin-page">
      <PageIntro
        eyebrow="الواجبات"
        title="واجبات الدروس"
        description="إنشاء مسودة واجب، مراجعة الأسئلة، ثم النشر للطلاب ضمن المحتوى المفعّل."
      />
      <StatusNote message={error} error />
      <StatusNote message={status} />
      <form
        className="admin-live-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!lessonId || !title.trim()) return;
          void adminApi
            .createHomework({ lessonId, title: title.trim(), instructions: instructions.trim(), status: 'DRAFT' })
            .then(() => {
              setTitle('');
              setInstructions('');
              setStatus('تم إنشاء الواجب.');
              return reload();
            })
            .catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : 'تعذر إنشاء الواجب.');
            });
        }}
      >
        <label>
          الدرس
          <select value={lessonId} onChange={(event) => setLessonId(event.target.value)} required>
            <option value="">اختر درسًا</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          عنوان الواجب
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>
          شرح الواجب
          <textarea rows={4} value={instructions} onChange={(event) => setInstructions(event.target.value)} />
        </label>
        <button className="ui-button" type="submit">
          إنشاء مسودة واجب
        </button>
      </form>
      <section className="admin-card">
        {items.length ? (
          <ul className="admin-live-list">
            {items.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <small>{item.instructions || 'بدون شرح بعد'}</small>
                <small>
                  {item.lesson.title} · {item.status} · أسئلة: {item._count.questions}
                </small>
                <button className="ui-button ui-button-secondary" type="button" onClick={() => setEditing(item)}>تعديل الواجب والغلاف</button>
                <button className="ui-button ui-button-secondary" type="button" onClick={() => setAssessmentId(item.id)}>الأسئلة والمحاولات والنشر</button>
              </li>
            ))}
          </ul>
        ) : (
          <p>لا توجد واجبات بعد.</p>
        )}
      </section>
      {editing ? <HomeworkEditor key={editing.id} item={editing} onClose={() => setEditing(null)} onChanged={reload} /> : null}
      {assessmentId ? <AssessmentWorkbench key={assessmentId} kind="homework" id={assessmentId} onChanged={reload} onClose={() => setAssessmentId(null)} /> : null}
    </div>
  );
}

export function AdminExamsPage() {
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [items, setItems] = useState<AdminExam[]>([]);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () =>
    Promise.all([adminApi.exams(), adminApi.courses()]).then(([exams, coursePayload]) => {
      setItems(exams);
      setCourses(coursePayload.data);
    });

  useEffect(() => {
    void reload().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'تعذر تحميل الاختبارات.');
    });
  }, []);

  return (
    <div className="admin-page">
      <PageIntro
        eyebrow="الاختبارات"
        title="اختبارات الكورسات"
        description="إنشاء مسودة اختبار، مراجعة الأسئلة، ثم نشر التقييم ومتابعة المحاولات."
      />
      <StatusNote message={error} error />
      <StatusNote message={status} />
      <form
        className="admin-live-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!courseId || !title.trim()) return;
          void adminApi
            .createExam({ courseId, title: title.trim(), status: 'DRAFT' })
            .then(() => {
              setTitle('');
              setStatus('تم إنشاء الاختبار.');
              return reload();
            })
            .catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : 'تعذر إنشاء الاختبار.');
            });
        }}
      >
        <label>
          الكورس
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)} required>
            <option value="">اختر كورسًا</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          عنوان الاختبار
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <button className="ui-button" type="submit">
          إنشاء مسودة اختبار
        </button>
      </form>
      <section className="admin-card">
        {items.length ? (
          <ul className="admin-live-list">
            {items.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <small>
                  {item.course?.title ?? 'كورس'} · {item.status}
                </small>
                <button className="ui-button ui-button-secondary" type="button" onClick={() => setAssessmentId(item.id)}>إعداد الأسئلة والمحاولات والنشر</button>
              </li>
            ))}
          </ul>
        ) : (
          <p>لا توجد اختبارات بعد.</p>
        )}
      </section>
      {assessmentId ? <AssessmentWorkbench key={assessmentId} kind="exam" id={assessmentId} onChanged={reload} onClose={() => setAssessmentId(null)} /> : null}
    </div>
  );
}

export const AdminUnitsPage = AdminCoursesPage;
export const AdminLessonsPage = AdminCoursesPage;
