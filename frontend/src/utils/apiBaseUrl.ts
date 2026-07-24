/**
 * Browser-facing API base URL.
 *
 * On EC2 / remote hosts, `localhost:8000` is the *user's* machine, not the
 * server — so when NEXT_PUBLIC_API_URL is unset or still points at localhost
 * while the page is served from a public host, derive `http(s)://{host}:8000`.
 */
export function getApiBaseUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_API_URL || "").trim();

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]";

    if (!isLocal) {
      const envIsLocalhost =
        !fromEnv ||
        fromEnv.includes("localhost") ||
        fromEnv.includes("127.0.0.1");
      if (envIsLocalhost) {
        return `${protocol}//${hostname}:8000`;
      }
    }
  }

  return fromEnv || "http://localhost:8000";
}
