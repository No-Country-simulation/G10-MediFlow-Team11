import { useId } from 'react';
import { AlignLeft, Check, FileText, Image, ShieldCheck, Tag, UserRound } from 'lucide-react';

function WorkflowScene({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const width = compact ? 360 : 520;
  const height = compact ? 250 : 400;
  const paper = compact ? { x: 126, y: 42, w: 108, h: 134 } : { x: 170, y: 78, w: 150, h: 194 };
  const inputX = compact ? 22 : 24;
  const inputW = compact ? 42 : 126;
  const outputX = compact ? 296 : 340;
  const outputW = compact ? 42 : 164;
  const rowH = compact ? 40 : 48;
  const firstY = compact ? 48 : 98;
  const rowGap = compact ? 47 : 56;
  const review = compact ? { x: 82, y: 196, w: 212, h: 44 } : { x: 112, y: 304, w: 284, h: 66 };
  const inputs = [{ label: 'PDF', icon: FileText }, { label: 'JPG / PNG', icon: Image }, { label: 'Texto clínico', icon: AlignLeft }];
  const outputs = [{ label: 'Datos extraídos', icon: FileText }, { label: 'Clasificación', icon: Tag }, { label: 'Validación IA', icon: Check }];

  return (
    <svg className={compact ? 'home-page__workflow-mobile' : 'home-page__workflow-desktop'} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-halo`}>
          <stop stopColor="var(--home-page-workflow-halo)" stopOpacity="0.7" />
          <stop offset="1" stopColor="var(--home-page-workflow-halo)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-paper`} x2="0.8" y2="1">
          <stop stopColor="var(--home-page-workflow-paper-top)" />
          <stop offset="1" stopColor="var(--home-page-workflow-paper-bottom)" />
        </linearGradient>
        <linearGradient id={`${id}-blue`} x2="1" y2="1">
          <stop stopColor="#51c5ff" /><stop offset="1" stopColor="#006cff" />
        </linearGradient>
        <marker id={`${id}-arrow`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="m1 1 5 3-5 3" fill="none" stroke="var(--home-page-workflow-connector)" strokeWidth="1.5" />
        </marker>
      </defs>

      <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill={`url(#${id}-halo)`} />
      <g fill="none" stroke="var(--home-page-workflow-orbit)" strokeWidth="1">
        <ellipse cx={width / 2} cy={height / 2} rx={width * 0.43} ry={height * 0.44} transform={`rotate(-22 ${width / 2} ${height / 2})`} />
        <path d={compact ? 'M53 29C130 0 301 9 313 116S246 243 149 218' : 'M54 74C172-12 390 3 429 142S431 344 324 363'} strokeDasharray="3 5" />
      </g>
      <g fill="var(--home-page-workflow-blue)">
        <circle cx={width * 0.12} cy={height * 0.18} r={compact ? 3 : 6} />
        <circle cx={width * 0.39} cy={height * 0.06} r={compact ? 3 : 5} />
        <circle cx={width * 0.87} cy={height * 0.73} r={compact ? 4 : 7} />
        <circle cx={width * 0.2} cy={height * 0.75} r={compact ? 3 : 5} />
        <circle cx={width * 0.64} cy={height * 0.055} r={compact ? 4 : 7} fill="#24c9bc" />
      </g>

      <g fill="none" stroke="var(--home-page-workflow-connector)" strokeWidth="1.7" strokeDasharray={compact ? '3 3' : undefined}>
        {inputs.map(({ label }, i) => {
          const y = firstY + i * rowGap + rowH / 2;
          return <path key={label} d={`M${inputX + inputW} ${y} H${paper.x - 20} Q${paper.x - 8} ${y} ${paper.x - 8} ${paper.y + paper.h / 2} H${paper.x - 2}`} markerEnd={`url(#${id}-arrow)`} />;
        })}
        {outputs.map(({ label }, i) => {
          const y = firstY + i * rowGap + rowH / 2;
          return <path key={label} d={`M${paper.x + paper.w} ${paper.y + paper.h / 2} H${outputX - 20} Q${outputX - 10} ${paper.y + paper.h / 2} ${outputX - 10} ${y} H${outputX - 2}`} markerEnd={`url(#${id}-arrow)`} />;
        })}
        <path d={`M${paper.x + paper.w / 2} ${paper.y + paper.h - 8} V${review.y - 6}`} strokeDasharray="4 4" markerEnd={`url(#${id}-arrow)`} />
      </g>

      {inputs.map(({ label, icon: Icon }, i) => (
        <g key={label} transform={`translate(${inputX} ${firstY + i * rowGap})`}>
          <rect className="home-page__workflow-card" width={inputW} height={rowH} rx="12" />
          <Icon x={compact ? 10 : 15} y={compact ? 9 : 13} width="22" height="22" color="var(--home-page-workflow-blue)" strokeWidth="2" />
          {!compact && <text x="45" y="29" className="home-page__workflow-label">{label}</text>}
        </g>
      ))}
      {outputs.map(({ label, icon: Icon }, i) => (
        <g key={label} transform={`translate(${outputX} ${firstY + i * rowGap})`}>
          <rect className="home-page__workflow-card" width={outputW} height={rowH} rx="12" />
          {i === 2 && <circle cx={compact ? 21 : 25} cy={rowH / 2} r="13" fill="#00adca" />}
          <Icon x={compact ? 10 : 14} y={(rowH - 22) / 2} width="22" height="22" color={i === 2 ? '#ffffff' : i === 1 ? '#00adc6' : 'var(--home-page-workflow-blue)'} strokeWidth="2" />
          {!compact && <text x="49" y="29" className="home-page__workflow-label">{label}</text>}
        </g>
      ))}

      <g transform={`translate(${paper.x} ${paper.y})`}>
        <path className="home-page__workflow-paper" d={`M16 0H${paper.w - 40}L${paper.w} 40V${paper.h - 16}Q${paper.w} ${paper.h} ${paper.w - 16} ${paper.h}H16Q0 ${paper.h} 0 ${paper.h - 16}V16Q0 0 16 0Z`} fill={`url(#${id}-paper)`} />
        <path d={`M${paper.w - 40} 1V28Q${paper.w - 40} 40 ${paper.w - 28} 40H${paper.w - 1}`} fill="var(--home-page-workflow-fold)" stroke="var(--home-page-workflow-paper-border)" />
        <g transform={`translate(${compact ? 18 : 26} ${compact ? 22 : 27}) scale(${compact ? 0.7 : 1})`}>
          <path d="M4 0H24L36 12V34Q36 38 32 38H4Q0 38 0 34V4Q0 0 4 0Z" fill={`url(#${id}-blue)`} />
          <path d="M24 0V12H36" fill="#9edfff" />
          <path d="M18 12V29M10 20.5H26" stroke="white" strokeWidth="7" strokeLinecap="round" />
        </g>
        {[0, 1, 2, 3].map(i => <rect key={i} x={compact ? 18 : 26} y={(compact ? 67 : 83) + i * (compact ? 13 : 18)} width={(compact ? 72 : 103) * (i === 3 ? 0.62 : 1)} height={compact ? 5 : 7} rx="3.5" fill="var(--home-page-workflow-lines)" />)}
      </g>

      <g transform={`translate(${review.x} ${review.y})`}>
        <rect className="home-page__workflow-card" width={review.w} height={review.h} rx={review.h / 2} />
        <circle cx={compact ? 25 : 36} cy={review.h / 2} r={compact ? 17 : 24} fill="var(--home-page-icon)" />
        <UserRound x={compact ? 12 : 18} y={compact ? 9 : 15} width={compact ? 26 : 36} height={compact ? 26 : 36} color="var(--home-page-workflow-blue)" strokeWidth="1.8" />
        <text x={compact ? 49 : 73} y={compact ? 19 : 29} className="home-page__workflow-review">Revisión humana</text>
        <text x={compact ? 49 : 73} y={compact ? 33 : 48} className="home-page__workflow-caption">cuando corresponde</text>
        <circle cx={review.w - 4} cy={review.h / 2} r={compact ? 22 : 30} fill="#0077ff" stroke="#4dbdff" />
        <ShieldCheck x={review.w - (compact ? 17 : 21)} y={compact ? 9 : 16} width={compact ? 26 : 34} height={compact ? 26 : 34} color="white" strokeWidth="1.9" />
      </g>
    </svg>
  );
}

export function ClinicalWorkflowIllustration() {
  return (
    <div className="home-page__illustration" role="img" aria-label="PDF, imágenes y texto clínico se transforman en datos extraídos, clasificación y validación; con revisión humana cuando corresponde.">
      <WorkflowScene />
      <WorkflowScene compact />
    </div>
  );
}
