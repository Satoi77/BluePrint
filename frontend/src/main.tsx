import React from "react";
import ReactDOM from "react-dom/client";
import "@xyflow/react/dist/style.css";

import "./index.css";
import App from "./App";
import { log } from "./services/logger";

void log("info", "main", "前端启动");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
