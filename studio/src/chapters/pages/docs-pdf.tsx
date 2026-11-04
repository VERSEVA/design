// Ported from site/docs-pdf.html (frozen): same copy, same specimens, same anchors.
import { NativeChapter } from '../NativeChapter';

/* sha256 of site/docs-pdf.html; the parity test fails if the frozen page changes. */
export const FROZEN = '3f544d6d940e30c97a3ea217f2a0cedc06a14553cf891760451c818ccab70376';

export function Page() {
  return (
    <NativeChapter slug="docs-pdf">
      <section className="hero">
        <h1>Docs + PDF</h1>
      </section>
      <section className="ch" id="memo-anatomy">
        <h2>Memo anatomy</h2>
        <div className="doc-mock">
          <div className="meta">
            <span>VERSEVA</span>
            <span>2026-08-31</span>
            <span>Author</span>
          </div>
          <h3>Say the decision in the title</h3>
          <p>Open with the verdict. The reader knows the recommendation before the first scroll; everything after is support.</p>
          <div className="callout"><b>Recommendation.</b>{" Which option, the one reason that carries it, and what would change your mind."}</div>
        </div>
      </section>
      <footer className="site">
        <span>VERSEVA · open source · MIT</span>
        {' '}
        <span className="badge-line">Built on VERSEVA Design</span>
      </footer>
    </NativeChapter>
  );
}
