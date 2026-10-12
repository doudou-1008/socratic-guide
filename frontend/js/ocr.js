// 截图 OCR（tesseract.js，纯前端）—— 识别后填入输入框，走原 /chat 文本通道，后端不改。
export function initOcr() {
  const input = document.getElementById("input");
  const file = document.getElementById("ocr-file");
  const status = document.getElementById("ocr-status");
  if (!file) return;
  file.addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (status) status.textContent = "识别中…";
    try {
      const worker = await Tesseract.createWorker("chi_sim+eng", 1, {
        logger: () => {},
      });
      const { data } = await worker.recognize(f);
      await worker.terminate();
      const text = (data.text || "").trim();
      if (status) status.textContent = text ? "识别完成，已填入输入框" : "未识别到文字，请直接复制";
      if (text) input.value = text;
    } catch (err) {
      if (status) status.textContent = "识别失败，请直接复制文字";
      console.error(err);
    }
  });
}
