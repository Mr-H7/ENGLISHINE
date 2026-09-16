import { apiRequest } from '@/services/api';

export interface GradeOption {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
}

export interface StageOption {
  id: string;
  code: string;
  nameAr: string;
  grades: GradeOption[];
}

export interface AdminCourse {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  status: 'DRAFT' | 'PRIVATE' | 'PUBLISHED' | 'ARCHIVED';
  accessLevel: 'FREE' | 'PREVIEW' | 'ENROLLED' | 'LOCKED';
  publishedAt: string | null;
  grade: { id: string; nameAr: string; nameEn: string } | null;
  _count: { units: number; enrollments: number };
}

export interface AdminLesson {
  id: string;
  title: string;
  position: number;
  status: string;
  accessLevel: string;
  estimatedMinutes: number | null;
  videos?: Array<{ id: string; title: string; type: string; accessLevel: string; status: string }>;
  resources?: Array<{ id: string; title: string; type: string }>;
}

export interface AdminCourseDetails extends AdminCourse {
  units: Array<{
    id: string;
    title: string;
    position: number;
    status: string;
    lessons: Array<{
      id: string;
      title: string;
      position: number;
      status: string;
      accessLevel: string;
      estimatedMinutes: number | null;
    }>;
  }>;
}

export interface AdminStudent {
  id: string;
  fullName: string;
  grade: { id: string; nameAr: string } | null;
  user: { email: string; status: string };
  _count: { enrollments: number };
}

export interface AdminHomework {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
  lesson: { id: string; title: string };
  _count: { questions: number; submissions: number };
}

export interface AdminExam {
  id: string;
  title: string;
  status: string;
  course: { id: string; title: string } | null;
}

const data = <T>(path: string, init?: RequestInit) =>
  apiRequest<{ data: T }>(path, init).then((response) => response.data);

interface DirectUploadTicket {
  authorization: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresIn: number;
  expiresAt: string;
  method: 'PUT';
}

let cachedDirectUpload: boolean | null = null;

async function isDirectUploadEnabled(): Promise<boolean> {
  if (cachedDirectUpload !== null) return cachedDirectUpload;
  try {
    const mode = await data<{ directUpload: boolean }>('/admin/media/upload-mode');
    cachedDirectUpload = Boolean(mode.directUpload);
  } catch {
    cachedDirectUpload = false;
  }
  return cachedDirectUpload;
}

function putToR2(uploadUrl: string, file: File, headers: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.withCredentials = false;
    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error('تعذر رفع الملف إلى التخزين.'));
    };
    xhr.onerror = () => reject(new Error('تعذر رفع الملف إلى التخزين.'));
    xhr.send(file);
  });
}

export const adminApi = {
  grades: () => data<StageOption[]>('/admin/grades'),
  students: () =>
    apiRequest<{ data: AdminStudent[]; meta: { total: number } }>('/admin/students?pageSize=100'),
  updateStudentGrade: (studentId: string, gradeId: string | null) =>
    data<AdminStudent>(`/admin/students/${studentId}/grade`, {
      method: 'PATCH',
      body: JSON.stringify({ gradeId }),
    }),
  courses: () =>
    apiRequest<{ data: AdminCourse[]; meta: { total: number } }>('/admin/courses?pageSize=100'),
  course: (id: string) => data<AdminCourseDetails>(`/admin/courses/${id}`),
  createCourse: (input: {
    title: string;
    slug: string;
    gradeId?: string;
    status?: AdminCourse['status'];
    accessLevel?: AdminCourse['accessLevel'];
    shortDescription?: string;
  }) =>
    data<AdminCourse>('/admin/courses', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateCourse: (
    id: string,
    input: Partial<{
      title: string;
      status: AdminCourse['status'];
      accessLevel: AdminCourse['accessLevel'];
      gradeId: string | null;
    }>,
  ) =>
    data<AdminCourse>(`/admin/courses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  createUnit: (courseId: string, input: { title: string; position: number; status?: string }) =>
    data(`/admin/courses/${courseId}/units`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateUnit: (id: string, input: { status?: string; title?: string }) =>
    data(`/admin/units/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  createLesson: (
    unitId: string,
    input: { title: string; position: number; status?: string; accessLevel?: string },
  ) =>
    data(`/admin/units/${unitId}/lessons`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  lesson: (id: string) => data<AdminLesson>(`/admin/lessons/${id}`),
  updateLesson: (id: string, input: { status?: string; accessLevel?: string; title?: string }) =>
    data(`/admin/lessons/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  enroll: (studentId: string, courseId: string) =>
    data('/admin/enrollments', {
      method: 'POST',
      body: JSON.stringify({ studentId, courseId, status: 'ACTIVE', source: 'MANUAL' }),
    }),
  homework: () => data<AdminHomework[]>('/admin/homework'),
  createHomework: (input: { lessonId: string; title: string; status?: string }) =>
    data('/admin/homework', { method: 'POST', body: JSON.stringify(input) }),
  exams: () => data<AdminExam[]>('/admin/exams'),
  createExam: (input: { courseId: string; title: string; status?: string }) =>
    data('/admin/exams', { method: 'POST', body: JSON.stringify(input) }),
  uploadVideo: async (
    lessonId: string,
    file: File,
    input: { title: string; type: string; accessLevel: string; status: string; position: number },
  ) => {
    if (await isDirectUploadEnabled()) {
      const session = await data<DirectUploadTicket>(`/admin/lessons/${lessonId}/uploads/authorize`, {
        method: 'POST',
        body: JSON.stringify({
          kind: 'video',
          mimeType: file.type || 'video/mp4',
          byteSize: file.size,
          originalName: file.name,
          title: input.title,
          type: input.type,
          position: input.position,
          status: input.status,
          accessLevel: input.accessLevel,
        }),
      });
      await putToR2(session.uploadUrl, file, session.headers);
      return data(`/admin/uploads/finalize`, {
        method: 'POST',
        body: JSON.stringify({ authorization: session.authorization }),
      });
    }
    const query = new URLSearchParams({
      title: input.title,
      type: input.type,
      accessLevel: input.accessLevel,
      status: input.status,
      position: String(input.position),
    });
    const body = new FormData();
    body.append('file', file);
    return data(`/admin/lessons/${lessonId}/videos?${query.toString()}`, {
      method: 'POST',
      body,
    });
  },
  uploadResource: async (lessonId: string, file: File, title: string) => {
    if (await isDirectUploadEnabled()) {
      const session = await data<DirectUploadTicket>(`/admin/lessons/${lessonId}/uploads/authorize`, {
        method: 'POST',
        body: JSON.stringify({
          kind: 'material',
          mimeType: file.type || 'application/pdf',
          byteSize: file.size,
          originalName: file.name,
          title,
          type: 'PDF',
          position: 0,
          isDownload: true,
        }),
      });
      await putToR2(session.uploadUrl, file, session.headers);
      return data(`/admin/uploads/finalize`, {
        method: 'POST',
        body: JSON.stringify({ authorization: session.authorization }),
      });
    }
    const query = new URLSearchParams({
      title,
      type: 'PDF',
      position: '0',
      isDownload: 'true',
    });
    const body = new FormData();
    body.append('file', file);
    return data(`/admin/lessons/${lessonId}/resources?${query.toString()}`, {
      method: 'POST',
      body,
    });
  },
  updateVideo: (id: string, input: { accessLevel?: string; status?: string; title?: string }) =>
    data(`/admin/videos/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
};
