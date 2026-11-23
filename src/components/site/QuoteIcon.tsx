/* The icon at the end of a "Request a quotation" button: the arrow at rest. Pointed at, or reached with the keyboard, the
   arrow leaves to the right and a parcel rises into its place (site.css, "the quotation buttons' parcel"). It takes the
   place of the drawn arrow (.m-arrow) on those buttons only. */
export function QuoteIcon() {
  return (
    <span className="qicon" aria-hidden="true">
      <svg className="qicon__arrow" viewBox="0 0 12 12"><path d="M4.5 2.5 8 6l-3.5 3.5" /></svg>
      <svg className="qicon__parcel" viewBox="0 0 12 12"><path d="M6 1l5 2.5v5L6 11 1 8.5v-5z" /><path d="M1 3.5 6 6l5-2.5M6 6v5M3.5 2.25l5 2.5" /></svg>
    </span>
  );
}
