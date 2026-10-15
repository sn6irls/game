// Prepare the file first. Sharing/downloading then starts from a fresh tap,
// so slow PNG encoding cannot use up the browser's user activation.
export function installImageSave({ canvas, render, filename, beforeOpen }) {
  const $ = (id) => document.getElementById(id);
  const save = $("save"), dialog = $("save-preview");
  const image = $("save-image"), share = $("save-share");
  const download = $("save-download"), status = $("save-status");
  let file = null, objectURL = null, version = 0;

  function release() {
    file = null;
    share.disabled = false;
    if (objectURL) {
      const oldURL = objectURL;
      // A download may still be consuming the URL after the panel closes.
      setTimeout(() => URL.revokeObjectURL(oldURL), 60000);
      objectURL = null;
    }
    image.removeAttribute("src");
    download.removeAttribute("href");
    image.hidden = share.hidden = download.hidden = true;
  }

  function closed() {
    version++;
    release();
    save.disabled = false;
    save.focus();
  }

  $("save-close").onclick = () => {
    if (typeof dialog.close === "function") dialog.close();
    else { dialog.removeAttribute("open"); closed(); }
  };
  dialog.addEventListener("close", closed);

  save.onclick = async () => {
    beforeOpen?.();
    release();
    const captureVersion = ++version;
    save.disabled = true;
    status.textContent = "이미지를 준비하고 있어요…";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    try {
      // Copy WebGL immediately after rendering; its drawing buffer is not kept.
      render();
      const out = document.createElement("canvas");
      const scale = Math.min(window.devicePixelRatio || 1, 2,
        2048 / Math.max(canvas.clientWidth, canvas.clientHeight));
      out.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      out.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, 0, 0, out.width, out.height);
      const blob = await new Promise((resolve) => out.toBlob(resolve, "image/png"));
      out.width = out.height = 1;
      if (!blob) throw new Error("PNG unavailable");
      const dataURL = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      if (captureVersion !== version) return;
      const name = filename();
      // An actual image remains available for long-press saving in webviews
      // that do not support file sharing or blob downloads.
      image.src = dataURL;
      image.hidden = false;
      objectURL = URL.createObjectURL(blob);
      download.href = objectURL;
      download.download = name;
      download.hidden = false;
      if (typeof File === "function") {
        file = new File([blob], name, { type: "image/png" });
        try {
          share.hidden = !(typeof navigator.share === "function" &&
            navigator.canShare?.({ files: [file] }));
        } catch { share.hidden = true; }
      }
      status.textContent = "휴대폰에서는 이미지를 길게 눌러 ‘사진에 저장’을 선택할 수 있어요.";
    } catch {
      if (captureVersion === version)
        status.textContent = "이미지를 만들지 못했어요. 닫은 뒤 save를 다시 눌러주세요.";
    } finally {
      if (captureVersion === version) save.disabled = false;
    }
  };

  share.onclick = async () => {
    if (!file || share.disabled) return;
    const shareVersion = version;
    share.disabled = true;
    try {
      // No asynchronous work before this call: this click is the user gesture.
      await navigator.share({ files: [file] });
      if (shareVersion === version)
        status.textContent = "저장이 끝났으면 닫기를 눌러 게임으로 돌아가세요.";
    } catch (error) {
      if (shareVersion === version)
        status.textContent = error.name === "AbortError"
          ? "취소했어요. 이미지를 길게 누르거나 다운로드로 저장할 수도 있어요."
          : "공유창을 열 수 없어요. 이미지를 길게 누르거나 다운로드로 저장해주세요.";
    } finally {
      if (shareVersion === version) share.disabled = false;
    }
  };

  download.onclick = () => {
    // Keep a visible fallback: browsers do not report whether a download saved.
    status.textContent = "다운로드가 시작되지 않으면 위 이미지를 길게 눌러 저장해주세요.";
  };
}
