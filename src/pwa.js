export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (!import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          const serviceWorker =
            registration.active ||
            registration.waiting ||
            registration.installing;
          if (serviceWorker && new URL(serviceWorker.scriptURL).pathname === "/sw.js") {
            registration.unregister();
          }
        });
      });
    });
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}
