// youtube-hd.behavior.js  (CommonJS)

class YouTubeHDBehavior {
  // Shown in logs
  static id = "YouTube HD (force large player + request HD)";

  // Run on pages that have a YouTube embed
  static isMatch() {
    return !!document.querySelector(
      'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]'
    );
  }

  // Also run inside iframes (YT player lives there)
  static runInIframes = true;

  // Give iframes a moment to settle
  async awaitPageLoad() {
    await new Promise((r) => setTimeout(r, 2000));
  }

  static _post(frame, func, args = []) {
    try {
      frame.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }),
        "*"
      );
    } catch (_) {}
  }

  async* run(ctx) {
    // Make viewport big so YT is more likely to choose HD
    try {
      if (window.outerWidth < 1400 || window.outerHeight < 800) {
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
          if (!u.searchParams.has("vq")) u.searchParams.set("vq", "hd1080");
          frame.src = u.toString();
        }
        frame.width = Math.max(parseInt(frame.width || "0", 10), 1280);
        frame.height = Math.max(parseInt(frame.height || "0", 10), 720);
        frame.style.visibility = "visible";
        frame.style.opacity = "1";
      } catch (_) {}
    }

    await new Promise((r) => setTimeout(r, 1500));

    // Autoplay muted + request HD
    for (const frame of iframes) {
      YouTubeHDBehavior._post(frame, "mute");
      YouTubeHDBehavior._post(frame, "playVideo");
      YouTubeHDBehavior._post(frame, "setPlaybackQuality", ["hd1080"]);
    }

    // Let segments stream a bit
    await new Promise((r) => setTimeout(r, 8000));
    yield ctx.getState("requested HD on YouTube iframes");
  }
}

module.exports = YouTubeHDBehavior; // <-- CommonJS export
