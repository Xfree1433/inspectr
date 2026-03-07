import { useApp } from '../context/AppContext';

export function ToastContainer() {
  const { toasts } = useApp();

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}${t.out ? ' out' : ''}`}>
          <span className="tdot" />{t.icon} {t.msg}
        </div>
      ))}
    </div>
  );
}
