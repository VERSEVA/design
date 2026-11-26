import styles from './page.module.css';
import { Field, Button } from './ui';

export function Page({ cls, open }: { cls: string; open: boolean }) {
  return (
    <form>
      <button className={cls} type="submit">Unknown: no literal</button>
      <button className={styles.cta} type="button">Unknown: no literal</button>
      <button className={open ? 'btn btn-primary' : cls} type="button">One literal holds a contract class</button>
      <button className={`btn ${cls}`} type="button">Template literal holds a contract class</button>
      <Button className="px-4">Capitalised components are never followed</Button>
      <div className="field">
        <label htmlFor="size">Size</label>
        <select id="size"><option>Small</option></select>
      </div>
      <button className={open ? 'px-4 py-2' : 'px-2 py-1'} type="button">Literals, none in the contract</button>
      <Field>
        <input id="loose" />
      </Field>
      <div role="dialog" className={`${open ? 'sheet' : 'modal'} wide`}>A literal chosen inside a template placeholder</div>
    </form>
  );
}
