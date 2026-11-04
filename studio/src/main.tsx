import { boot, ready } from './boot';
import './studio.css';

const el = document.getElementById('studio-root')!;
void ready(el).then(() => boot(el));
