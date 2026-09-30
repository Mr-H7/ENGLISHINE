export type QuestionOwner = 'homework' | 'exam';
export function questionImage(kind: QuestionOwner, question: { id: string; imageAssetId: string | null }) {
  return question.imageAssetId ? { url: `/media/assessment-questions/${kind}/${question.id}/image?version=${question.imageAssetId}` } : null;
}
export function withQuestionImage<T extends { id: string; imageAssetId: string | null }>(kind: QuestionOwner, question: T) {
  const { imageAssetId, ...safe } = question;
  return { ...safe, image: questionImage(kind, { id: question.id, imageAssetId }) };
}
