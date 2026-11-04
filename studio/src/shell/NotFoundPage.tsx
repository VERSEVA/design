// 404.html: the studio shell with a not-found page. Labels only.
import { onStudioLink } from './router';

export function NotFoundPage() {
  return (
    <section className="section">
      <h1>Page not found</h1>
      <a className="btn btn-primary" href="/" onClick={onStudioLink}>Go to Overview</a>
    </section>
  );
}
