import { SpotAvatar, SpotLean } from "./features/spot/Spot";
import {
  BarChart3,
  Dumbbell,
  ScanBarcode,
  CookingPot,
  Menu,
  UserRound,
} from "lucide-react";
import { APP_NAME, type Page } from "./domain";

export function FuelHeader({
  isHome = false,
  profileActive = false,
  menuLabel,
  onHome,
  onMenu,
  onNutrition,
  onProfile,
}: {
  isHome?: boolean;
  profileActive?: boolean;
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
      <button
        className="fuel-wordmark"
        aria-label="Rep & Plate home"
        onClick={onHome}
      >
        {isHome ? (
          <h1>
            <span className="spot-wordmark-text">
              {APP_NAME}
              <SpotLean />
            </span>
          </h1>
        ) : (
          <span className="fuel-logo-text">
            <span className="spot-wordmark-text">
              {APP_NAME}
              <SpotLean />
            </span>
          </span>
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
          aria-current={profileActive ? "page" : undefined}
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
  onScan,
  onCapture,
}: {
  active: "Chat" | "Nutrition" | "Workouts" | "Kitchen" | "You";
  onNavigate: (page: Page) => void;
  onScan: () => void;
  onCapture?: () => void;
}) {
  return (
    <nav className="fuel-tabs" aria-label={`${active} navigation`}>
      {[
        { name: "Chat" as const, icon: ScanBarcode },
        { name: "Nutrition" as const, icon: BarChart3 },
        { name: "Scan" as const, icon: ScanBarcode },
        { name: "Workouts" as const, icon: Dumbbell },
        { name: "Kitchen" as const, icon: CookingPot },
      ].map(({ name, icon: Icon }) =>
        name === "Scan" ? (
          <button
            key={name}
            type="button"
            className="fuel-tab-scan"
            aria-label="Scan a barcode"
            onClick={onScan}
          >
            <span className="fuel-tab-scan-icon">
              <ScanBarcode size={25} aria-hidden="true" />
            </span>
            <span>Scan</span>
          </button>
        ) : (
          <button
            key={name}
            className={name === active ? "selected" : ""}
            aria-current={name === active ? "page" : undefined}
            onClick={() => {
              if (name === "Chat" && onCapture) onCapture();
              else onNavigate(name);
            }}
          >
            {name === "Chat" ? (
              <span className="fuel-chat-spot-icon">
                <SpotAvatar size={34} expression="welcome" />
              </span>
            ) : (
              <Icon
                size={25}
                strokeWidth={name === "Nutrition" ? 3 : 2.4}
                aria-hidden="true"
              />
            )}
            <span>{name}</span>
          </button>
        ),
      )}
    </nav>
  );
}
