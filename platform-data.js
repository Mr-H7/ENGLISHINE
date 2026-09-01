/*
 * Englishine Arabic-first MVP data contracts.
 * TODO(BACKEND): Replace static records with authenticated API responses backed by a database.
 * TODO(MEDIA): Store video metadata in a database and files/manifests in secure object storage/CDN.
 */
window.EnglishineData = {
  stages: [
    { id: "primary", label: "المرحلة الابتدائية", grades: [
      { id: "p1", label: "الصف الأول الابتدائي" }, { id: "p2", label: "الصف الثاني الابتدائي" },
      { id: "p3", label: "الصف الثالث الابتدائي" }, { id: "p4", label: "الصف الرابع الابتدائي" },
      { id: "p5", label: "الصف الخامس الابتدائي" }, { id: "p6", label: "الصف السادس الابتدائي" }
    ]},
    { id: "prep", label: "المرحلة الإعدادية", grades: [
      { id: "prep1", label: "الصف الأول الإعدادي" }, { id: "prep2", label: "الصف الثاني الإعدادي" }, { id: "prep3", label: "الصف الثالث الإعدادي" }
    ]},
    { id: "secondary", label: "المرحلة الثانوية", grades: [
      { id: "sec1", label: "الصف الأول الثانوي" }, { id: "sec2", label: "الصف الثاني الثانوي" }, { id: "sec3", label: "الصف الثالث الثانوي" }
    ]}
  ],
  terms: [{ id: "term1", label: "الترم الأول" }, { id: "term2", label: "الترم الثاني" }],
  units: [
    { id: "prep1-t1-u1", stageId: "prep", gradeId: "prep1", termId: "term1", title: "Unit 1", subtitle: "بداية منظمة للمنهج", status: "available", progress: 0, lessons: [
      { id: "lesson-1-2", title: "Lesson 1.2", description: "شرح الدرسين الأول والثاني معًا كما تم تسجيلهما.", status: "available" },
      { id: "lesson-3", title: "Lesson 3", description: "شرح منفصل وتدريب على أسئلة الدرس.", status: "available" },
      { id: "lesson-4-story", title: "Lesson 4 — Story", description: "قصة تعليمية مرئية ستُضاف بعد تجهيز المحتوى.", status: "coming" },
      { id: "lesson-5-6", title: "Lesson 5.6", description: "شرح الدرسين الخامس والسادس معًا كما تم تسجيلهما.", status: "available" }
    ]},
    ...Array.from({ length: 5 }, (_, index) => ({ id: `prep1-t1-u${index + 2}`, stageId: "prep", gradeId: "prep1", termId: "term1", title: `Unit ${index + 2}`, subtitle: "المحتوى قيد التجهيز", status: "coming", progress: 0, lessons: [] }))
  ],
  components: [
    { id: "explanation", label: "الشرح", state: "preview" },
    { id: "homework", label: "الواجب", state: "not-opened" },
    { id: "assignment", label: "التكليف", state: "locked" },
    { id: "solution", label: "فيديو حل الواجب", state: "locked" }
  ],
  bundles: [
    { id: "single-unit", title: "وحدة واحدة", description: "وصول لوحدة محددة حسب الصف والترم.", access: "وصول محدد", price: null },
    { id: "monthly", title: "باقة شهرية", description: "مسار شهر منظم حسب خطة الطالب.", access: "وصول شهري", price: null },
    { id: "term", title: "باقة الترم", description: "وحدات الترم ومراجعاته حسب خطة النشر.", access: "وصول الترم", price: null },
    { id: "annual", title: "الباقة السنوية", description: "متابعة ممتدة خلال العام الدراسي.", access: "وصول سنوي", price: null }
  ],
  video: {
    title: "الصف الأول الإعدادي — Lesson 1.2", durationLabel: "المدة تُحدد عند ربط الفيديو",
    speeds: ["0.5x", "0.75x", "1x", "1.25x", "1.5x", "1.75x", "2x", "3x", "4x"],
    qualities: ["Auto", "140p", "240p", "360p", "480p", "720p", "1080p"],
    sections: [
      { id: "vocabulary", label: "Vocabulary", time: 0 }, { id: "reading", label: "Reading", time: 420 },
      { id: "listening", label: "Listening", time: 780 }, { id: "grammar", label: "Grammar", time: 1080 },
      { id: "exercises", label: "Exercises", time: 1560 }, { id: "revision", label: "Revision", time: 1980 }
    ]
  },
  demoComments: [],
  devices: [{ id: "current", name: "الجهاز الحالي", detail: "متصفح الويب — جلسة تجريبية", current: true }],
  activationCodeModel: { code: "string", unlockType: "course | unit | lesson | bundle", targetId: "string", maxUses: "number", usedCount: "number", expiresAt: "ISO datetime", assignedStudentId: "string | null" },
  adminSections: [
    ["courses", "إدارة الكورسات", "تنظيم المراحل والوحدات والدروس"], ["videos", "إدارة الفيديوهات", "مصادر الفيديو والجودات والأقسام"],
    ["homework", "مراجعة الواجب", "تسليمات الطلاب وملاحظات المدرس"], ["students", "الطلاب", "الحسابات والمراحل وحالة الوصول"],
    ["analytics", "التحليلات", "بيانات التعلم بعد ربط البنية الخلفية"], ["codes", "أكواد التفعيل", "إنشاء ومتابعة أكواد الوصول"],
    ["notifications", "الإشعارات", "تجهيز رسائل للمجموعات المستهدفة"], ["comments", "التعليقات", "مراجعة تعليقات الفيديوهات"],
    ["leaderboard", "الطلاب المتميزون", "معايير التقدم والمشاركة"]
  ]
};