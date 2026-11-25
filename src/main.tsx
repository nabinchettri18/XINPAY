import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CustomerApp from "./CustomerApp";
import "./styles.css";
import "./customer.css";
import "./dashboard-theme.css";
import "./customer-dashboard-polish.css";
import "./customer-account-setup.css";

const isCustomer = window.location.pathname.startsWith("/customer");
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isCustomer ? <CustomerApp /> : <App />}</React.StrictMode>
);