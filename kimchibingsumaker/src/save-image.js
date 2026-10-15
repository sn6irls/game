// Keep capture and download in the same tap; no preview or asynchronous encoding.
export function installImageSave({ canvas, render, filename, beforeSave }) {
  const save = document.getElementById("save");
  const status = document.getElementById("announcement");
  save.onclick = () => {
    if (save.disabled) return;
    save.disabled = true;
    let out, link, url;
    try {
      beforeSave?.();
      render();
      out = document.createElement("canvas");
      const scale = Math.min(window.devicePixelRatio || 1, 2,
        2048 / Math.max(canvas.clientWidth, canvas.clientHeight));
      out.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      out.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.imageSmoothingEnabled = false;
      // Copy before WebGL discards its drawing buffer.
      ctx.drawImage(canvas, 0, 0, out.width, out.height);
      const jpeg = out.toDataURL("image/jpeg", 0.92);
      if (!jpeg.startsWith("data:image/jpeg;base64,"))
        throw new Error("JPEG unavailable");
      const bytes = Uint8Array.from(atob(jpeg.split(",")[1]), c => c.charCodeAt(0));
      const name = filename().replace(/\.[^.]+$/, "") + ".jpg";
      const file = typeof File === "function"
        ? new File([bytes], name, { type: "image/jpeg" })
        : new Blob([bytes], { type: "image/jpeg" });
      url = URL.createObjectURL(file);
      link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      status.textContent = "JPG 다운로드를 요청했어요. 다운로드 폴더를 확인해주세요.";
    } catch {
      status.textContent = "저장하지 못했어요. save를 다시 눌러주세요.";
    } finally {
      link?.remove();
      if (out) out.width = out.height = 1;
      if (url) setTimeout(() => URL.revokeObjectURL(url), 60000);
      save.disabled = false;
    }
  };
}
