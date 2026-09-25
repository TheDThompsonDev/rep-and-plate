import { BarChart3, Dumbbell, Home, Menu, UserRound } from "lucide-react";
import { APP_NAME, type Page } from "./domain";

export function FuelHeader({
  isHome = false,
  menuLabel,
  onHome,
  onMenu,
  onNutrition,
  onProfile,
}: {
  isHome?: boolean;
  menuLabel?: string;
  onHome: () => void;
  onMenu: () => void;
  onNutrition: () => void;
  onProfile: () => void;
}) {
  return (
    <header className="fuel-header">
      <button
        className="fuel-icon menu-trigger"
        aria-label={
          menuLabel ?? (isHome ? "Open chat menu" : "Open nutrition menu")
        }
        onClick={onMenu}
      >
        <Menu size={27} strokeWidth={1.8} />
      </button>
      <button className="fuel-wordmark" aria-label="Fuel home" onClick={onHome}>
        {isHome ? (
          <h1>{APP_NAME}</h1>
        ) : (
          <span className="fuel-logo-text">{APP_NAME}</span>
        )}
      </button>
      <div className="fuel-header-actions">
        <button
          className="fuel-icon"
          aria-label="Today’s nutrition in chat"
          onClick={onNutrition}
        >
          <BarChart3 size={23} strokeWidth={3} />
        </button>
        <button
          className="fuel-profile"
          aria-label="Your profile"
          onClick={onProfile}
        >
          <UserRound size={21} strokeWidth={2.5} />
        </button>
      </div>
    </header>
  );
}

export function FuelTabs({
  active,
  onNavigate,
  onProfile,
}: {
  active: "Chat" | "Nutrition" | "Workouts" | "You";
  onNavigate: (page: Page) => void;
  onProfile: () => void;
}) {
  return (
    <nav className="fuel-tabs" aria-label={`${active} navigation`}>
      {[
        { name: "Chat" as const, icon: Home },
        { name: "Nutrition" as const, icon: BarChart3 },
        { name: "Workouts" as const, icon: Dumbbell },
      ].map(({ name, icon: Icon }) => (
        <button
          key={name}
          className={name === active ? "selected" : ""}
          aria-current={name === active ? "page" : undefined}
          onClick={() => onNavigate(name)}
        >
          <Icon
            size={25}
            fill={name === "Chat" ? "currentColor" : "none"}
            strokeWidth={name === "Nutrition" ? 3 : name === "Chat" ? 1.5 : 2.4}
          />
          <span>{name}</span>
        </button>
      ))}
      <button
        onClick={onProfile}
        className={active === "You" ? "selected" : ""}
        aria-current={active === "You" ? "page" : undefined}
      >
        <UserRound size={25} fill="currentColor" strokeWidth={1.5} />
        <span>You</span>
      </button>
    </nav>
  );
}
