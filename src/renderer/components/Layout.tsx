import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useTranslation } from 'react-i18next';

export default function Layout() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden print:block print:h-auto print:overflow-visible print:bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="print:hidden h-full flex shrink-0">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 min-w-0 print:block">
        <div className="print:hidden">
          <Topbar />
        </div>
        <main className="flex-1 overflow-auto p-6 bg-[var(--bg-primary)] print:p-0 print:bg-white print:overflow-visible">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
