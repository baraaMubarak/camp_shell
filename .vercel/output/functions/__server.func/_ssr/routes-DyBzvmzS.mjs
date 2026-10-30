import { i as __toESM } from "../_runtime.mjs";
import { G as require_jsx_runtime, K as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DyBzvmzS.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Home() {
	const [App, setApp] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		import("./AuditorApp-CXcOkvX1.mjs").then((mod) => setApp(() => mod.AuditorApp));
	}, []);
	if (!App) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Splash, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(App, {});
}
function Splash() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-3 px-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted",
				children: "على هذا الجهاز فقط"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-3xl font-semibold",
				children: "المدقّق"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm text-muted",
				children: "تدقيق الكشوف واستكمال النواقص محلياً، دون رفع البيانات."
			})
		]
	});
}
//#endregion
export { Home as component };
