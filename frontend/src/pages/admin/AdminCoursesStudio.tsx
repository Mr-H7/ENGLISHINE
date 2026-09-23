import { useEffect, useMemo, useState } from 'react';
import { useBlocker } from 'react-router';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import { ContentStudioEditor, type StudioTarget } from '@/components/admin/ContentStudioActions';
import {
  adminApi,
  type AdminCourse,
  type AdminCourseDetails,
  type AdminLesson,
  type StageOption,
  type UploadPhase,
  type UploadProgressEvent,
} from '@/services/admin';

function slugify(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `course-${Date.now()}`;
}

function accessLabel(level: string) {
  if (level === 'FREE') return 'مجاني';
  if (level === 'PREVIEW') return 'معاينة';
  if (level === 'ENROLLED') return 'مدفوع';
  return 'مغلق';
}

function publishLabel(status: string) {
  if (status === 'PUBLISHED') return 'منشور';
  if (status === 'DRAFT') return 'مسودة';
  if (status === 'PRIVATE') return 'خاص';
  if (status === 'ARCHIVED') return 'مؤرشف';
  return status;
}

function accessTone(level: string) {
  return level === 'FREE' || level === 'PREVIEW' ? 'free' : 'paid';
}

function publishTone(status: string) {
  return status === 'PUBLISHED' ? 'published' : 'draft';
}

function formatMegabytes(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function phaseLabel(phase: UploadPhase) {
  if (phase === 'preparing') return 'جارٍ التحضير';
  if (phase === 'uploading') return 'جارٍ الرفع';
  if (phase === 'finalizing') return 'جارٍ الإنهاء';
  if (phase === 'complete') return 'اكتمل';
  if (phase === 'failed') return 'فشل الرفع';
  return '';
}

function StatusNote({ message, error = false }: { message: string | null; error?: boolean }) {
  if (!message) return null;
  return (
    <p className="admin-live-status" role={error ? 'alert' : 'status'}>
      {message}
    </p>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: 'published' | 'draft' | 'free' | 'paid' }) {
  return (
    <span className="admin-status-badge" data-tone={tone}>
      {label}
    </span>
  );
}

function UploadMeter({ progress }: { progress: UploadProgressEvent | null }) {
  if (!progress || progress.phase === 'idle') return null;
  const percent =
    progress.total > 0 ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0;
  return (
    <div
      className="admin-upload-meter"
      data-phase={progress.phase}
      role="status"
      aria-live="polite"
    >
      <div className="admin-upload-meter-copy">
        <strong>{phaseLabel(progress.phase)}</strong>
        <span>
          {formatMegabytes(progress.loaded)} / {formatMegabytes(progress.total)} م.ب · {percent}%
        </span>
      </div>
      <progress value={percent} max={100} />
    </div>
  );
}

export function AdminCoursesPage() {
  const [stages, setStages] = useState<StageOption[]>([]);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [details, setDetails] = useState<AdminCourseDetails | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [lessonDetails, setLessonDetails] = useState<AdminLesson | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [creatingUnit, setCreatingUnit] = useState(false);
  const [creatingLesson, setCreatingLesson] = useState(false);
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
  const [upload, setUpload] = useState<UploadProgressEvent | null>(null);
  const [editor, setEditor] = useState<StudioTarget | null>(null);

  useDocumentMetadata({
    title: 'الكورسات والدروس — إدارة Englishine',
    description: 'إدارة الكورسات والوحدات والدروس وملفات الشرح.',
    openGraph: [],
    structuredData: [],
  });

  const uploading =
    upload?.phase === 'preparing' || upload?.phase === 'uploading' || upload?.phase === 'finalizing';
  const blocker = useBlocker(uploading);
  const grades = useMemo(() => stages.flatMap((stage) => stage.grades), [stages]);
  const selectedUnit = details?.units.find((unit) => unit.id === selectedUnitId) ?? null;

  const reloadCourses = () => adminApi.courses().then((payload) => setCourses(payload.data));
  const refreshCourse = (id: string, unitId?: string | null) =>
    adminApi.course(id).then((course) => {
      setDetails(course);
      if (unitId !== undefined) setSelectedUnitId(unitId);
    });
  const openCourse = (id: string) =>
    refreshCourse(id, null).then(() => {
      setLessonDetails(null);
      setCreatingUnit(false);
      setCreatingLesson(false);
    });

  useEffect(() => {
    void Promise.all([adminApi.grades(), reloadCourses()])
      .then(([nextStages]) => setStages(nextStages))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'تعذر تحميل بيانات الإدارة.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!uploading) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [uploading]);

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
    <div className="admin-page admin-studio">
      <header className="admin-page-header">
        <div>
          <span>إدارة المحتوى</span>
          <h1>الكورسات</h1>
          <p>اختر كورسًا، ثم وحدة، ثم درسًا. أضف الفيديو أو ملف PDF من مساحة الدرس فقط.</p>
        </div>
        <button
          className="ui-button"
          type="button"
          onClick={() => setCreatingCourse((open) => !open)}
        >
          إضافة كورس
        </button>
      </header>
      <StatusNote message={error} error />
      <StatusNote message={status} />
      {blocker.state === 'blocked' ? (
        <div className="admin-leave-warning" role="alertdialog" aria-labelledby="leave-upload-title">
          <strong id="leave-upload-title">الرفع ما زال جاريًا</strong>
          <p>المغادرة الآن قد تقطع رفع الملف. انتظر حتى يكتمل أو أكّد المغادرة.</p>
          <div className="admin-live-actions">
            <button className="ui-button" type="button" onClick={() => blocker.reset()}>
              البقاء في الصفحة
            </button>
            <button className="ui-button ui-button-secondary" type="button" onClick={() => blocker.proceed()}>
              المغادرة
            </button>
          </div>
        </div>
      ) : null}
      {creatingCourse ? (
        <form
          className="admin-create-panel"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim() || saving) return;
            void run(async () => {
              const course = await adminApi.createCourse({
                title: title.trim(),
                slug: `${slugify(title)}-${Date.now()}`,
                gradeId: gradeId || undefined,
                status: courseStatus as AdminCourse['status'],
                accessLevel: accessLevel as AdminCourse['accessLevel'],
              });
              setTitle('');
              setCreatingCourse(false);
              await reloadCourses();
              await openCourse(course.id);
            }, courseStatus === 'PUBLISHED' ? 'تم حفظ الكورس ونشره.' : 'تم حفظ الكورس كمسودة.');
          }}
        >
          <h2>كورس جديد</h2>
          <div className="admin-live-form">
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
                <option value="ENROLLED">مدفوع — يحتاج تفعيل</option>
                <option value="FREE">مجاني</option>
                <option value="PREVIEW">معاينة مجانية</option>
              </select>
            </label>
            <label>
              الحالة
              <select value={courseStatus} onChange={(event) => setCourseStatus(event.target.value)}>
                <option value="PUBLISHED">منشور</option>
                <option value="DRAFT">مسودة</option>
              </select>
            </label>
            <button className="ui-button" type="submit" disabled={saving}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ الكورس'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="admin-studio-grid">
        <section className="admin-card admin-course-rail">
          <h2>الكورسات</h2>
          {loading ? <p>جارٍ تحميل الكورسات…</p> : null}
          {courses.length ? (
            <ul className="admin-live-list">
              {courses.map((course) => (
                <li key={course.id}>
                  <button
                    type="button"
                    className="admin-select-row"
                    data-selected={details?.id === course.id}
                    onClick={() => {
                      void openCourse(course.id).catch((reason: unknown) => {
                        setError(reason instanceof Error ? reason.message : 'تعذر فتح الكورس.');
                      });
                    }}
                  >
                    <strong>{course.title}</strong>
                    <small>
                      {course.grade?.nameAr ?? 'بدون صف'} · {course._count.units} وحدات
                    </small>
                    <span className="admin-badge-row">
                      <StatusBadge label={publishLabel(course.status)} tone={publishTone(course.status)} />
                      <StatusBadge label={accessLabel(course.accessLevel)} tone={accessTone(course.accessLevel)} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : loading ? null : (
            <p>لا توجد كورسات بعد. ابدأ بإضافة كورس.</p>
          )}
        </section>

        <section className="admin-card admin-workspace">
          {!details ? (
            <p>اختر كورسًا لإدارة وحداته ودروسه.</p>
          ) : (
            <>
              <header className="admin-workspace-head">
                <div>
                  <h2>{details.title}</h2>
                  <p>
                    {details.grade?.nameAr ?? 'بدون صف'} · {details.units.length} وحدات
                  </p>
                  <span className="admin-badge-row">
                    <StatusBadge label={publishLabel(details.status)} tone={publishTone(details.status)} />
                    <StatusBadge
                      label={accessLabel(details.accessLevel)}
                      tone={accessTone(details.accessLevel)}
                    />
                  </span>
                </div>
                  <button className="ui-button ui-button-secondary" type="button" onClick={() => setEditor({ kind: 'course', record: details })}>تعديل الدورة</button>
                <div className="admin-live-actions">
                  <button
                    className="ui-button"
                    type="button"
                    disabled={saving || details.status === 'PUBLISHED'}
                    onClick={() =>
                      void run(async () => {
                        await adminApi.updateCourse(details.id, { status: 'PUBLISHED' });
                        await refreshCourse(details.id, selectedUnitId);
                        await reloadCourses();
                      }, 'تم نشر الكورس.')
                    }
                  >
                    نشر
                  </button>
                  <button
                    className="ui-button ui-button-secondary"
                    type="button"
                    disabled={saving || details.status === 'DRAFT'}
                    onClick={() =>
                      void run(async () => {
                        await adminApi.updateCourse(details.id, { status: 'DRAFT' });
                        await refreshCourse(details.id, selectedUnitId);
                        await reloadCourses();
                      }, 'تم تحويل الكورس إلى مسودة.')
                    }
                  >
                    مسودة
                  </button>
                  <button
                    className="ui-button ui-button-secondary"
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void run(async () => {
                        const next = details.accessLevel === 'FREE' ? 'ENROLLED' : 'FREE';
                        await adminApi.updateCourse(details.id, { accessLevel: next });
                        await refreshCourse(details.id, selectedUnitId);
                        await reloadCourses();
                      }, details.accessLevel === 'FREE' ? 'تم جعل الكورس مدفوعًا.' : 'تم جعل الكورس مجانيًا.')
                    }
                  >
                    {details.accessLevel === 'FREE' ? 'تحويل لمدفوع' : 'تحويل لمجاني'}
                  </button>
                  <button
                    className="ui-button"
                    type="button"
                    onClick={() => setCreatingUnit((open) => !open)}
                  >
                    إضافة وحدة
                  </button>
                </div>
              </header>

              {creatingUnit ? (
                <form
                  className="admin-create-panel"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!unitTitle.trim() || saving) return;
                    void run(async () => {
                      await adminApi.createUnit(details.id, {
                        title: unitTitle.trim(),
                        position: details.units.length,
                        status: 'PUBLISHED',
                      });
                      setUnitTitle('');
                      setCreatingUnit(false);
                      await refreshCourse(details.id, selectedUnitId);
                    }, 'تمت إضافة الوحدة.');
                  }}
                >
                  <label>
                    اسم الوحدة
                    <input
                      value={unitTitle}
                      onChange={(event) => setUnitTitle(event.target.value)}
                      placeholder="مثال: الوحدة الأولى"
                      required
                    />
                  </label>
                  <button className="ui-button" type="submit" disabled={saving}>
                    حفظ الوحدة
                  </button>
                </form>
              ) : null}

              <div className="admin-workspace-split">
                <div>
                  <h3>الوحدات</h3>
                  {details.units.length ? (
                    <ul className="admin-live-list">
                      {details.units.map((unit) => (
                        <li key={unit.id}>
                          <button
                            type="button"
                            className="admin-select-row"
                            data-selected={selectedUnitId === unit.id}
                            onClick={() => {
                              setSelectedUnitId(unit.id);
                              setLessonDetails(null);
                              setCreatingLesson(false);
                            }}
                          >
                            <strong>{unit.title}</strong>
                            <small>{unit.lessons.length} دروس</small>
                            <StatusBadge label={publishLabel(unit.status)} tone={publishTone(unit.status)} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>لا توجد وحدات. أضف وحدة للبدء.</p>
                  )}
                </div>

                <div>
                  {!selectedUnit ? (
                    <p>اختر وحدة لعرض دروسها.</p>
                  ) : (
                    <>
                        <button className="ui-button ui-button-secondary" type="button" onClick={() => setEditor({ kind: 'unit', record: selectedUnit })}>تعديل الوحدة والوصول والغلاف</button>
                      <div className="admin-workspace-head">
                        <h3>{selectedUnit.title}</h3>
                        <button
                          className="ui-button"
                          type="button"
                          onClick={() => setCreatingLesson((open) => !open)}
                        >
                          إضافة درس
                        </button>
                      </div>
                      {creatingLesson ? (
                        <form
                          className="admin-create-panel"
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (!lessonTitle.trim() || saving) return;
                            void run(async () => {
                              const created = await adminApi.createLesson(selectedUnit.id, {
                                title: lessonTitle.trim(),
                                position: selectedUnit.lessons.length,
                                status: 'PUBLISHED',
                                accessLevel: lessonAccess,
                              });
                              setLessonTitle('');
                              setCreatingLesson(false);
                              await refreshCourse(details.id, selectedUnit.id);
                              const record = created as { id?: string } | undefined;
                              if (record?.id) {
                                setLessonDetails(await adminApi.lesson(record.id));
                              }
                            }, 'تمت إضافة الدرس.');
                          }}
                        >
                          <label>
                            اسم الدرس
                            <input
                              value={lessonTitle}
                              onChange={(event) => setLessonTitle(event.target.value)}
                              placeholder="مثال: الحصة الأولى"
                              required
                            />
                          </label>
                          <label>
                            وصول الدرس
                            <select
                              value={lessonAccess}
                              onChange={(event) => setLessonAccess(event.target.value)}
                            >
                              <option value="ENROLLED">مدفوع</option>
                              <option value="FREE">مجاني</option>
                              <option value="PREVIEW">معاينة مجانية</option>
                            </select>
                          </label>
                          <button className="ui-button" type="submit" disabled={saving}>
                            حفظ الدرس
                          </button>
                        </form>
                      ) : null}
                      {selectedUnit.lessons.length ? (
                        <ul className="admin-live-list">
                          {selectedUnit.lessons.map((lesson) => (
                            <li key={lesson.id}>
                              <button
                                type="button"
                                className="admin-select-row"
                                data-selected={lessonDetails?.id === lesson.id}
                                onClick={() => {
                                  void adminApi.lesson(lesson.id).then(setLessonDetails, (reason: unknown) => {
                                    setError(reason instanceof Error ? reason.message : 'تعذر فتح الدرس.');
                                  });
                                }}
                              >
                                <strong>{lesson.title}</strong>
                                <span className="admin-badge-row">
                                  <StatusBadge
                                    label={publishLabel(lesson.status)}
                                    tone={publishTone(lesson.status)}
                                  />
                                  <StatusBadge
                                    label={accessLabel(lesson.accessLevel)}
                                    tone={accessTone(lesson.accessLevel)}
                                  />
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>لا توجد دروس في هذه الوحدة.</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {lessonDetails ? (
                <section className="admin-lesson-workspace">
                  <header className="admin-workspace-head">
                    <div>
                      <h3>{lessonDetails.title}</h3>
                      <span className="admin-badge-row">
                        <StatusBadge
                          label={publishLabel(lessonDetails.status)}
                          tone={publishTone(lessonDetails.status)}
                        />
                        <StatusBadge
                          label={accessLabel(lessonDetails.accessLevel)}
                          tone={accessTone(lessonDetails.accessLevel)}
                        />
                      </span>
                    </div>
                      <button className="ui-button ui-button-secondary" type="button" onClick={() => setEditor({ kind: 'lesson', record: lessonDetails })}>تعديل الدرس والتفعيل</button>
                    <div className="admin-live-actions">
                      <button
                        className="ui-button"
                        type="button"
                        disabled={saving || uploading || lessonDetails.status === 'PUBLISHED'}
                        onClick={() =>
                          void run(async () => {
                            await adminApi.updateLesson(lessonDetails.id, { status: 'PUBLISHED' });
                            await refreshCourse(details.id, selectedUnitId);
                            setLessonDetails(await adminApi.lesson(lessonDetails.id));
                          }, 'تم نشر الدرس.')
                        }
                      >
                        نشر
                      </button>
                      <button
                        className="ui-button ui-button-secondary"
                        type="button"
                        disabled={saving || uploading || lessonDetails.status === 'DRAFT'}
                        onClick={() =>
                          void run(async () => {
                            await adminApi.updateLesson(lessonDetails.id, { status: 'DRAFT' });
                            await refreshCourse(details.id, selectedUnitId);
                            setLessonDetails(await adminApi.lesson(lessonDetails.id));
                          }, 'تم تحويل الدرس إلى مسودة.')
                        }
                      >
                        مسودة
                      </button>
                      <button
                        className="ui-button ui-button-secondary"
                        type="button"
                        disabled={saving || uploading}
                        onClick={() =>
                          void run(async () => {
                            await adminApi.updateLesson(lessonDetails.id, { accessLevel: 'FREE' });
                            await refreshCourse(details.id, selectedUnitId);
                            setLessonDetails(await adminApi.lesson(lessonDetails.id));
                          }, 'تم تعيين الدرس كمجاني.')
                        }
                      >
                        درس مجاني
                      </button>
                      <button
                        className="ui-button ui-button-secondary"
                        type="button"
                        disabled={saving || uploading}
                        onClick={() =>
                          void run(async () => {
                            await adminApi.updateLesson(lessonDetails.id, { accessLevel: 'ENROLLED' });
                            await refreshCourse(details.id, selectedUnitId);
                            setLessonDetails(await adminApi.lesson(lessonDetails.id));
                          }, 'تم تعيين الدرس كمدفوع.')
                        }
                      >
                        درس مدفوع
                      </button>
                    </div>
                  </header>

                  <div className="admin-upload-grid">
                    <form
                      className="admin-upload-panel"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (uploading || saving) return;
                        const form = event.currentTarget;
                        const file = (form.elements.namedItem('video') as HTMLInputElement).files?.[0];
                        if (!file) {
                          setError('اختر ملف فيديو أولًا.');
                          return;
                        }
                        void run(async () => {
                          await adminApi.uploadVideo(
                            lessonDetails.id,
                            file,
                            {
                              title: videoTitle.trim() || file.name,
                              type: videoType,
                              accessLevel: videoAccess,
                              status: 'PUBLISHED',
                              position: lessonDetails.videos?.length ?? 0,
                            },
                            setUpload,
                          );
                          setLessonDetails(await adminApi.lesson(lessonDetails.id));
                          form.reset();
                        }, 'تم رفع الفيديو.');
                      }}
                    >
                      <h4>فيديو الدرس</h4>
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
                          <option value="ENROLLED">مدفوع</option>
                          <option value="FREE">مجاني</option>
                          <option value="PREVIEW">معاينة مجانية</option>
                        </select>
                      </label>
                      <label>
                        ملف الفيديو
                        <input name="video" type="file" accept="video/mp4,video/webm,video/quicktime" />
                      </label>
                      <button className="ui-button" type="submit" disabled={saving || uploading}>
                        {uploading ? phaseLabel(upload?.phase ?? 'uploading') : 'رفع فيديو'}
                      </button>
                    </form>

                    <form
                      className="admin-upload-panel"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (uploading || saving) return;
                        const form = event.currentTarget;
                        const file = (form.elements.namedItem('pdf') as HTMLInputElement).files?.[0];
                        if (!file) {
                          setError('اختر ملف PDF أولًا.');
                          return;
                        }
                        void run(async () => {
                          await adminApi.uploadResource(lessonDetails.id, file, file.name, setUpload);
                          setLessonDetails(await adminApi.lesson(lessonDetails.id));
                          form.reset();
                        }, 'تم رفع ملف PDF.');
                      }}
                    >
                      <h4>مادة PDF</h4>
                      <label>
                        ملف المادة
                        <input name="pdf" type="file" accept="application/pdf" />
                      </label>
                      <button className="ui-button" type="submit" disabled={saving || uploading}>
                        {uploading ? phaseLabel(upload?.phase ?? 'uploading') : 'رفع PDF'}
                      </button>
                    </form>
                  </div>
                  <UploadMeter progress={upload} />

                  {(lessonDetails.videos ?? []).map((video) => (
                    <div className="admin-live-lesson" key={video.id}>
                      <span>
                        فيديو: {video.title} · {accessLabel(video.accessLevel)}
                      <button className="ui-button ui-button-secondary" type="button" onClick={() => setEditor({ kind: 'video', record: video, lessonId: lessonDetails.id })}>تعديل الفيديو</button>
                      </span>
                      <button
                        className="ui-button ui-button-secondary"
                        type="button"
                        disabled={saving || uploading}
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
                      <button className="ui-button ui-button-secondary" type="button" onClick={() => setEditor({ kind: 'resource', record: resource, lessonId: lessonDetails.id })}>تعديل الملف</button>
                      <span>مادة: {resource.title}</span>
                    </div>
                  ))}
                </section>
              ) : null}
            </>
          )}
        </section>
      </div>
      {editor ? (
        <ContentStudioEditor
          key={`${editor.kind}-${editor.record.id}`}
          target={editor}
          stages={stages}
          onClose={() => setEditor(null)}
          onUploadProgress={setUpload}
          onChanged={async () => {
            if (details) await refreshCourse(details.id, selectedUnitId);
            if (lessonDetails) setLessonDetails(await adminApi.lesson(lessonDetails.id));
            await reloadCourses();
          }}
          onRemoved={async () => {
            if (editor.kind === 'lesson' || editor.kind === 'video' || editor.kind === 'resource') setLessonDetails(null);
            if (editor.kind === 'unit') setSelectedUnitId(null);
            if (details) await refreshCourse(details.id, editor.kind === 'unit' ? null : selectedUnitId);
            await reloadCourses();
          }}
        />
      ) : null}
    </div>
  );
}
