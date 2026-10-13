// Interface stub: lane L2 replaces the body, never the signature.
export interface ThreeStageProps { src: string; label: string; loop?: boolean; thumb?: string; className?: string }
export function ThreeStage({ label, thumb, className }: ThreeStageProps) {
  return thumb ? <img className={className} src={thumb} alt={label} /> : <div className={className} role="img" aria-label={label} />;
}
