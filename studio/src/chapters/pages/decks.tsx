// Decks: every specimen as a studio tile (1.7.0 redesign), in the /widgets language.
// The slide and the structure table are the frozen site/decks.html content; the tiles are new.
// The page has no generated code samples, so the tiles carry no Show code.
import { NativeChapter } from '../NativeChapter';
import { SpecimenGrid, SpecimenTile, tileIcon } from '../../tiles/SpecimenTile';

/* One header icon per category. */
const ICON = {
  slide: tileIcon(<><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M12 17v3M8 20h8" /></>),
  table: tileIcon(<><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 10h16M10 10v9" /></>),
};

export function Page() {
  return (
    <NativeChapter slug="decks">
      <section className="hero">
        <h1>Decks</h1>
      </section>
      <SpecimenGrid>
        <SpecimenTile id="slide-anatomy" name="Slide anatomy" icon={ICON.slide} size="m" meta="3 parts">
          <div className="slide-mock">
            <div className="kick">THE ANSWER</div>
            <h3>One claim, stated as a verdict</h3>
            <p>One supporting line. Evidence, not adjectives; a number beats a claim.</p>
          </div>
        </SpecimenTile>
        <SpecimenTile id="structure" name="Structure" icon={ICON.table} size="m" meta="5 beats">
          <div className="tscroll">
            <table className="ttable">
              <thead>
                <tr>
                  <th>Beat</th>
                  <th>Slide job</th>
                  <th>Kicker</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>open</td>
                  <td>The claim the deck exists to make, plus stakes</td>
                  <td>the deck title</td>
                </tr>
                <tr>
                  <td>situation</td>
                  <td>One true thing the room already agrees with</td>
                  <td>THE SITUATION</td>
                </tr>
                <tr>
                  <td>complication</td>
                  <td>What changed; what breaks if nothing is done</td>
                  <td>THE TURN</td>
                </tr>
                <tr>
                  <td>resolution</td>
                  <td>Your answer in one line, then supports</td>
                  <td>THE ANSWER</td>
                </tr>
                <tr>
                  <td>ask</td>
                  <td>What you want decided, by whom, by when</td>
                  <td>NEXT</td>
                </tr>
              </tbody>
            </table>
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
