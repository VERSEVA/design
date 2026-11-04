// Docs + PDF: the memo specimen as a studio tile (1.7.0 redesign), in the /widgets language.
// The memo is the frozen site/docs-pdf.html content; the tile around it is new.
// The page has no generated code samples, so the tile carries no Show code.
import { NativeChapter } from '../NativeChapter';
import { SpecimenGrid, SpecimenTile, tileIcon } from '../../tiles/SpecimenTile';

const DOC = tileIcon(<><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>);

export function Page() {
  return (
    <NativeChapter slug="docs-pdf">
      <section className="hero">
        <h1>Docs + PDF</h1>
      </section>
      <SpecimenGrid>
        <SpecimenTile id="memo-anatomy" name="Memo anatomy" icon={DOC} size="xl" meta="4 parts">
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
        </SpecimenTile>
      </SpecimenGrid>
      <footer className="site">
        <span>VERSEVA · open source · MIT</span>
        {' '}
        <span className="badge-line">Built on VERSEVA Design</span>
      </footer>
    </NativeChapter>
  );
}
