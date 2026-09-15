import { useEffect, useMemo, useState } from 'react';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import {
  adminApi,
  type AdminCourse,
  type AdminCourseDetails,
  type AdminExam,
  type AdminHomework,
  type AdminLesson,
  type AdminStudent,
  type StageOption,
} from '@/services/admin';

function slugify(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `course-${Date.now()}`;
}

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

function accessLabel(level: string) {
  if (level === 'FREE') return 'مجاني';
  if (level === 'PREVIEW') return 'معاينة مجانية';
  if (level === 'ENROLLED') return 'مدفوع — يحتاج تفعيل';
  return 'مغلق';
}

function publishLabel(status: string) {
  if (status === 'PUBLISHED') return 'منشور';
  if (status === 'DRAFT') return 'مسودة';
  if (status === 'PRIVATE') return 'خاص';
  if (status === 'ARCHIVED') return 'مؤرشف';
  if (status === 'READY') return 'جاهز';
  if (status === 'COMING_SOON') return 'قريبًا';
  return status;
}

export function AdminCoursesPage() {
  const [stages, setStages] = useState<StageOption[]>([]);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [details, setDetails] = useState<AdminCourseDetails | null>(null);
  const [lessonDetails, setLessonDetails] = useState<AdminLesson | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [accessLevel, setAccessLevel] = useState('ENROLLED');
  const [courseStatus, setCourseStatus] = useState('PUBLISHED');
  const [unitTitle, setUnitTitle] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonAccess, setLessonAccess] = useState('ENROLLED');
  const [videoTitle, setVideoTitle] = useState('فيديو الدرس');
  const [videoAccess, setVideoAccess] = useState('ENROLLED');
  const [videoType, setVideoType] = useState('EXPLANATION');

  const reloadCourses = () =>
    adminApi.courses().then((payload) => setCourses(payload.data));
  const reloadDetails = (id: string) =>
    adminApi.course(id).then((course) => {
      setDetails(course);
      setLessonDetails(null);
    });

  useEffect(() => {
    void Promise.all([adminApi.grades(), reloadCourses()])
      .then(([nextStages]) => {
        setStages(nextStages);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'تعذر تحميل بيانات الإدارة.');
      })
      .finally(() => setLoading(false));
  }, []);

  const grades = useMemo(() => stages.flatMap((stage) => stage.grades), [stages]);

  const run = async (work: () => Promise<void>, success: string) => {
    setError(null);
    setStatus(null);
    setSaving(true);
    try {
      await work();
      setStatus(success);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'تعذر تنفيذ العملية.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <PageIntro
        eyebrow="نشر المحتوى"
        title="الكورسات والدروس"
        description="اتبع الخطوات بالترتيب: كورس ← صف ← وحدة ← درس ← فيديو أو PDF ← مجاني أو مدفوع ← نشر. ثم فعّل الطلاب من صفحة الطلاب."
      />
      <StatusNote message={error} error />
      <StatusNote message={status} />
      {loading ? <p className="admin-live-status">جارٍ تحميل الكورسات…</p> : null}
      <p className="admin-publish-step">1) الكورس والصف وحالة النشر</p>
      <form
        className="admin-live-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          void run(async () => {
            const course = await adminApi.createCourse({
              title: title.trim(),
              slug: `${slugify(title)}-${Date.now()}`,
              gradeId: gradeId || undefined,
              status: courseStatus as AdminCourse['status'],
              accessLevel: accessLevel as AdminCourse['accessLevel'],
            });
            setTitle('');
            await reloadCourses();
            await reloadDetails(course.id);
          }, courseStatus === 'PUBLISHED' ? 'تم حفظ الكورس ونشره.' : 'تم حفظ الكورس كمسودة.');
        }}
      >
        <label>
          اسم الكورس
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="مثال: تأسيس أولى إعدادي"
            required
          />
        </label>
        <label>
          الصف الدراسي
          <select value={gradeId} onChange={(event) => setGradeId(event.target.value)}>
            <option value="">بدون صف محدد</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.nameAr}
              </option>
            ))}
          </select>
        </label>
        <label>
          نوع الوصول
          <select value={accessLevel} onChange={(event) => setAccessLevel(event.target.value)}>
            <option value="ENROLLED">مدفوع — يحتاج تفعيل الطالب</option>
            <option value="FREE">مجاني لكل الطلاب المسجلين</option>
            <option value="PREVIEW">معاينة مجانية</option>
          </select>
        </label>
        <label>
          حالة الكورس
          <select value={courseStatus} onChange={(event) => setCourseStatus(event.target.value)}>
            <option value="PUBLISHED">منشور (يظهر للطلاب)</option>
            <option value="DRAFT">مسودة (مخفي عن الطلاب)</option>
          </select>
        </label>
        <button className="ui-button" type="submit" disabled={saving}>
          {saving ? 'جارٍ الحفظ…' : 'حفظ الكورس'}
        </button>
      </form>

      <div className="admin-live-split">
        <section className="admin-card">
          <h2>الكورسات</h2>
          {courses.length ? (
            <ul className="admin-live-list">
              {courses.map((course) => (
                <li key={course.id}>
                  <button
                    type="button"
                    onClick={() => {
                      void reloadDetails(course.id).catch((reason: unknown) => {
                        setError(reason instanceof Error ? reason.message : 'تعذر فتح الكورس.');
                      });
                    }}
                  >
                    <strong>{course.title}</strong>
                    <small>
                      {course.grade?.nameAr ?? 'بدون صف'} · {publishLabel(course.status)} ·{' '}
                      {accessLabel(course.accessLevel)}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>لا توجد كورسات بعد.</p>
          )}
        </section>

        {details ? (
          <section className="admin-card">
            <h2>{details.title}</h2>
            <p>
              الصف: {details.grade?.nameAr ?? 'بدون صف'} · الحالة: {publishLabel(details.status)} ·
              الوصول: {accessLabel(details.accessLevel)}
            </p>
            <div className="admin-live-actions">
              <button
                className="ui-button"
                type="button"
                disabled={saving}
                onClick={() =>
                  void run(async () => {
                    await adminApi.updateCourse(details.id, { status: 'PUBLISHED' });
                    await reloadDetails(details.id);
                    await reloadCourses();
                  }, 'تم نشر الكورس. يظهر للطلاب الآن.')
                }
              >
                نشر الكورس
              </button>
              <button
                className="ui-button ui-button-secondary"
                type="button"
                disabled={saving}
                onClick={() =>
                  void run(async () => {
                    await adminApi.updateCourse(details.id, { status: 'DRAFT' });
                    await reloadDetails(details.id);
                    await reloadCourses();
                  }, 'تم تحويل الكورس إلى مسودة. لن يظهر للطلاب.')
                }
              >
                إلغاء النشر (مسودة)
              </button>
              <button
                className="ui-button ui-button-secondary"
                type="button"
                disabled={saving}
                onClick={() =>
                  void run(async () => {
                    await adminApi.updateCourse(details.id, { accessLevel: 'FREE' });
                    await reloadDetails(details.id);
                    await reloadCourses();
                  }, 'تم جعل الكورس مجانيًا.')
                }
              >
                كورس مجاني
              </button>
              <button
                className="ui-button ui-button-secondary"
                type="button"
                disabled={saving}
                onClick={() =>
                  void run(async () => {
                    await adminApi.updateCourse(details.id, { accessLevel: 'ENROLLED' });
                    await reloadDetails(details.id);
                    await reloadCourses();
                  }, 'تم جعل الكورس مدفوعًا. يحتاج تفعيل الطالب.')
                }
              >
                كورس مدفوع
              </button>
            </div>
            <p className="admin-publish-step">2) الوحدة داخل الكورس</p>
            <form
              className="admin-live-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!unitTitle.trim()) return;
                void run(async () => {
                  await adminApi.createUnit(details.id, {
                    title: unitTitle.trim(),
                    position: details.units.length,
                    status: 'PUBLISHED',
                  });
                  setUnitTitle('');
                  await reloadDetails(details.id);
                }, 'تمت إضافة الوحدة.');
              }}
            >
              <label>
                اسم الوحدة
                <input
                  value={unitTitle}
                  onChange={(event) => setUnitTitle(event.target.value)}
                  placeholder="مثال: الوحدة الأولى"
                />
              </label>
              <button className="ui-button" type="submit" disabled={saving}>
                {saving ? 'جارٍ الحفظ…' : 'إضافة وحدة'}
              </button>
            </form>
            {details.units.map((unit) => (
              <article className="admin-live-unit" key={unit.id}>
                <h3>
                  {unit.title} <small>{publishLabel(unit.status)}</small>
                </h3>
                <p className="admin-publish-step">3) الدرس: مجاني أو مدفوع</p>
                <form
                  className="admin-live-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!lessonTitle.trim()) return;
                    void run(async () => {
                      await adminApi.createLesson(unit.id, {
                        title: lessonTitle.trim(),
                        position: unit.lessons.length,
                        status: 'PUBLISHED',
                        accessLevel: lessonAccess,
                      });
                      setLessonTitle('');
                      await reloadDetails(details.id);
                    }, 'تمت إضافة الدرس.');
                  }}
                >
                  <label>
                    اسم الدرس
                    <input
                      value={lessonTitle}
                      onChange={(event) => setLessonTitle(event.target.value)}
                      placeholder="مثال: الحصة الأولى"
                    />
                  </label>
                  <label>
                    وصول الدرس
                    <select
                      value={lessonAccess}
                      onChange={(event) => setLessonAccess(event.target.value)}
                    >
                      <option value="ENROLLED">مدفوع — يحتاج تفعيل</option>
                      <option value="FREE">مجاني</option>
                      <option value="PREVIEW">معاينة مجانية</option>
                    </select>
                  </label>
                  <button className="ui-button" type="submit" disabled={saving}>
                    {saving ? 'جارٍ الحفظ…' : 'إضافة درس'}
                  </button>
                </form>
                {unit.lessons.map((lesson) => (
                  <div className="admin-live-lesson" key={lesson.id}>
                    <button
                      type="button"
                      onClick={() =>
                        void adminApi.lesson(lesson.id).then(setLessonDetails, (reason: unknown) => {
                          setError(reason instanceof Error ? reason.message : 'تعذر فتح الدرس.');
                        })
                      }
                    >
                      {lesson.title} · {accessLabel(lesson.accessLevel)} · {publishLabel(lesson.status)}
                    </button>
                    <button
                      className="ui-button ui-button-secondary"
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void run(async () => {
                          await adminApi.updateLesson(lesson.id, { accessLevel: 'FREE' });
                          await reloadDetails(details.id);
                        }, 'تم تعيين الدرس كمجاني.')
                      }
                    >
                      مجاني
                    </button>
                    <button
                      className="ui-button ui-button-secondary"
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void run(async () => {
                          await adminApi.updateLesson(lesson.id, { accessLevel: 'ENROLLED' });
                          await reloadDetails(details.id);
                        }, 'تم تعيين الدرس كمدفوع.')
                      }
                    >
                      مدفوع
                    </button>
                  </div>
                ))}
              </article>
            ))}
            {lessonDetails ? (
              <section className="admin-live-unit">
                <p className="admin-publish-step">4) فيديو الدرس وملف PDF</p>
                <h3>ملفات: {lessonDetails.title}</h3>
                <p>
                  فيديو: {lessonDetails.videos?.length ?? 0} · مادة PDF:{' '}
                  {lessonDetails.resources?.length ?? 0}
                </p>
                <form
                  className="admin-live-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const file = (form.elements.namedItem('video') as HTMLInputElement).files?.[0];
                    if (!file) {
                      setError('اختر ملف فيديو MP4 أولاً.');
                      return;
                    }
                    void run(async () => {
                      await adminApi.uploadVideo(lessonDetails.id, file, {
                        title: videoTitle.trim() || file.name,
                        type: videoType,
                        accessLevel: videoAccess,
                        status: 'PUBLISHED',
                        position: lessonDetails.videos?.length ?? 0,
                      });
                      setLessonDetails(await adminApi.lesson(lessonDetails.id));
                      form.reset();
                    }, 'تم رفع الفيديو.');
                  }}
                >
                  <label>
                    عنوان الفيديو
                    <input
                      value={videoTitle}
                      onChange={(event) => setVideoTitle(event.target.value)}
                    />
                  </label>
                  <label>
                    نوع الفيديو
                    <select value={videoType} onChange={(event) => setVideoType(event.target.value)}>
                      <option value="EXPLANATION">شرح</option>
                      <option value="FREE_REEL">ريل مجاني</option>
                      <option value="REVISION">مراجعة</option>
                    </select>
                  </label>
                  <label>
                    وصول الفيديو
                    <select
                      value={videoAccess}
                      onChange={(event) => setVideoAccess(event.target.value)}
                    >
                      <option value="ENROLLED">مدفوع — يحتاج تفعيل</option>
                      <option value="FREE">مجاني</option>
                      <option value="PREVIEW">معاينة مجانية</option>
                    </select>
                  </label>
                  <label>
                    ملف الفيديو (MP4)
                    <input name="video" type="file" accept="video/mp4,video/webm,video/quicktime" />
                  </label>
                  <button className="ui-button" type="submit" disabled={saving}>
                    {saving ? 'جارٍ الرفع…' : 'رفع فيديو'}
                  </button>
                </form>
                <form
                  className="admin-live-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const file = (form.elements.namedItem('pdf') as HTMLInputElement).files?.[0];
                    if (!file) {
                      setError('اختر ملف PDF أولاً.');
                      return;
                    }
                    void run(async () => {
                      await adminApi.uploadResource(lessonDetails.id, file, file.name);
                      setLessonDetails(await adminApi.lesson(lessonDetails.id));
                      form.reset();
                    }, 'تم رفع ملف PDF.');
                  }}
                >
                  <label>
                    ملف المادة (PDF)
                    <input name="pdf" type="file" accept="application/pdf" />
                  </label>
                  <button className="ui-button" type="submit" disabled={saving}>
                    {saving ? 'جارٍ الرفع…' : 'رفع PDF'}
                  </button>
                </form>
                {(lessonDetails.videos ?? []).map((video) => (
                  <div className="admin-live-lesson" key={video.id}>
                    <span>
                      فيديو: {video.title} · {accessLabel(video.accessLevel)}
                    </span>
                    <button
                      className="ui-button ui-button-secondary"
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void run(async () => {
                          await adminApi.updateVideo(video.id, { accessLevel: 'FREE' });
                          setLessonDetails(await adminApi.lesson(lessonDetails.id));
                        }, 'تم تعيين الفيديو كمجاني.')
                      }
                    >
                      فيديو مجاني
                    </button>
                  </div>
                ))}
                {(lessonDetails.resources ?? []).map((resource) => (
                  <div className="admin-live-lesson" key={resource.id}>
                    <span>مادة: {resource.title}</span>
                  </div>
                ))}
              </section>
            ) : null}
          </section>
        ) : (
          <section className="admin-card">
            <p>اختر كورسًا من القائمة لإضافة وحدة ثم درس ثم فيديو أو PDF.</p>
          </section>
        )}
      </div>
    </div>
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
    const haystack = `${student.fullName} ${student.user.email}`.toLowerCase();
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
  const [items, setItems] = useState<AdminHomework[]>([]);
  const [courses, setCourses] = useState<AdminCourseDetails[]>([]);
  const [lessonId, setLessonId] = useState('');
  const [title, setTitle] = useState('');
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
        description="إنشاء واجب منشور مرتبط بدرس. يظهر للطلاب بعد تفعيل الكورس فقط."
      />
      <StatusNote message={error} error />
      <StatusNote message={status} />
      <form
        className="admin-live-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!lessonId || !title.trim()) return;
          void adminApi
            .createHomework({ lessonId, title: title.trim(), status: 'PUBLISHED' })
            .then(() => {
              setTitle('');
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
        <button className="ui-button" type="submit">
          إنشاء واجب منشور
        </button>
      </form>
      <section className="admin-card">
        {items.length ? (
          <ul className="admin-live-list">
            {items.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <small>
                  {item.lesson.title} · {item.status} · أسئلة: {item._count.questions}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p>لا توجد واجبات بعد.</p>
        )}
      </section>
    </div>
  );
}

export function AdminExamsPage() {
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
        description="إنشاء اختبار منشور مرتبط بكورس. يظهر للطلاب بعد تفعيل الكورس فقط."
      />
      <StatusNote message={error} error />
      <StatusNote message={status} />
      <form
        className="admin-live-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!courseId || !title.trim()) return;
          void adminApi
            .createExam({ courseId, title: title.trim(), status: 'PUBLISHED' })
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
          إنشاء اختبار منشور
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
              </li>
            ))}
          </ul>
        ) : (
          <p>لا توجد اختبارات بعد.</p>
        )}
      </section>
    </div>
  );
}

export const AdminUnitsPage = AdminCoursesPage;
export const AdminLessonsPage = AdminCoursesPage;
