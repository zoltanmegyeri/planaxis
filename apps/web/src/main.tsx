import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.js";
import "./style.css";

const applicationRoot = document.getElementById("app");
if (applicationRoot === null) throw new Error("PlanAxis application root was not found.");
createRoot(applicationRoot).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
