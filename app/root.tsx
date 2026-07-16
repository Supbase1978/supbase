import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700&family=Instrument+Sans:wght@400;500;600&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Hiba történt";
  let details = "Váratlan hiba történt.";

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Hiba";
    details =
      error.status === 404
        ? "A keresett oldal nem található."
        : (error.statusText ?? details);
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "var(--font-body)" }}>
      <h1 style={{ fontFamily: "var(--font-display)", color: "var(--ink-deep)" }}>
        {message}
      </h1>
      <p style={{ color: "var(--text-2)" }}>{details}</p>
    </main>
  );
}
