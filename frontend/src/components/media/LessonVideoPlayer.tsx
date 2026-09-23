import { useCallback, useEffect, useRef, useState } from 'react';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const clock = `${minutes}:${String(rest).padStart(2, '0')}`;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : clock;
}

function Icon({ path, label }: { path: string; label: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <title>{label}</title>
      <path fill="currentColor" d={path} />
    </svg>
  );
}

export function LessonVideoPlayer({ src, title }: { src: string; title: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef(0);
  const hovered = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [speedsOpen, setSpeedsOpen] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const showControls = useCallback((persist = false) => {
    setControlsOpen(true);
    window.clearTimeout(hideTimer.current);
    if (persist) return;
    hideTimer.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (video && !video.paused) setControlsOpen(false);
    }, 2600);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(video.duration, Math.max(0, video.currentTime + delta));
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.requestFullscreen();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => {
      setPlaying(true);
      setWaiting(false);
      showControls();
    };
    const onPause = () => {
      setPlaying(false);
      setControlsOpen(true);
    };
    const onTime = () => setCurrent(video.currentTime);
    const onMeta = () => {
      setDuration(video.duration);
      setWaiting(false);
    };
    const onProgress = () => {
      if (!video.buffered.length) return;
      setBuffered(video.buffered.end(video.buffered.length - 1));
    };
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const onError = () => {
      setWaiting(false);
      setError('تعذر تشغيل الفيديو. تحقق من الاتصال وحاول مرة أخرى.');
    };
    const onVolume = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('progress', onProgress);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onPlaying);
    video.addEventListener('error', onError);
    video.addEventListener('volumechange', onVolume);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onPlaying);
      video.removeEventListener('error', onError);
      video.removeEventListener('volumechange', onVolume);
    };
  }, [src, showControls]);

  useEffect(() => {
    const onFull = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFull);
    return () => document.removeEventListener('fullscreenchange', onFull);
  }, []);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const active = document.activeElement;
      const playerActive = root.contains(active) || hovered.current || active === document.body;
      if (!playerActive) return;
      const key = event.key.toLowerCase();
      if (key === ' ' || key === 'k') {
        event.preventDefault();
        togglePlay();
      } else if (key === 'arrowright' || key === 'l') {
        event.preventDefault();
        seekBy(10);
      } else if (key === 'arrowleft' || key === 'j') {
        event.preventDefault();
        seekBy(-10);
      } else if (key === 'arrowup') {
        event.preventDefault();
        const video = videoRef.current;
        if (video) video.volume = Math.min(1, video.volume + 0.1);
      } else if (key === 'arrowdown') {
        event.preventDefault();
        const video = videoRef.current;
        if (video) video.volume = Math.max(0, video.volume - 0.1);
      } else if (key === 'm') {
        toggleMute();
      } else if (key === 'f') {
        event.preventDefault();
        toggleFullscreen();
      } else if (key === 'home') {
        event.preventDefault();
        if (videoRef.current) videoRef.current.currentTime = 0;
      } else if (key === 'end') {
        event.preventDefault();
        if (videoRef.current && Number.isFinite(videoRef.current.duration)) {
          videoRef.current.currentTime = videoRef.current.duration;
        }
      }
    };
    root.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', onKey);
    };
  }, [seekBy, toggleFullscreen, toggleMute, togglePlay]);

  const progressMax = duration || 0;
  const bufferedRatio = progressMax ? Math.min(1, buffered / progressMax) : 0;
  const playedRatio = progressMax ? Math.min(1, current / progressMax) : 0;

  return (
    <div
      ref={rootRef}
      className={`lesson-video-player${controlsOpen ? ' is-controls' : ''}${playing ? ' is-playing' : ''}`}
      dir="ltr"
      tabIndex={0}
      onMouseMove={() => {
        hovered.current = true;
        showControls();
      }}
      onMouseLeave={() => {
        hovered.current = false;
        if (playing) setControlsOpen(false);
      }}
      onFocus={() => showControls(true)}
    >
      <video
        ref={videoRef}
        className="lesson-video-el"
        src={src}
        title={title}
        playsInline
        preload="metadata"
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        onContextMenu={(event) => event.preventDefault()}
        onClick={togglePlay}
      />
      {waiting && !error ? (
        <div className="lesson-video-status" role="status">
          جارٍ التحميل…
        </div>
      ) : null}
      {error ? (
        <div className="lesson-video-status is-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setWaiting(true);
              videoRef.current?.load();
              void videoRef.current?.play();
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      ) : null}
      <div className="lesson-video-controls">
        <div className="lesson-video-timeline">
          <span className="lesson-video-buffer" style={{ inlineSize: `${bufferedRatio * 100}%` }} />
          <span className="lesson-video-played" style={{ inlineSize: `${playedRatio * 100}%` }} />
          <input
            type="range"
            min={0}
            max={progressMax || 0}
            step={0.1}
            value={Number.isFinite(current) ? current : 0}
            aria-label="شريط التقدم"
            aria-valuetext={`${formatTime(current)} / ${formatTime(duration)}`}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (videoRef.current) videoRef.current.currentTime = next;
              setCurrent(next);
              showControls(true);
            }}
          />
        </div>
        <div className="lesson-video-bar">
          <div className="lesson-video-cluster">
            <button type="button" onClick={() => seekBy(-10)} aria-label="رجوع 10 ثوانٍ">
              <Icon path="M11 18V6l-8.5 6zm2-6 8.5 6V6z" label="رجوع" />
              <span>10</span>
            </button>
            <button type="button" onClick={togglePlay} aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}>
              {playing ? (
                <Icon path="M7 5h4v14H7zm6 0h4v14h-4z" label="إيقاف" />
              ) : (
                <Icon path="M8 5v14l11-7z" label="تشغيل" />
              )}
            </button>
            <button type="button" onClick={() => seekBy(10)} aria-label="تقديم 10 ثوانٍ">
              <span>10</span>
              <Icon path="M13 6v12l8.5-6zm-2 6L2.5 18V6z" label="تقديم" />
            </button>
            <span className="lesson-video-time" dir="ltr">
              {formatTime(current)} / {formatTime(duration)}
            </span>
          </div>
          <div className="lesson-video-cluster">
            <button type="button" onClick={toggleMute} aria-label={muted || volume === 0 ? 'إلغاء كتم الصوت' : 'كتم الصوت'}>
              {muted || volume === 0 ? (
                <Icon path="M4 9v6h4l5 5V4L8 9H4zm12.5 3-2-2 1.4-1.4L17.9 10l2-2 1.4 1.4-2 2 2 2-1.4 1.4-2-2-2 2z" label="صامت" />
              ) : (
                <Icon path="M4 9v6h4l5 5V4L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.3-3.9v7.8A4.5 4.5 0 0 0 16.5 12z" label="صوت" />
              )}
            </button>
            <input
              className="lesson-video-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label="مستوى الصوت"
              onChange={(event) => {
                const video = videoRef.current;
                if (!video) return;
                video.muted = false;
                video.volume = Number(event.target.value);
              }}
            />
            <div className="lesson-video-speed">
              <button
                type="button"
                aria-expanded={speedsOpen}
                aria-haspopup="listbox"
                onClick={() => setSpeedsOpen((open) => !open)}
              >
                {rate === 1 ? '1×' : `${rate}×`}
              </button>
              {speedsOpen ? (
                <ul role="listbox" aria-label="سرعة التشغيل">
                  {SPEEDS.map((speed) => (
                    <li key={speed}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={rate === speed}
                        onClick={() => {
                          const video = videoRef.current;
                          if (video) video.playbackRate = speed;
                          setRate(speed);
                          setSpeedsOpen(false);
                        }}
                      >
                        {speed === 1 ? '1×' : `${speed}×`}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}>
              {fullscreen ? (
                <Icon path="M7 14H5v5h5v-2H7zm12 0h-2v3h-3v2h5zM7 7h3V5H5v5h2zm10 0v3h2V5h-5v2z" label="إنهاء ملء الشاشة" />
              ) : (
                <Icon path="M7 14H5v5h5v-2H7zm5-9v2h3v3h2V5zM5 5v5h2V7h3V5zm12 12h-3v2h5v-5h-2z" label="ملء الشاشة" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
