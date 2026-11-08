/** Cohete en el cielo verde de marca: es decorativo, el aviso lo dice el texto. */
export function RocketArt() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 112"
      className="h-28 w-full"
      preserveAspectRatio="xMidYMax slice"
    >
      <circle cx="46" cy="30" r="2.5" fill="currentColor" opacity=".7" />
      <circle cx="268" cy="22" r="2" fill="currentColor" opacity=".7" />
      <circle cx="238" cy="62" r="3" fill="currentColor" opacity=".5" />
      <circle cx="84" cy="64" r="2" fill="currentColor" opacity=".5" />
      {/* estela */}
      <rect x="153" y="78" width="14" height="34" rx="7" fill="currentColor" opacity=".35" />
      {/* cuerpo */}
      <path
        d="M160 8c14 12 22 30 22 52v14h-44V60c0-22 8-40 22-52Z"
        fill="#fff"
      />
      <path d="M138 62l-14 18 14-2ZM182 62l14 18-14-2Z" fill="#fff" />
      <circle cx="160" cy="46" r="9" className="fill-primary" />
      {/* nubes */}
      <g fill="#fff" className="text-background">
        <circle cx="40" cy="116" r="30" opacity=".95" />
        <circle cx="86" cy="120" r="24" opacity=".9" />
        <circle cx="240" cy="120" r="26" opacity=".9" />
        <circle cx="286" cy="114" r="32" opacity=".95" />
      </g>
    </svg>
  );
}
