import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Coffee,
  CircleDot,
  Pencil,
  X,
  type LucideIcon,
} from "lucide-react";
import { APP_NAME, type Meal, type Nutrition } from "./domain";

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "small" : ""}`}>
      <span className="brand-symbol">
        <CircleDot size={small ? 20 : 25} strokeWidth={1.7} />
      </span>
      {APP_NAME}
      <span className="brand-dot">.</span>
    </span>
  );
}
export function IconTile({
  icon: Icon,
  tone = "green",
  small = false,
}: {
  icon: LucideIcon;
  tone?: string;
  small?: boolean;
}) {
  return (
    <span className={`icon-tile ${tone} ${small ? "small" : ""}`}>
      <Icon size={small ? 19 : 24} strokeWidth={1.7} />
    </span>
  );
}
export function SectionHeading({
  title,
  action,
  onClick,
}: {
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {action && (
        <button className="text-button" onClick={onClick}>
          {action}
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
export function NutritionSummary({
  totals,
  goals,
  compact = false,
}: {
  totals: Nutrition;
  goals: Nutrition;
  compact?: boolean;
}) {
  const remaining = goals.calories - totals.calories;
  const progress = Math.min(totals.calories / goals.calories, 1);
  return (
    <div className={`nutrition-summary ${compact ? "compact" : ""}`}>
      <div className="calorie-ring">
        <svg viewBox="0 0 180 180" aria-hidden="true">
          <circle className="ring-track" cx="90" cy="90" r="77" />
          <circle
            className="ring-value"
            cx="90"
            cy="90"
            r="77"
            strokeDasharray={`${progress * 484} 484`}
          />
        </svg>
        <div className="ring-label">
          <span className="eyebrow">CALORIES</span>
          <strong>{totals.calories.toLocaleString()}</strong>
          <span>of {goals.calories.toLocaleString()} cal</span>
        </div>
      </div>
      <div className="macros">
        <div className="remaining">
          <strong>{Math.abs(remaining).toLocaleString()}</strong> calories{" "}
          {remaining >= 0 ? "left today" : "above target"}
        </div>
        {(["protein", "carbs", "fat"] as const).map((key) => (
          <div className={`macro ${key}`} key={key}>
            <div className="macro-label">
              <span>
                <i />
                {key === "fat" ? "Fats" : key[0].toUpperCase() + key.slice(1)}
              </span>
              <span>
                <b>{totals[key]}g</b> / {goals[key]}g
              </span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label={key}
              aria-valuenow={totals[key]}
              aria-valuemin={0}
              aria-valuemax={Math.max(goals[key], totals[key])}
            >
              <span
                style={{
                  width: `${Math.min((totals[key] / goals[key]) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export function MealRow({
  meal,
  onEdit,
}: {
  meal: Meal;
  onEdit: (meal: Meal) => void;
}) {
  return (
    <button
      className="meal-row"
      onClick={() => onEdit(meal)}
      aria-label={`Edit ${meal.title}`}
    >
      {meal.image ? (
        <img src={meal.image} alt="" />
      ) : (
        <IconTile icon={Coffee} tone="sand" />
      )}
      <span className="meal-description">
        <span className="meal-meta">
          {meal.category} <span>·</span> {meal.time}
        </span>
        <strong>{meal.title}</strong>
        <span className="meal-source">
          <Check size={12} />{" "}
          {meal.confidence === "confirmed"
            ? "Updated by you"
            : "Estimated · editable"}
        </span>
      </span>
      <span className="meal-nutrition">
        <strong>
          {meal.confidence === "estimated" ? "~" : ""}
          {meal.calories} <small>cal</small>
        </strong>
        <span>{meal.protein}g protein</span>
      </span>
      <Pencil className="meal-edit" size={15} />
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      aria-label={title}
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function InsightCard({
  icon: Icon,
  tone,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button className="insight-card" onClick={onClick}>
      <IconTile icon={Icon} tone={tone} />
      <span>
        <strong>{title}</strong>
        <p>{description}</p>
      </span>
      <ArrowUpRight size={19} />
    </button>
  );
}
