export function Upload() {
  return (
    <form>
      <div className="field"><input type="file" accept="image/*" /></div>
      <table className="w-full text-sm"><tbody /></table>
      {/* a note between the two */}
      <button
        /* an inline note */
        className="px-2 py-1"
      >
        Send
      </button>
    </form>
  );
}
