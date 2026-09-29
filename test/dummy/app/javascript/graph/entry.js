import "./a.js"
import "remote_dep"

// The lazy boundary: chart_dep is only ever reached through this, so neither it
// nor lazy_chart belongs in the preload set for this entry point.
document.addEventListener("click", () => import("lazy_chart"))
