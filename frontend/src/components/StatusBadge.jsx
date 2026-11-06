/** One accessible status treatment across cards, details, trades and Admin. */
import { STATUS, postStatus } from '../utils/statusPresentation.js';
export default function StatusBadge({ state, post, children }) {
  const candidate = post ? postStatus(post) : state;
  const key = Object.hasOwn(STATUS, candidate) ? candidate : 'unknown';
  const value = STATUS[key];
  const [ink, background, border] = value.colors;
  return <span className="status-badge" data-state={key}
    style={{ '--status-ink': ink, '--status-bg': background, '--status-border': border }}>
    <span className="status-symbol" aria-hidden="true">{value.icon}</span>
    <span>{children || value.label}</span>
  </span>;
}
