import { NavLink, Outlet, useLocation } from "react-router-dom";

type NavItem = {
  to: string;
  label: string;
  match: (pathname: string) => boolean;
};

const findItems: NavItem[] = [
  {
    to: "/discover",
    label: "Find a tool",
    match: (pathname) => pathname === "/discover" || pathname.startsWith("/discover/tools"),
  },
];

const developerItems: NavItem[] = [
  {
    to: "/publish",
    label: "Publish a tool",
    match: (pathname) => pathname.startsWith("/publish"),
  },
];

const platformItems: NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    match: (pathname) => pathname.startsWith("/dashboard"),
  },
];

const persona = { name: "Jordan Lee", role: "Platform engineering" };

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  const { pathname } = useLocation();

  return (
    <div>
      <div className="nav-label">{label}</div>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={() => (item.match(pathname) ? "nav-link active" : "nav-link")}
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

export function AppShell() {
  return (
    <div className="app">
      <aside className="sidebar">
        <NavLink to="/discover" className="brand" aria-label="Gerson">
          <img className="brand-mark" src="/logo-mark.png" alt="" />
          <img className="brand-name" src="/logo-word.png" alt="Gerson" />
        </NavLink>

        <NavGroup label="Find a tool" items={findItems} />
        <NavGroup label="Developer" items={developerItems} />
        <NavGroup label="Platform" items={platformItems} />

        <div className="sidebar-user">
          <div className="avatar" aria-hidden="true">
            {initials(persona.name)}
          </div>
          <div>
            <div className="user-name">{persona.name}</div>
            <div className="user-role">{persona.role}</div>
          </div>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
