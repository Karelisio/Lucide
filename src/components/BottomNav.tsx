import { NavLink } from "react-router-dom";
import { Icon, type IconName } from "./Icon";

const items: Array<{ to: string; label: string; icon: IconName }> = [
  { to: "/", label: "Journal", icon: "home" },
  { to: "/dreams", label: "Rêves", icon: "list" },
  { to: "/stats", label: "Stats", icon: "chart" },
  { to: "/settings", label: "Réglages", icon: "settings" },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) => `bottom-nav-item${isActive ? " active" : ""}`}
        >
          <span className="pill">
            <Icon name={item.icon} size={22} />
          </span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
