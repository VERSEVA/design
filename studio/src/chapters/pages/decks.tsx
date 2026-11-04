// Ported from site/decks.html (frozen): same copy, same specimens, same anchors.
import { NativeChapter } from '../NativeChapter';

/* sha256 of site/decks.html; the parity test fails if the frozen page changes. */
export const FROZEN = '56cae7239d8e68092e66ee3b7c748fdb19eb3b67ba152d74fb4c070bd880eb36';

export function Page() {
  return (
    <NativeChapter slug="decks">
      <section className="hero">
        <h1>Decks</h1>
      </section>
      <section className="ch" id="slide-anatomy">
        <h2>Slide anatomy</h2>
        <div className="slide-mock">
          <div className="kick">THE ANSWER</div>
          <h3>One claim, stated as a verdict</h3>
          <p>One supporting line. Evidence, not adjectives; a number beats a claim.</p>
        </div>
      </section>
      <section className="ch" id="structure">
        <h2>Structure</h2>
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
      </section>
      <footer className="site">
        <span>VERSEVA · open source · MIT</span>
        {' '}
        <span className="badge-line">Built on VERSEVA Design</span>
      </footer>
    </NativeChapter>
  );
}
