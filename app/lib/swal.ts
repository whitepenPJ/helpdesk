import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

// Single SweetAlert2 instance shared by every confirm/toast dialog in the
// app, wrapped with sweetalert2-react-content so `title`/`html` may be
// React nodes. Replaces the per-component CDN `<Script>` + `window.Swal`
// shim. SweetAlert2's ESM "all" build injects its own stylesheet, so no
// CSS import is needed here.
//
// Import this only from Client Components ("use client") — it pulls in a
// browser-oriented library.
export const swal = withReactContent(Swal);
