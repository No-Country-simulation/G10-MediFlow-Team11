import type { ReactNode } from 'react';

function IconFrame({ children }: { children: ReactNode }) {
  return (
    <svg
      className="home-page__capability-icon"
      width="30"
      height="30"
      viewBox="0 0 32 32"
      fill="none"
      stroke="var(--home-page-capability-blue)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function ClinicalProcessingIcon() {
  return (
    <IconFrame>
      <path d="M7 3h12l7 7v17a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="var(--home-page-capability-tint)" />
      <path d="M19 3v7h7" fill="var(--home-page-capability-core)" stroke="var(--home-page-capability-cyan)" />
      <path d="M11 10v6m-3-3h6" />
      <path d="M17 14h4" stroke="var(--home-page-capability-cyan)" />
      <g fill="var(--home-page-capability-cyan)" stroke="none">
        <rect x="9" y="19" width="3" height="3" rx="0.8" />
        <rect x="9" y="24" width="3" height="2" rx="0.8" />
      </g>
      <path d="M15 20.5h7m-7 4.5h5" />
    </IconFrame>
  );
}

export function ClinicalReviewIcon() {
  return (
    <IconFrame>
      <circle cx="12" cy="9" r="5" fill="var(--home-page-capability-tint)" />
      <path d="M3 28v-3a9 9 0 0 1 18 0v3" fill="var(--home-page-capability-tint)" />
      <path d="m24 15 6 2v5c0 3.5-2.5 5.8-6 8-3.5-2.2-6-4.5-6-8v-5l6-2Z" fill="var(--home-page-capability-cyan)" stroke="var(--home-page-capability-cyan)" />
      <path d="m21 22 2.2 2.2L27 20" stroke="var(--home-page-capability-core)" />
    </IconFrame>
  );
}

export function ClinicalTraceabilityIcon() {
  return (
    <IconFrame>
      <path d="M16 11v4L7 25h18l-9-10" stroke="var(--home-page-capability-cyan)" />
      <circle cx="16" cy="7" r="4.5" fill="var(--home-page-capability-blue)" />
      <circle cx="7" cy="25" r="4.5" fill="var(--home-page-capability-blue)" />
      <circle cx="25" cy="25" r="4.5" fill="var(--home-page-capability-blue)" />
      <g fill="var(--home-page-capability-core)" stroke="none">
        <circle cx="16" cy="7" r="1.5" />
        <circle cx="7" cy="25" r="1.5" />
        <circle cx="25" cy="25" r="1.5" />
      </g>
    </IconFrame>
  );
}
