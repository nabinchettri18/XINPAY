import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CustomerApp from "./CustomerApp";
import LandingPage from "./LandingPage";
import AdminGate from "./AdminGate";
import "./styles.css";
import "./customer.css";
import "./dashboard-theme.css";
import "./customer-dashboard-polish.css";
import "./customer-account-setup.css";
import "./customer-auth.css";
import "./brand-palette.css";
import "./customer-refinement.css";
import "./subscription-workspace.css";

const path = window.location.pathname;
const isCustomer = path.startsWith("/customer");
const isAdmin = path === "/admin24776543";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isCustomer ? <CustomerApp /> : isAdmin ? <AdminGate><App /></AdminGate> : <LandingPage />}
  </React.StrictMode>
);
