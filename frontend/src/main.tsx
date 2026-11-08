import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UploadCloud,
  BrainCircuit,
  HeartHandshake,
  Settings,
  Search,
  ChevronDown,
  LogOut,
  Menu,
  X,
  ArrowRight,
  GraduationCap,
  Check,
  Bell,
  ChevronRight,
  KeyRound,
  ChartNoAxesCombined,
} from "lucide-react";
import { api, setCsrf, errorMessage } from "./api";
import { Brand, Avatar } from "./components";
import type { User } from "./types";
import {
  OverviewPage,
  StudentsPage,
  ProfilePage,
  ImportsPage,
  ModelPage,
  InterventionsPage,
  SettingsPage,
} from "./pages";
import "./styles.css";
import "./readability.css";
import "./portals.css";
import "./experience.css";
import { AnalyticsPage } from "./experience";
import { PortalLogin, StudentPortal, AccountsPage } from "./portals";

const AuthContext = createContext<{
  user: User;
  logout: () => Promise<void>;
  expire: () => void;
}>({ user: null as unknown as User, logout: async () => {}, expire: () => {} });
export const useAuth = () => useContext(AuthContext);
const ToastContext = createContext<
  (message: string, tone?: "success" | "error") => void
>(() => {});
export const useToast = () => useContext(ToastContext);

function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: string } | null>(
    null,
  );
  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timeout);
    }
  }, [toast]);
  return (
    <ToastContext.Provider
      value={(message, tone = "success") => setToast({ message, tone })}
    >
      {children}
      {toast && (
        <div className={`toast ${toast.tone}`} role="status">
          {toast.tone === "success" ? <Check size={18} /> : <X size={18} />}
          <span>{toast.message}</span>
          <button
            className="icon-button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    api<{ demo_mode: boolean }>("/config")
      .then((v) => setDemo(v.demo_mode))
      .catch(() => {});
  }, []);
  return <PortalLogin onLogin={onLogin} demo={demo} />;
}

const links = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/students", label: "Students", icon: Users },
  { to: "/interventions", label: "Support plans", icon: HeartHandshake },
  { to: "/imports", label: "Data imports", icon: UploadCloud },
  { to: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { to: "/model", label: "Model insights", icon: BrainCircuit },
];
function Shell() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    api<{ demo_mode: boolean }>("/config")
      .then((v) => setDemo(v.demo_mode))
      .catch(() => {});
  }, []);
  const availableLinks =
    user.role === "admin"
      ? [
          ...links,
          { to: "/accounts", label: "Student accounts", icon: KeyRound },
        ]
      : links;
  const current = availableLinks.find((l) =>
    l.to === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(l.to),
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {menu && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <Link className="brand-link" to="/" aria-label="Continuum overview">
          <Brand />
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X />
        </button>
        <div className="workspace-label">
          <span className="campus-icon">
            <GraduationCap size={20} />
          </span>
          <div>
            <strong>Campus workspace</strong>
            <small>Student success</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {availableLinks.map((l) => (
            <NavLink
              end={l.to === "/"}
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <l.icon size={19} />
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-note">
            <span className="support-note-icon">
              <HeartHandshake size={20} />
            </span>
            <strong>Insights lead to action.</strong>
            <p>A conversation can make all the difference.</p>
            <Link to="/interventions">
              View support plans <ArrowRight size={14} />
            </Link>
          </div>
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Settings size={19} />
            Settings
          </NavLink>
          <div className="sidebar-user">
            <Avatar name={user.name} />
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.role === "admin" ? "Administrator" : "Faculty member"}
              </small>
            </div>
            <button
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              onClick={() =>
                logout().catch((e) => toast(errorMessage(e), "error"))
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-button"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {current?.label || "Settings"}
              {location.pathname.match(/^\/students\/\d/)
                ? " / Student profile"
                : ""}
            </strong>
          </div>
          <div className="topbar-right">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/students?search=${encodeURIComponent(search)}`);
                setSearch("");
              }}
            >
              <Search size={16} />
              <input
                aria-label="Find a student"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a student…"
              />
              <kbd>↵</kbd>
            </form>
            {demo && <span className="environment-pill">Demo workspace</span>}
            <Link
              to="/interventions"
              className="icon-button notification-button"
              aria-label="View support reminders"
            >
              <Bell size={19} />
            </Link>
            <Link to="/settings" aria-label="Your account">
              <Avatar name={user.name} />
            </Link>
          </div>
        </header>
        <main id="main" className="page-content">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/students/:id" element={<ProfilePage />} />
            <Route path="/imports" element={<ImportsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/model" element={<ModelPage />} />
            <Route path="/interventions" element={<InterventionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route
              path="*"
              element={
                <div className="state-card">
                  <h1>Page not found</h1>
                  <Link className="button primary" to="/">
                    Return to overview
                  </Link>
                </div>
              }
            />
          </Routes>
        </main>
        <footer className="workspace-footer">
          <span>
            CONTINUUM <span className="footer-divider">/</span> Student success
            workspace
          </span>
          <span>Designed for supportive, human-led decisions</span>
        </footer>
      </div>
    </div>
  );
}

function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    api<{ user: User; csrf: string }>("/auth/me")
      .then((r) => {
        setUser(r.user);
        setCsrf(r.csrf);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    const handler = () => {
      setUser(null);
      setCsrf("");
      setExpired(true);
    };
    window.addEventListener("session-expired", handler);
    return () => window.removeEventListener("session-expired", handler);
  }, []);
  if (loading)
    return (
      <div className="boot-screen">
        <Brand />
        <span className="loading-dot" />
        <p>Opening your workspace</p>
      </div>
    );
  if (!user)
    return (
      <>
        {expired && (
          <div className="session-banner" role="status">
            Your session ended. Sign in to continue.
          </div>
        )}
        <Login
          onLogin={(u) => {
            setUser(u);
            setExpired(false);
          }}
        />
      </>
    );
  return (
    <AuthContext.Provider
      value={{
        user,
        expire: () => {
          setUser(null);
          setCsrf("");
        },
        logout: async () => {
          await api("/auth/logout", { method: "POST" });
          navigate("/");
          setCsrf("");
          setUser(null);
        },
      }}
    >
      {user.role === "student" ? <StudentPortal /> : <Shell />}
    </AuthContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
