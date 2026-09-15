import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AppIcon } from '@/components/icons/AppIcon';
import type { AppIconName } from '@/components/icons/AppIcon';

interface EmptyCopy {
  title: string;
  description: string;
}

function CardShell({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <article className={`student-card ${className}`.trim()}>{children}</article>
  );
}

function CardHeading({
  icon,
  eyebrow,
  title,
}: {
  icon: AppIconName;
  eyebrow: string;
  title: string;
}) {
  return (
    <header className="student-card-heading">
      <span className="student-icon">
        <AppIcon name={icon} />
      </span>
      <div>
        <small>{eyebrow}</small>
        <h2>{title}</h2>
      </div>
    </header>
  );
}

function EmptyCardBody({ title, description }: EmptyCopy) {
  return (
    <div className="student-empty">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function ContinueCard() {
  return (
    <CardShell className="continue-card">
      <CardHeading icon="play" eyebrow="كمّل من مكانك" title="التعلم التالي" />
      <EmptyCardBody
        title="لا يوجد درس نشط حاليًا"
        description="بعد تفعيل برنامجك، هيظهر هنا آخر درس وصلت له والخطوة التالية."
      />
      <div className="student-card-actions">
        <Link className="student-primary-action" to="/student/explore/">
          استكشف البرامج
        </Link>
      </div>
    </CardShell>
  );
}

export function HomeworkCard() {
  return (
    <CardShell>
      <CardHeading icon="homework" eyebrow="مهام اليوم" title="الواجب" />
      <EmptyCardBody
        title="لا يوجد واجب مستحق"
        description="الواجبات المرتبطة بدروسك هتظهر هنا بموعد التسليم."
      />
    </CardShell>
  );
}

export function ExamCard() {
  return (
    <CardShell>
      <CardHeading icon="exams" eyebrow="الجدول القادم" title="الاختبارات" />
      <EmptyCardBody
        title="لا توجد اختبارات قادمة"
        description="هيظهر هنا موعد أي اختبار يتم إضافته لمسارك."
      />
    </CardShell>
  );
}

export function AnnouncementCard() {
  return (
    <CardShell className="announcement-card">
      <CardHeading
        icon="notifications"
        eyebrow="من Englishine"
        title="الإعلانات"
      />
      <EmptyCardBody
        title="لا توجد إعلانات جديدة"
        description="التنبيهات المهمة من مستر أحمد وفريق المنصة هتظهر هنا."
      />
    </CardShell>
  );
}

export function ActivityCard() {
  return (
    <CardShell>
      <CardHeading icon="activity" eyebrow="آخر تحديث" title="النشاط الأخير" />
      <EmptyCardBody
        title="لسه مفيش نشاط"
        description="ابدأ برنامجك علشان نعرض الدروس والواجبات اللي أنجزتها."
      />
    </CardShell>
  );
}

export function SubscriptionCard() {
  return (
    <CardShell>
      <CardHeading
        icon="subscription"
        eyebrow="حالة الوصول"
        title="الاشتراك الحالي"
      />
      <div className="subscription-state">
        <span>غير متاح</span>
        <p>لا يوجد مزود اشتراكات متصل حاليًا.</p>
      </div>
      <Link className="student-text-link" to="/account/activation/">
        معاك كود؟ فعّله
      </Link>
    </CardShell>
  );
}

export function CertificateCard() {
  return (
    <CardShell>
      <CardHeading
        icon="certificates"
        eyebrow="إنجازاتك"
        title="أحدث الشهادات"
      />
      <EmptyCardBody
        title="لا توجد شهادات بعد"
        description="الشهادات المعتمدة المرتبطة بإنجازك هتظهر هنا عند توفرها."
      />
    </CardShell>
  );
}

export function ProgressCard() {
  return (
    <CardShell className="learning-progress-card">
      <CardHeading icon="progress" eyebrow="نظرة أسبوعية" title="تقدم التعلم" />
      <div
        className="progress-empty-chart"
        aria-label="لا توجد بيانات تقدم بعد"
      >
        {Array.from({ length: 7 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <EmptyCardBody
        title="لا توجد بيانات كفاية"
        description="هيظهر تقدمك واستمراريتك بعد بدء مشاهدة الدروس وتسليم المهام."
      />
    </CardShell>
  );
}

export function QuickActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: AppIconName;
  title: string;
  description: string;
}) {
  return (
    <Link className="quick-action-card" to={href}>
      <span className="student-icon">
        <AppIcon name={icon} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <AppIcon className="quick-action-arrow" name="arrow" />
    </Link>
  );
}

export function DashboardSkeleton() {
  return (
    <div
      className="student-dashboard student-loading"
      aria-label="جارٍ تحميل مساحة الطالب"
      role="status"
    >
      <div className="skeleton-block skeleton-hero" />
      <div className="student-stat-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="skeleton-block" key={index} />
        ))}
      </div>
      <div className="student-dashboard-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="skeleton-block skeleton-card" key={index} />
        ))}
      </div>
    </div>
  );
}
