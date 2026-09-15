import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  AdminCard,
  AdminErrorState,
  AdminLoadingState,
  AdminPagination,
  AdminTable,
  AnalyticsCard,
  ChartCard,
  FilterBar,
  FormSection,
  MetricCard,
  StatusBadge,
} from '@/components/admin/AdminComponents';
import type { AdminColumn } from '@/components/admin/AdminComponents';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';

interface AdminRecord {
  id: string;
  values: Record<string, string>;
}
interface ResourceConfig {
  title: string;
  eyebrow: string;
  description: string;
  searchPlaceholder: string;
  columns: string[];
  filters: string[];
  action: string;
}

const emptyRecords: AdminRecord[] = [];
const configs = {
  students: {
    title: 'الطلاب',
    eyebrow: 'إدارة المتعلمين',
    description:
      'البحث في حسابات الطلاب ومراجعة الوصول والتقدم والواجبات والاختبارات والأجهزة وحالة التفعيل.',
    searchPlaceholder: 'ابحث بالاسم أو البريد أو الكود',
    columns: [
      'الطالب',
      'الكورس',
      'التقدم',
      'الواجبات',
      'الاختبارات',
      'الاشتراك',
      'الأجهزة',
      'التفعيل',
    ],
    filters: ['كل المراحل', 'حالة الاشتراك', 'حالة التفعيل'],
    action: 'إضافة طالب',
  },
  teachers: {
    title: 'المدرسون',
    eyebrow: 'فريق التعليم',
    description: 'إدارة ملفات المدرسين وصلاحيات المحتوى وحالة الحساب.',
    searchPlaceholder: 'ابحث باسم المدرس',
    columns: ['المدرس', 'الدور', 'الكورسات', 'الحالة', 'آخر تحديث'],
    filters: ['كل الأدوار', 'حالة الحساب'],
    action: 'إضافة مدرس',
  },
  courses: {
    title: 'الكورسات',
    eyebrow: 'إدارة المحتوى',
    description:
      'تنظيم الكورسات وحالتها من المسودة إلى النشر أو الأرشفة مع وصول سريع للتعديل.',
    searchPlaceholder: 'ابحث باسم الكورس أو المرحلة',
    columns: ['الكورس', 'المرحلة', 'الوحدات', 'الحالة', 'آخر تحديث', 'إجراءات'],
    filters: ['كل المراحل', 'منشور', 'مسودة', 'مؤرشف'],
    action: 'إنشاء كورس',
  },
  units: {
    title: 'الوحدات',
    eyebrow: 'هيكل الكورس',
    description: 'ترتيب الوحدات وربطها بالكورس والترم ومتابعة جاهزية دروسها.',
    searchPlaceholder: 'ابحث باسم الوحدة',
    columns: ['الوحدة', 'الكورس', 'الترم', 'الدروس', 'الحالة', 'الترتيب'],
    filters: ['كل الكورسات', 'كل الترمات', 'الحالة'],
    action: 'إضافة وحدة',
  },
  lessons: {
    title: 'الدروس',
    eyebrow: 'إدارة التعلّم',
    description:
      'متابعة الفيديو والواجب والاختبار والظهور والمدة وآخر تحديث لكل درس.',
    searchPlaceholder: 'ابحث باسم الدرس أو الوحدة',
    columns: [
      'الدرس',
      'الوحدة',
      'حالة الفيديو',
      'الواجب',
      'الاختبار',
      'الظهور',
      'المدة',
      'آخر تحديث',
    ],
    filters: ['كل الكورسات', 'حالة الفيديو', 'الظهور'],
    action: 'إضافة درس',
  },
  homework: {
    title: 'الواجبات',
    eyebrow: 'المراجعة والمتابعة',
    description:
      'مراجعة حالات التسليم والدرجة والملاحظات وتاريخ الإرسال دون إنشاء درجات وهمية.',
    searchPlaceholder: 'ابحث باسم الطالب أو الواجب',
    columns: [
      'الطالب',
      'الواجب',
      'الحالة',
      'الدرجة',
      'الملاحظات',
      'تاريخ التسليم',
    ],
    filters: ['قيد المراجعة', 'تمت المراجعة', 'يحتاج مراجعة'],
    action: 'إنشاء واجب',
  },
  assignments: {
    title: 'التكليفات',
    eyebrow: 'التطبيق العملي',
    description: 'تنظيم التكليفات وربطها بالدروس ومتابعة مواعيدها وحالة النشر.',
    searchPlaceholder: 'ابحث باسم التكليف',
    columns: ['التكليف', 'الدرس', 'تاريخ التسليم', 'التسليمات', 'الحالة'],
    filters: ['كل الكورسات', 'الحالة'],
    action: 'إضافة تكليف',
  },
  exams: {
    title: 'الاختبارات',
    eyebrow: 'التقييم',
    description:
      'إدارة الاختبارات والمحاولات ومتوسط النتيجة ونسبة الاجتياز والنشر والنتائج.',
    searchPlaceholder: 'ابحث باسم الاختبار',
    columns: [
      'الاختبار',
      'الكورس',
      'المحاولات',
      'متوسط النتيجة',
      'نسبة الاجتياز',
      'الحالة',
      'النتائج',
    ],
    filters: ['كل الكورسات', 'منشور', 'مسودة'],
    action: 'إنشاء اختبار',
  },
  announcements: {
    title: 'الإعلانات',
    eyebrow: 'التواصل',
    description:
      'إنشاء ومراجعة الإعلانات الموجهة للطلاب مع حالة النشر والجمهور المستهدف.',
    searchPlaceholder: 'ابحث في الإعلانات',
    columns: ['العنوان', 'الجمهور', 'الحالة', 'تاريخ النشر', 'آخر تحديث'],
    filters: ['كل الجماهير', 'منشور', 'مسودة'],
    action: 'إعلان جديد',
  },
  notifications: {
    title: 'الإشعارات',
    eyebrow: 'مركز الرسائل',
    description:
      'تجهيز رسائل الإشعارات والجمهور المستهدف. الإرسال الفعلي يحتاج مزود إشعارات.',
    searchPlaceholder: 'ابحث في سجل الإشعارات',
    columns: ['العنوان', 'الجمهور', 'الحالة', 'وقت الإرسال'],
    filters: ['كل الجماهير', 'الحالة'],
    action: 'إشعار جديد',
  },
  codes: {
    title: 'أكواد التفعيل',
    eyebrow: 'الوصول',
    description:
      'إدارة الأكواد ونوع الفتح والهدف وعدد الاستخدامات والانتهاء والطالب المعيّن.',
    searchPlaceholder: 'ابحث بالكود أو الهدف',
    columns: [
      'الكود',
      'نوع الفتح',
      'الهدف',
      'الاستخدام',
      'الانتهاء',
      'الطالب',
      'الحالة',
    ],
    filters: ['كورس', 'وحدة', 'درس', 'باقة', 'الحالة'],
    action: 'إنشاء كود',
  },
  bookings: {
    title: 'طلبات الحجز',
    eyebrow: 'الحجز الخاص',
    description: 'مراجعة طلبات الحصص الفردية والمجموعات الصغيرة وحالة التواصل.',
    searchPlaceholder: 'ابحث باسم الطالب أو هاتف ولي الأمر',
    columns: [
      'الطالب',
      'نوع الحجز',
      'الصف',
      'الموعد المفضل',
      'الهدف',
      'الحالة',
      'تاريخ الطلب',
    ],
    filters: ['فردي', 'مجموعة صغيرة', 'الحالة'],
    action: 'إضافة طلب',
  },
  comments: {
    title: 'التعليقات',
    eyebrow: 'الإشراف',
    description:
      'مراجعة تعليقات الدروس وحالات الإظهار والإخفاء دون ادعاء وجود بيانات فعلية.',
    searchPlaceholder: 'ابحث في التعليقات',
    columns: ['الطالب', 'الدرس', 'التعليق', 'الحالة', 'التاريخ'],
    filters: ['ظاهر', 'مخفي', 'قيد المراجعة'],
    action: 'مراجعة التعليقات',
  },
  leaderboard: {
    title: 'الطلاب المتميزون',
    eyebrow: 'التقدم',
    description:
      'واجهة إعداد لوحة التميز اعتمادًا على معايير فعلية عند ربط البيانات.',
    searchPlaceholder: 'ابحث باسم الطالب',
    columns: [
      'الطالب',
      'المرحلة',
      'الواجبات',
      'المشاهدة',
      'الاستمرارية',
      'الاختبارات',
    ],
    filters: ['كل المراحل', 'الفترة'],
    action: 'إعداد المعايير',
  },
} satisfies Record<string, ResourceConfig>;

function useAdminMetadata(title: string, description: string) {
  useDocumentMetadata({
    title: `${title} — إدارة Englishine`,
    description,
    openGraph: [],
    structuredData: [],
  });
}
function PageHeader({ config }: { config: ResourceConfig }) {
  return (
    <header className="admin-page-header">
      <div>
        <span>{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.description}</p>
      </div>
      <button
        type="button"
        className="ui-button"
        disabled
        title="يحتاج ربط backend"
      >
        {config.action}
      </button>
    </header>
  );
}
function selectFilter(label: string) {
  return (
    <label key={label} className="admin-select">
      <span>{label}</span>
      <select defaultValue="">
        <option value="">الكل</option>
        <option disabled>تُحمّل الخيارات من قاعدة البيانات</option>
      </select>
    </label>
  );
}
function AdminResourcePage({ config }: { config: ResourceConfig }) {
  useAdminMetadata(config.title, config.description);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const view = params.get('view') ?? 'empty';
  const columns = useMemo<AdminColumn<AdminRecord>[]>(
    () =>
      config.columns.map((title, index) => ({
        key: String(index),
        title,
        render: (row) => row.values[title] ?? '—',
      })),
    [config.columns],
  );
  const retry = () => setParams({});
  return (
    <div className="admin-page">
      <PageHeader config={config} />
      <FilterBar search={search} onSearchChange={setSearch}>
        {config.filters.map(selectFilter)}
      </FilterBar>
      <div className="admin-status-legend" aria-label="حالات المحتوى">
        <StatusBadge status="published" />
        <StatusBadge status="draft" />
        <StatusBadge status="archived" />
      </div>
      {view === 'loading' ? (
        <AdminLoadingState />
      ) : view === 'error' ? (
        <AdminErrorState onRetry={retry} />
      ) : (
        <AdminCard className="admin-table-card">
          <AdminTable
            caption={config.title}
            columns={columns}
            rows={emptyRecords}
            rowKey={(row) => row.id}
          />
          <AdminPagination onChange={() => undefined} />
        </AdminCard>
      )}
    </div>
  );
}

export function AdminDashboardPage() {
  useAdminMetadata('نظرة عامة', 'مركز تشغيل منصة Englishine.');
  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <span>مركز التشغيل</span>
          <h1>صباح الخير، مستر أحمد</h1>
          <p>
            صورة منظمة لما يحتاج انتباهك اليوم. تظهر القيم الفعلية فقط بعد ربط
            قاعدة البيانات.
          </p>
        </div>
        <Link className="ui-button" to="/admin/courses/">
          إدارة الكورسات
        </Link>
      </header>
      <section aria-labelledby="today-title">
        <div className="admin-section-title">
          <div>
            <span>اليوم</span>
            <h2 id="today-title">إحصاءات سريعة</h2>
          </div>
          <small>لا توجد أرقام تجريبية</small>
        </div>
        <div className="admin-metric-grid">
          <MetricCard label="الطلاب النشطون" note="بانتظار البيانات" />
          <MetricCard label="واجبات تحتاج مراجعة" note="بانتظار البيانات" />
          <MetricCard label="اختبارات قادمة" note="بانتظار البيانات" />
          <MetricCard label="طلبات حجز جديدة" note="بانتظار البيانات" />
        </div>
      </section>
      <section className="admin-dashboard-grid" aria-label="متابعة التشغيل">
        <ChartCard
          title="نمو الطلاب"
          description="مخطط هيكلي لنمو الطلاب بدون قيم مختلقة."
        />
        <ChartCard
          title="حالة الواجبات"
          description="مخطط هيكلي لحالات التسليم والمراجعة."
        />
        <AnalyticsCard title="حالة الكورسات">
          <div className="admin-empty-compact">
            <strong>لا توجد بيانات نشر بعد</strong>
            <p>اربط الكورسات بقاعدة البيانات لعرض المنشور والمسودة والمؤرشف.</p>
          </div>
        </AnalyticsCard>
        <AnalyticsCard title="المراجعات المعلّقة">
          <div className="admin-empty-compact">
            <strong>لا توجد مراجعات متاحة</strong>
            <p>ستظهر الواجبات والتعليقات التي تحتاج إجراء هنا.</p>
          </div>
        </AnalyticsCard>
      </section>
      <section aria-labelledby="quick-admin-title">
        <div className="admin-section-title">
          <div>
            <span>أقل عدد من الخطوات</span>
            <h2 id="quick-admin-title">إجراءات سريعة</h2>
          </div>
        </div>
        <div className="admin-quick-grid">
          {(
            [
              ['إنشاء كورس', '/admin/courses/'],
              ['إضافة درس', '/admin/lessons/'],
              ['مراجعة الواجبات', '/admin/homework/'],
              ['إنشاء كود', '/admin/codes/'],
              ['إرسال إشعار', '/admin/notifications/'],
              ['طلبات الحجز', '/admin/bookings/'],
            ] as const
          ).map(([label, href]) => (
            <Link key={href} to={href}>
              {label}
            </Link>
          ))}
        </div>
      </section>
      <section aria-labelledby="enrollments-title">
        <div className="admin-section-title">
          <div>
            <span>آخر النشاط</span>
            <h2 id="enrollments-title">أحدث التسجيلات</h2>
          </div>
        </div>
        <AdminCard>
          <AdminTable
            caption="أحدث التسجيلات"
            columns={[
              { key: 'student', title: 'الطالب', render: () => '' },
              { key: 'course', title: 'الكورس', render: () => '' },
              { key: 'date', title: 'التاريخ', render: () => '' },
            ]}
            rows={emptyRecords}
            rowKey={(row) => row.id}
          />
        </AdminCard>
      </section>
    </div>
  );
}

export function AdminAnalyticsPage() {
  useAdminMetadata('التحليلات', 'تحليلات تشغيلية جاهزة للربط بمصادر البيانات.');
  const [search, setSearch] = useState('');
  return (
    <div className="admin-page">
      <PageHeader
        config={{
          title: 'التحليلات',
          eyebrow: 'فهم الأداء',
          description:
            'مخططات هيكلية جاهزة لبيانات الطلاب والمحتوى والتفاعل بدون أرقام مختلقة.',
          searchPlaceholder: 'بحث',
          columns: [],
          filters: [],
          action: 'تصدير التقرير',
        }}
      />
      <FilterBar search={search} onSearchChange={setSearch}>
        {selectFilter('الفترة الزمنية')}
        {selectFilter('الكورس')}
      </FilterBar>
      <div className="admin-metric-grid">
        <MetricCard label="إجمالي الطلاب" note="بانتظار البيانات" />
        <MetricCard label="إكمال الدروس" note="بانتظار البيانات" />
        <MetricCard label="تسليم الواجبات" note="بانتظار البيانات" />
        <MetricCard label="متوسط الاختبارات" note="بانتظار البيانات" />
      </div>
      <div className="admin-dashboard-grid">
        <ChartCard
          title="النشاط الأسبوعي"
          description="المشاهدة والتطبيق عبر أيام الأسبوع."
        />
        <ChartCard
          title="تقدم الكورسات"
          description="نسب الإكمال حسب الكورس عند توفر البيانات."
        />
      </div>
      <AdminLoadingState />
      <AdminErrorState onRetry={() => undefined} />
    </div>
  );
}

export function AdminSettingsPage() {
  useAdminMetadata('الإعدادات', 'إعدادات منصة Englishine الجاهزة للربط.');
  return (
    <div className="admin-page">
      <PageHeader
        config={{
          title: 'الإعدادات',
          eyebrow: 'إدارة المنصة',
          description:
            'إعدادات الهوية والمنصة والإشعارات والأمان والحساب. الحفظ يحتاج backend وصلاحيات.',
          searchPlaceholder: 'بحث',
          columns: [],
          filters: [],
          action: 'حفظ التغييرات',
        }}
      />
      <form className="admin-settings-form">
        {['الهوية', 'المنصة', 'الإشعارات', 'الأمان', 'الحساب'].map(
          (section) => (
            <FormSection
              key={section}
              title={section}
              description="القيم الحالية تُحمّل من إعدادات المنصة عند ربط الخادم."
            >
              <label>
                اسم الإعداد
                <input type="text" placeholder="غير مضبوط" />
              </label>
              <label className="admin-toggle">
                <input type="checkbox" disabled /> خيار يحتاج ربط النظام
              </label>
            </FormSection>
          ),
        )}
      </form>
    </div>
  );
}
export function AdminProfilePage() {
  useAdminMetadata('الملف الشخصي', 'إعدادات ملف المسؤول.');
  return (
    <div className="admin-page">
      <PageHeader
        config={{
          title: 'الملف الشخصي',
          eyebrow: 'الحساب',
          description:
            'مراجعة بيانات الحساب وتفضيلات الإدارة. لا يتم حفظ شيء قبل ربط المصادقة.',
          searchPlaceholder: 'بحث',
          columns: [],
          filters: [],
          action: 'حفظ الملف',
        }}
      />
      <AdminCard>
        <FormSection
          title="بيانات المسؤول"
          description="تُحمّل البيانات الحقيقية بعد المصادقة."
        >
          <label>
            الاسم
            <input type="text" placeholder="غير متاح" />
          </label>
          <label>
            البريد الإلكتروني
            <input type="email" placeholder="غير متاح" />
          </label>
        </FormSection>
      </AdminCard>
    </div>
  );
}

export {
  AdminStudentsPage,
  AdminCoursesPage,
  AdminUnitsPage,
  AdminLessonsPage,
  AdminHomeworkPage,
  AdminExamsPage,
} from '@/pages/admin/AdminOperationsPages';
export const AdminTeachersPage = () => (
  <AdminResourcePage config={configs.teachers} />
);
export const AdminAssignmentsPage = () => (
  <AdminResourcePage config={configs.assignments} />
);
export const AdminAnnouncementsPage = () => (
  <AdminResourcePage config={configs.announcements} />
);
export const AdminNotificationsPage = () => (
  <AdminResourcePage config={configs.notifications} />
);
export const AdminCodesPage = () => (
  <AdminResourcePage config={configs.codes} />
);
export const AdminBookingsPage = () => (
  <AdminResourcePage config={configs.bookings} />
);
export const AdminCommentsPage = () => (
  <AdminResourcePage config={configs.comments} />
);
export const AdminLeaderboardPage = () => (
  <AdminResourcePage config={configs.leaderboard} />
);
