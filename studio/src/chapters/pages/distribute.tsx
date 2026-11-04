// Ported from site/distribute.html (frozen): same copy, same specimens, same anchors.
import { NativeChapter } from '../NativeChapter';

/* sha256 of site/distribute.html; the parity test fails if the frozen page changes. */
export const FROZEN = '5c964df6da7a61bceda5c1ecbf4ffd45b0811e5259b9f938fadb2f468f1be824';

export function Page() {
  return (
    <NativeChapter slug="distribute">
      <section className="hero">
        <h1>Distribute</h1>
      </section>
      <section className="ch" id="source-distribution">
        <h2>Source distribution</h2>
        <pre className="cmd">{"npx verseva init\nnpx verseva add button field toast console-nav\nnpx verseva block add quote-tool\nnpx verseva theme add cobalt\nnpx verseva list"}</pre>
      </section>
      <section className="ch" id="registries">
        <h2>Registries</h2>
        <pre className="cmd">{"npx verseva build\nverseva build: 25 items + registry.json -> site/r"}</pre>
      </section>
      <section className="ch" id="agents">
        <h2>Agents</h2>
        <pre className="cmd">{"npx verseva mcp init --client claude"}</pre>
        <div className="tscroll pad-top">
          <table className="ttable">
            <thead>
              <tr>
                <th>Tool</th>
                <th>What the agent gets</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>list_registry</td>
                <td>Everything installable</td>
              </tr>
              <tr>
                <td>get_component / get_block</td>
                <td>Real source, read before imitating</td>
              </tr>
              <tr>
                <td>get_tokens / get_laws</td>
                <td>Every allowed value; the fourteen laws</td>
              </tr>
              <tr>
                <td>add_component</td>
                <td>Installs source into the project, deps resolved</td>
              </tr>
              <tr>
                <td>run_gate</td>
                <td>Runs all four gates and returns the verdict: done means proven</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="ch" id="theme-presets">
        <h2>Theme presets</h2>
        <div className="spec">
          <span className="badge ok">cobalt · 64 pairs proven</span>
          {' '}
          <span className="badge ok">forest · 64 pairs proven</span>
          {' '}
          <span className="badge ok">violet · 64 pairs proven</span>
          {' '}
          <span className="badge ok">slate · 64 pairs proven</span>
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
