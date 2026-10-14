export function AmbientParticles() {
  return <div className="ambient-particles" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>;
}