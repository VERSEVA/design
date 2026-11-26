// <button>an old line comment</button>
/* <table><tbody /></table> an old block comment */
/**
 * Usage: <input />
 */
const inString = "<button>in a string</button>";
const inSingle = '<select></select>';
const inTemplate = `<dialog>in a template</dialog>`;
const url = 'https://example.test/a'; // <textarea /> after a string that holds two slashes

export function Notes({ wide }: { wide: boolean }) {
  return (
    <section title="a // b">
      <p>It's fine: an apostrophe in text opens nothing.</p>
      <table className={`w-full ${wide ? 'text-sm' : 'text-xs'}`}><tbody /></table>
    </section>
  );
}
