import "./style.css";
import { AppModel, format_time, parse_files, summarize_record } from "./model.js";
import { ApplicationView } from "./view.js";

if (!window.Timeless?.DOM?.render) throw new Error("Timeless runtime is unavailable");

window.DevboardHelpers = { format_time, parse_files, summarize_record };
const model = new AppModel();
window.Timeless.DOM.render(ApplicationView(model), document.querySelector("#app"));
model.start();
