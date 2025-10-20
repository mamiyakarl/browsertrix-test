class YouTubeHDBehavior {
  // Shown in Browsertrix logs
  static id = "YouTube HD (force large player + request HD)";

  // Run on any page that has a YouTube embed
  static isMatch() {
    return !!document.querySelector(
      'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]'
    );
  }

  // Also check/run inside iframes (player lives there)
  static runInIframes = true;

  // Small delay so iframes settle before we message them
  async awaitPageLoad() {
    await new Promise(r => setTimeout(r, 2000));
  }

  // Helper
  static _post(frame, func, args = []) {
    try {
      frame.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }),
        "*"
      );
    } catch (_) {}
  }

  async* run(ctx) {
    // Enlarge viewport & frames so YT is more likely to pick HD
    try {
      if (window.outerWidth < 1400 || window.outerHeight < 800) {
        // Not all environments honor this, but it helps in many cases
        window.resizeTo(1600, 900);
      }
    } catch (_) {}

    const iframes = Array.from(
      document.querySelectorAll('iframe[src*="youtube"]')
    );

    // Ensure enablejsapi=1 and bump frame size
    for (const frame of iframes) {
      try {
        const u = new URL(frame.src, document.baseURI);
        if (!u.searchParams.has("enablejsapi")) {
          u.searchParams.set("enablejsapi", "1");
          // Hint preferred quality (not guaranteed)
          if (!u.searchParams.has("vq")) u.searchParams.set("vq", "hd1080");
          frame.src = u.toString();
        }
        // Make it big & visible
        frame.width = Math.max(parseInt(frame.width || "0", 10), 1280);
        frame.height = Math.max(parseInt(frame.height || "0", 10), 720);
        frame.style.visibility = "visible";
        frame.style.opacity = "1";
      } catch (_) {}
    }

    // Give the reloaded iframes a moment
    await new Promise(r => setTimeout(r, 1500));

    // Autoplay muted and request HD
    for (const frame of iframes) {
      YouTubeHDBehavior._post(frame, "mute");
      YouTubeHDBehavior._post(frame, "playVideo");
      YouTubeHDBehavior._post(frame, "setPlaybackQuality", ["hd1080"]);
    }

    // Let segments stream in
    await new Promise(r => setTimeout(r, 8000));
    yield ctx.getState("requested HD on YouTube iframes");
  }
}

// Export the class (Browsertrix supports class-per-file)
export default YouTubeHDBehavior;
