// Makes a heavily blurred copy of a camera track: each frame is drawn tiny
// and scaled back up. Only this copy is sent until the user reveals, so their
// real face never leaves the device before they choose.
export function veilTrack(camera: MediaStreamTrack) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([camera]);
  void video.play();

  const tiny = document.createElement("canvas");
  tiny.width = 16;
  tiny.height = 12;
  const out = document.createElement("canvas");
  out.width = 320;
  out.height = 240;
  const tinyCtx = tiny.getContext("2d")!;
  const outCtx = out.getContext("2d")!;
  outCtx.imageSmoothingEnabled = true;

  // setInterval rather than requestAnimationFrame, which pauses in background tabs.
  const timer = setInterval(() => {
    tinyCtx.drawImage(video, 0, 0, tiny.width, tiny.height);
    outCtx.drawImage(tiny, 0, 0, out.width, out.height);
  }, 1000 / 15);

  const track = out.captureStream(15).getVideoTracks()[0];
  return {
    track,
    stop() {
      clearInterval(timer);
      track.stop();
      video.srcObject = null;
    },
  };
}
