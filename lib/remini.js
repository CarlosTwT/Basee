const FormData = require("form-data");

async function remini(imageBuffer, mode) {
  return new Promise(async (resolve, reject) => {
    const validModes = ["enhance", "recolor", "dehaze"];
    mode = validModes.includes(mode) ? mode : validModes[0]; // Use the provided mode or default to 'enhance'

    const formData = new FormData();
    const url = `https://inferenceengine.vyro.ai/${mode}`;

    formData.append("model_version", 1, {
      "Content-Transfer-Encoding": "binary",
      contentType: "multipart/form-data; charset=utf-8"
    });

    formData.append("image", Buffer.from(imageBuffer), {
      filename: "enhance_image_body.jpg",
      contentType: "image/jpeg"
    });

    formData.submit({
      url,
      host: "inferenceengine.vyro.ai",
      path: `/${mode}`,
      protocol: "https:",
      headers: {
        "User-Agent": "okhttp/4.9.3",
        Connection: "Keep-Alive",
        "Accept-Encoding": "gzip"
      }
    }, function (error, response) {
      if (error) {
        reject(error);
        return;
      }

      const chunks = [];

      response.on("data", (chunk) => {
        chunks.push(chunk);
      });

      response.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      response.on("error", (error) => {
        reject(error);
      });
    });
  });
}

module.exports.remini = remini;