export function Vendor({ rows }: { rows: string[] }) {
  return (
    <section>
      {/* recipe-ok: vendor widget, markup fixed by the embed */}
      <button className="px-4 py-2" type="button">Vendor</button>
      <table
        // recipe-ok: print-only ledger
        className="w-full text-sm"
      >
        <tbody>{rows.map((r) => <tr key={r}><td>{r}</td></tr>)}</tbody>
      </table>
      <button className="px-4 py-2" type="button">Not waived</button>
    </section>
  );
}
