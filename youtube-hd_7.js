// youtube-hd.behavior.js — Browsertrix Web UI compatible (one class, no exports)

class YouTubeHDBehavior {
  static id = "YouTube HD (custom; enlarge + request HD)";
  static runInIframes = true;

  // REQUIRED and must RETURN an object (at least { state: {} })
  static init(ctx) {
    return { state: {} };
  }

  // Run on pages that contain a YT iframe OR inside the iframe doc itself
  static isMatch() {
    const hasYTFrame = !!document.querySelector(
      'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]'
    );
    const host = (location.hostname || "").toLowerCase();
    const isYTDoc =
      host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com");
    return hasYTFrame || isYTDoc;
  }

  // Let frames settle before main behavior
  async awaitPageLoad() {
    await new Promise((r) => setTimeout(r, 1500));
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
    const { Lib } = ctx;

    // mark start
    yield Lib.getState("YouTubeHD: start", "start");

    // make viewport big (helps YT choose HD)
    try {
      if (window.outerWidth < 1400 || window.outerHeight < 800) {
        window.resizeTo(1600, 900);
      }
    } catch (_) {}

    const host = (location.hostname || "").toLowerCase();
    const isYTDoc =
      host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com");

    if (!isYTDoc) {
      // Parent page: operate on YT iframes
      const iframes = Array.from(
        document.querySelectorAll('iframe[src*="youtube"]')
      );
      yield Lib.getState(`YouTubeHD: found ${iframes.length} iframe(s)`, "ifr");

      for (const frame of iframes) {
        try {
          const u = new URL(frame.src, document.baseURI);
          if (!u.searchParams.has("enablejsapi")) u.searchParams.set("enablejsapi", "1");
          if (!u.searchParams.has("vq")) u.searchParams.set("vq", "hd1080"); // hint only
          const newSrc = u.toString();
          if (newSrc !== frame.src) {
            frame.src = newSrc;
            yield Lib.getState("YouTubeHD: updated iframe src (enablejsapi+vq)", "upd");
          }

          frame.width  = Math.max(parseInt(frame.width  || "0", 10), 1280);
          frame.height = Math.max(parseInt(frame.height || "0", 10), 720);
          frame.style.visibility = "visible";
          frame.style.opacity = "1";
        } catch (_) {}
      }

      // let the iframes reload with enablejsapi
      await new Promise((r) => setTimeout(r, 1500));

      for (const frame of iframes) {
        YouTubeHDBehavior._post(frame, "mute");
        YouTubeHDBehavior._post(frame, "playVideo");
        YouTubeHDBehavior._post(frame, "setPlaybackQuality", ["hd1080"]);
      }
      yield Lib.getState("YouTubeHD: sent play + setPlaybackQuality", "req");
    } else {
      // Inside the iframe document: try direct <video> nudge
      const video = document.querySelector("video");
      if (video) {
        try {
          video.muted = true;
          await video.play().catch(() => {});
          yield Lib.getState("YouTubeHD: played <video> inside iframe", "play");
        } catch (_) {}
      } else {
        yield Lib.getState("YouTubeHD: no <video> in iframe", "novid");
      }
    }

    // allow higher-bitrate segments to arrive
    await new Promise((r) => setTimeout(r, 8000));
    yield Lib.getState("YouTubeHD: done", "done");
  }
}
