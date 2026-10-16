export function FacebookPixel({ pixelId }: { pixelId: string }) {
  const isBrowser = typeof window !== "undefined";

  if (!isBrowser) return null;

  if (!(window as any).fbq) {
    const script = document.createElement("script");
    script.innerHTML = `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${pixelId}');
      fbq('track', 'PageView');
    `;
    document.head.appendChild(script);
  }

  const noscript = document.createElement("noscript");
  noscript.innerHTML = `<img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1" />`;
  document.body.insertAdjacentElement("afterbegin", noscript);

  return null;
}

export function trackPageView() {
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "PageView");
  }
}

export function trackLead() {
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "Lead");
  }
}

export function trackCompleteRegistration() {
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "CompleteRegistration");
  }
}

export function trackInitiateCheckout(value: number, currency: string = "BRL") {
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "InitiateCheckout", {
      value: value,
      currency: currency,
    });
  }
}

export function trackPurchase(value: number, currency: string = "BRL") {
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "Purchase", {
      value: value,
      currency: currency,
    });
  }
}

export function trackAddToCart(value: number, currency: string = "BRL") {
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "AddToCart", {
      value: value,
      currency: currency,
    });
  }
}