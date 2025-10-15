import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import App from "@/App.jsx";
import "@/index.css";
const isDev = process.env.NODE_ENV !== "production";
const REACTWRAP = isDev ? React.Fragment : React.StrictMode;

ReactDOM.createRoot(document.getElementById("root")).render(
  <REACTWRAP>
    <Router>
      <App />
    </Router>
  </REACTWRAP>
);
// Suppress react-beautiful-dnd defaultProps warning
if (import.meta.env.DEV) {
  const originalError = console.error;
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Support for defaultProps will be removed")
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
}
