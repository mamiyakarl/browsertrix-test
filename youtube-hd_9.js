// youtube-hd.behavior.js — Browsertrix Web UI (single class, yields objects)
class YouTubeHDBehavior {
  static id = "YouTube HD (custom; enlarge + request HD)";
  static runInIframes = true;

  // REQUIRED: must return an object
  static init(ctx) {
    return { state: {} };
  }

  static isMatch() {
    // run on parent pages that embed YT or in the YT iframe itself
    const hasYTFrame = !!document.querySelector(
      'iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]'
    );
    const host = (location.hostname || "").toLowerCase();
    const isYTDoc =
      host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com");
    return hasYTFrame || isYTDoc;
  }

  async awaitPageLoad() {
    // let iframes settle
    await new Promise(r => setTimeout(r, 1500));
  }

  static _post(frame, func, args = []) {
    try {
      frame.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }), "*"
      );
    } catch (_) {}
  }

  async* run(ctx) {
    yield { msg: "YT-HD: start" };

    // big viewport helps YT pick HD
    try {
      if (window.outerWidth < 1600 || window.outerHeight < 900) {
        window.resizeTo(1600, 900);
      }
    } catch (_) {}

    const host = (location.hostname || "").toLowerCase();
    const isYTDoc =
      host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com");

    if (!isYTDoc) {
      // parent page: operate on embed iframes
      const iframes = Array.from(
        document.querySelectorAll('iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]')
      );
      yield { msg: `YT-HD: found ${iframes.length} iframe(s)` };

      for (const frame of iframes) {
        try {
          // ensure visible/large
          frame.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
          frame.width  = Math.max(parseInt(frame.width  || "0", 10), 1280);
          frame.height = Math.max(parseInt(frame.height || "0", 10), 720);
          frame.style.visibility = "visible";
          frame.style.opacity = "1";

          // add API & quality hints
          const u = new URL(frame.src, document.baseURI);
          u.searchParams.set("enablejsapi", "1");
          u.searchParams.set("autoplay", "1");
          u.searchParams.set("mute", "1");
          u.searchParams.set("playsinline", "1");
          u.searchParams.set("vq", "hd1080");   // hint only, not guaranteed
          const newSrc = u.toString();
          if (newSrc !== frame.src) {
            frame.src = newSrc;
            yield { msg: "YT-HD: iframe src updated (jsapi+autoplay+mute+vq)" };
          }
        } catch (_) {}
      }

      // give reload time
      await new Promise(r => setTimeout(r, 2000));

      // request playback + HD
      for (const frame of iframes) {
        YouTubeHDBehavior._post(frame, "mute");
        YouTubeHDBehavior._post(frame, "playVideo");
        YouTubeHDBehavior._post(frame, "setPlaybackQuality", ["hd1080"]);
      }
      yield { msg: "YT-HD: sent play + setPlaybackQuality" };

    } else {
      // inside the iframe document (youtube.com)
      const video = document.querySelector("video");
      if (video) {
        try {
          video.muted = true;
          await video.play().catch(() => {});
          yield { msg: "YT-HD: played <video> inside iframe" };
        } catch (_) {}
      } else {
        yield { msg: "YT-HD: no <video> in iframe" };
      }
    }

    // let higher-bitrate segments arrive
    await new Promise(r => setTimeout(r, 12000));
    yield { msg: "YT-HD: done" };
  }
}
