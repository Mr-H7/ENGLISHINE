import { useEffect, useState } from 'react';
import { apiBlob } from '@/services/api';
import './question-image.css';

export type QuestionImageInfo = { url: string };
export function QuestionImage({ image }: { image: QuestionImageInfo }) {
  return <ProtectedQuestionImage key={image.url} url={image.url} />;
}
function ProtectedQuestionImage({ url }: { url: string }) {
  const [state, setState] = useState<{ src?: string; failed?: boolean }>({});
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    void apiBlob(url).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setState({ src: objectUrl });
    }, () => { if (active) setState({ failed: true }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  return <figure className="assessment-question-image" aria-busy={!state.src && !state.failed}>
    {state.failed ? <figcaption role="status">تعذر تحميل صورة السؤال. حدّث الصفحة أو حاول لاحقًا؛ يمكنك متابعة باقي الأسئلة.</figcaption> : state.src ? <img src={state.src} alt="صورة توضيحية للسؤال" onError={() => setState({ failed: true })} /> : <figcaption role="status">جارٍ تحميل صورة السؤال…</figcaption>}
  </figure>;
}
