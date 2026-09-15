import { Outlet, Link } from 'react-router';
import { assets } from '@/assets/registry';
import foundationStyles from '@/styles/index.css?inline';
import authStyles from '@/styles/auth-app.css?inline';
import { ScrollManager } from '@/components/ScrollManager';

export function Component() {
  return (
    <>
      <style>{foundationStyles}</style>
      <style>{authStyles}</style>
      <ScrollManager />
      <div className="auth-app-shell">
        <a className="ui-skip" href="#auth-main">
          انتقل للمحتوى
        </a>
        <aside className="auth-story-panel">
          <Link className="auth-brand" to="/">
            <img src={assets.logo} alt="" />
            <span>
              <strong>Englishine</strong>
              <small>MR AHMED ABO MAZEN</small>
            </span>
          </Link>
          <div className="auth-story-copy">
            <span>تعلم منظم وواضح</span>
            <h2>كل خطوة في مسارك لها مكان وهدف.</h2>
            <p>
              الدروس والواجبات والمتابعة تظهر داخل مساحة واحدة في حسابك على
              المنصة.
            </p>
          </div>
        </aside>
        <main id="auth-main" className="auth-main">
          <Outlet />
        </main>
      </div>
    </>
  );
}
