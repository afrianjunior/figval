/** Logo A (design/logo-proposals/figval-logo-a.figcraft). Fixed brand colours, not theme tokens. */
export function Logo({ size = 56 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true" focusable="false">
      <path
        fill="#0A62E0"
        d="M40 16H88A24 24 0 0 1 112 40V80A24 24 0 0 1 88 104H22A6 6 0 0 1 16 98V40A24 24 0 0 1 40 16Z"
      />
      <path fill="#FFF4E0" d="M48 36V82L60 71L68 88L76 84L68 67L84 66Z" />
      <circle cx="104" cy="24" r="14" fill="#FFB020" />
    </svg>
  );
}
