import { Navigate, useParams } from 'react-router';

export function LessonCanonicalRedirect() {
  const { lessonId } = useParams();
  return <Navigate to={`/student/lesson/${lessonId}/`} replace />;
}
