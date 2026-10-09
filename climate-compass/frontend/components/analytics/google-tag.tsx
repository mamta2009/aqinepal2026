import Script from "next/script";

/** GA4 measurement IDs look like G-7P2T8Y3CM2. Reject anything else before it is interpolated into the inline script. */
const GA_MEASUREMENT_ID = /^G-[A-Z0-9]+$/;

export function GoogleTag() {
  const measurementId = (
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ""
  ).trim();
  if (!GA_MEASUREMENT_ID.test(measurementId)) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-tag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
