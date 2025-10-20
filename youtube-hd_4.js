// youtube-hd.behavior.js  (for Browsertrix Web UI; no exports)

class YouTubeHDBehavior {
  static id = "YouTube HD (enlarge player + request HD)";
  static runInIframes = true;

  // run on pages that have a YT embed
  static isMatch() {
    return !!document.querySelector(
      'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]'
    );
  }

  async awaitPageLoad() {
    // give iframes a moment to settle
    await new Promise(r => setTimeout(r, 2000));
  }

  static _post(frame, func, args = []) {
    try {
      frame.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }), "*"
      );
    } catch (_) {}
  }

  async* run(ctx) {
    // make viewport big; helps YouTube pick HD
    try {
      if (window.outerWidth < 1400 || window.outerHeight < 800) {
        window.resizeTo(1600, 900);
      }
    } catch (_) {}

    const iframes = Array.from(
      document.querySelectorAll('iframe[src*="youtube"]')
    );

    // ensure JS API + hint HD + enlarge frames
    for (const frame of iframes) {
      try {
        const u = new URL(frame.src, document.baseURI);
        if (!u.searchParams.has("enablejsapi")) {
          u.searchParams.set("enablejsapi", "1");
        }
        if (!u.searchParams.has("vq")) {
          // hint; not guaranteed
          u.searchParams.set("vq", "hd1080");
        }
        const newSrc = u.toString();
        if (newSrc !== frame.src) frame.src = newSrc;

        frame.width  = Math.max(parseInt(frame.width  || "0", 10), 1280);
        frame.height = Math.max(parseInt(frame.height || "0", 10), 720);
        frame.style.visibility = "visible";
        frame.style.opacity = "1";
      } catch (_) {}
    }

    await new Promise(r => setTimeout(r, 1500));

    // autoplay muted and ask for HD
    for (const frame of iframes) {
      YouTubeHDBehavior._post(frame, "mute");
      YouTubeHDBehavior._post(frame, "playVideo");
      YouTubeHDBehavior._post(frame, "setPlaybackQuality", ["hd1080"]);
    }

    // allow segments to arrive
    await new Promise(r => setTimeout(r, 8000));
    yield ctx.getState("requested HD on YouTube iframes");
  }
}
