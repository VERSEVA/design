export function Actions({ action, rest }: { action: object; rest: object }) {
  return (
    <div>
      <button {...action} type="button">Only a spread: unknown</button>
      <button {...rest} className="px-4" type="button">A spread beside utilities</button>
      <button className="px-4" {...rest}>A spread after utilities</button>
      <button {...rest} className="btn btn-primary">A spread beside a contract class</button>
    </div>
  );
}
