// Distribute: every specimen as a studio tile (1.7.0 redesign), in the /widgets language.
// The commands and the tool table are the frozen site/distribute.html content; the tiles are new.
// The page has no generated code samples, so the tiles carry no Show code.
import { NativeChapter } from '../NativeChapter';
import { SpecimenGrid, SpecimenTile, tileIcon } from '../../tiles/SpecimenTile';
import './distribute.css';

/* One header icon per category. */
const ICON = {
  cli: tileIcon(<><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m7 9 3 3-3 3M13 15h4" /></>),
  theme: tileIcon(<><circle cx="12" cy="12" r="8" /><path d="M12 4v16" /></>),
};

export function Page() {
  return (
    <NativeChapter slug="distribute">
      <section className="hero">
        <h1>Distribute</h1>
      </section>
      <SpecimenGrid>
        <SpecimenTile id="source-distribution" name="Source distribution" icon={ICON.cli} size="m" meta="5 commands">
          <pre className="cmd">{"npx verseva init\nnpx verseva add button field toast console-nav\nnpx verseva block add quote-tool\nnpx verseva theme add cobalt\nnpx verseva list"}</pre>
        </SpecimenTile>
        <SpecimenTile id="registries" name="Registries" icon={ICON.cli} size="m" meta="25 items">
          <pre className="cmd">{"npx verseva build\nverseva build: 25 items + registry.json -> site/r"}</pre>
        </SpecimenTile>
        <SpecimenTile id="agents" name="Agents" icon={ICON.cli} size="xl" meta="5 tools">
          <pre className="cmd">{"npx verseva mcp init --client claude"}</pre>
          <div className="tscroll">
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
        </SpecimenTile>
        <SpecimenTile id="theme-presets" name="Theme presets" icon={ICON.theme} size="xl" meta="4 presets">
          <div className="demo">
            <span className="badge ok">cobalt · 64 pairs proven</span>
            <span className="badge ok">forest · 64 pairs proven</span>
            <span className="badge ok">violet · 64 pairs proven</span>
            <span className="badge ok">slate · 64 pairs proven</span>
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
