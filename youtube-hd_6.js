// youtube-hd.behavior.js — Browsertrix Web UI (single class, no exports)

class YouTubeHDBehavior {
  static id = "YouTube HD (custom, enlarge + request HD)";
  static runInIframes = true;

  // REQUIRED by the loader even if no-op
  static init() {
    // one-time setup spot if needed
  }

  // Match either:
  //  - top pages that contain a YouTube iframe, OR
  //  - the YouTube iframe document itself (domain match)
  static isMatch() {
    const hasYTFrame = !!document.querySelector(
      'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]'
    );
    const host = (location.hostname || "").toLowerCase();
    const isYTDoc =
      host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com");
    return hasYTFrame || isYTDoc;
  }

  async awaitPageLoad() {
    // allow initial network/iframes to settle
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
    // Log that we started (shows up in Browsertrix "Page Behavior" logs)
    yield "YouTubeHDBehavior: start";

    // Make viewport big; helps YouTube select HD renditions
    try {
      if (window.outerWidth < 1400 || window.outerHeight < 800) {
        window.resizeTo(1600, 900);
      }
    } catch (_) {}

    const host = (location.hostname || "").toLowerCase();
    const isYTDoc =
      host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com");

    if (!isYTDoc) {
      // We're on the parent page: operate on YT iframes
      const iframes = Array.from(
        document.querySelectorAll('iframe[src*="youtube"]')
      );
      yield `YouTubeHDBehavior: found ${iframes.length} YT iframe(s)`;

      for (const frame of iframes) {
        try {
          const u = new URL(frame.src, document.baseURI);
          if (!u.searchParams.has("enablejsapi")) u.searchParams.set("enablejsapi", "1");
          if (!u.searchParams.has("vq")) u.searchParams.set("vq", "hd1080"); // hint only
          const newSrc = u.toString();
          if (newSrc !== frame.src) {
            frame.src = newSrc;
            yield "YouTubeHDBehavior: updated iframe src with enablejsapi + vq";
          }

          // Make it big & visible
          frame.width = Math.max(parseInt(frame.width || "0", 10), 1280);
          frame.height = Math.max(parseInt(frame.height || "0", 10), 720);
          frame.style.visibility = "visible";
          frame.style.opacity = "1";
        } catch (_) {}
      }

      // wait a bit so iframes reload with enablejsapi
      await new Promise((r) => setTimeout(r, 1500));

      for (const frame of iframes) {
        YouTubeHDBehavior._post(frame, "mute");
        YouTubeHDBehavior._post(frame, "playVideo");
        YouTubeHDBehavior._post(frame, "setPlaybackQuality", ["hd1080"]);
      }
      yield "YouTubeHDBehavior: sent play + setPlaybackQuality requests";
    } else {
      // We are inside the iframe document (youtube.com)
      // Nudge playback by interacting with the <video> if present
      const video = document.querySelector("video");
      if (video) {
        try {
          video.setAttribute("muted", "true");
          video.muted = true;
          await video.play().catch(() => {});
          yield "YouTubeHDBehavior: played video inside iframe";
        } catch (_) {}
      } else {
        yield "YouTubeHDBehavior: no <video> found in iframe";
      }
    }

    // Give time for higher-bitrate segments to arrive
    await new Promise((r) => setTimeout(r, 8000));
    yield "YouTubeHDBehavior: done";
  }
}
