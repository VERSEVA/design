export function Notes({ href }: { href: string }) {
  const [q, setQ] = useState<string>('');
  return (
    <main>
      <p>Don't</p> <button className="px-4">It's</button>
      <p>See https://example.com</p> <button className="px-4">Go</button>
      <p>A /* is text</p> <table className="w-full"><tbody /></table>
      <p title="it's quoted">{'a string: <button className="px-4">not a tag</button>'}</p>
      {/* <button className="px-4">a comment, not a tag</button> */}
      <a href={href}>It's <b>fine</b>, isn't it</a>
    </main>
  );
}

const first = <T,>(xs: T[]): T => xs[0]; // a generic arrow is not a tag: '<button>' sits in a comment
const on = <K extends keyof Events>(type: K) => type; // nor is one that extends: '<table>'
const or = <T = string,>(x: T) => x; /* nor one with a default: '<dialog>' */

export function After() {
  return <p>It's late, isn't it <select className="px-2" /></p>;
}

const html = '<dialog>a module-level string</dialog>';
