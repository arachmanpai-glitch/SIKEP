"use client";

/**
 * Catches errors in the root layout itself (error.tsx does not cover
 * this — Next.js docs, PHASE 12). Must render its own <html>/<body> and
 * cannot rely on globals.css/next/font being applied, so styling here is
 * inline rather than Tailwind classes.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
          backgroundColor: "#09090b",
          color: "#fafafa",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <p
          style={{
            fontSize: "14px",
            fontWeight: 500,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#a1a1aa",
          }}
        >
          SIKEP
        </p>
        <h1 style={{ marginTop: "8px", fontSize: "32px", fontWeight: 600 }}>Terjadi Kesalahan</h1>
        <p style={{ marginTop: "16px", maxWidth: "420px", color: "#a1a1aa" }}>
          Maaf, aplikasi mengalami kesalahan yang tidak terduga. Silakan coba lagi.
        </p>
        {error.digest && (
          <p style={{ marginTop: "8px", fontSize: "12px", color: "#71717a" }}>
            Kode: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={() => retry()}
          style={{
            marginTop: "32px",
            borderRadius: "6px",
            backgroundColor: "#fafafa",
            color: "#09090b",
            padding: "8px 16px",
            fontSize: "14px",
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          Coba Lagi
        </button>
      </body>
    </html>
  );
}
