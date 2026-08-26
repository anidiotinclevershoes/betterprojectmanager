import React from "react";

function SidebarLink({
  active,
  icon,
  label,
}: {
  active?: boolean;
  icon: string;
  label: string;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.82rem] ${
        active
          ? "bg-[rgba(108,140,255,0.12)] font-semibold text-[var(--text-primary)]"
          : "text-[var(--text-secondary)]"
      }`}
    >
      <span className="w-4 text-center text-[0.9rem]" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
    </div>
  );
}

/** Approved Ocean navigation — unchanged. */
export function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)]">
      <div className="px-3.5 pb-2 pt-4">
        <div className="text-[1.35rem] font-semibold lowercase tracking-tight">
          lu<span className="font-bold text-[#c9d4ff]">me</span>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        <div className="flex items-center justify-between px-2 pb-1 pt-0.5">
          <p className="m-0 text-[0.68rem] font-semibold tracking-wider text-[var(--text-muted)]">
            PROJECTS
          </p>
          <span className="text-[0.75rem] font-semibold text-[#35b97f]">+ New Project</span>
        </div>
        <SidebarLink active icon="A" label="Atlas Platform Modernisation" />
        <SidebarLink icon="H" label="Horizon Customer Portal" />
        <SidebarLink icon="R" label="Monthly Release Operations" />
        <div className="my-2" />
        <SidebarLink icon="✓" label="Master To Do" />
        <SidebarLink icon="⏱" label="History" />
        <SidebarLink icon="⎚" label="Captures" />
      </nav>
      <div className="border-t border-[var(--border-subtle)] p-2">
        <SidebarLink icon="◉" label="Tom" />
        <SidebarLink icon="?" label="Help & support" />
        <SidebarLink icon="«" label="Collapse" />
      </div>
    </aside>
  );
}
